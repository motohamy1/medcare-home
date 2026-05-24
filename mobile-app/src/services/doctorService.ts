import { databases, functions, Query, ExecutionMethod, APPWRITE_CONFIG } from '@/lib/appwrite';
import { decodeGeohash, calculateDistanceKm, type LatLng } from '@/lib/location';
import { searchGooglePlaces, type PlaceDoctor } from '@/lib/places';

const { databaseId, collections, functions: fns } = APPWRITE_CONFIG;

// ─── Types ───────────────────────────────────────────────────────────────────
export interface Doctor {
  $id: string;
  auth_id: string;
  full_name: string;
  major_field: 'physician' | 'dentist' | 'physiotherapy';
  sub_specialty: string;
  clinic_governorate: string;
  clinic_district: string;
  geohash: string;
  consultation_fee: number;
  google_rating: number;
  review_count: number;
  search_index?: string;
}

export interface DoctorWithDistance extends Doctor {
  distance_km?: number;
}

export interface SearchIntent {
  major_field: string;
  specialty: string;
  symptoms: string[];
  doctor_name?: string;
  keywords: string[];
}

/** Unified result that can be either internal (bookable) or external (Google Places) */
export interface UnifiedDoctorResult {
  id: string;
  full_name: string;
  major_field: 'physician' | 'dentist' | 'physiotherapy' | 'unknown';
  sub_specialty: string;
  location_text: string;
  distance_km?: number;
  google_rating: number;
  review_count: number;
  /** true = from our Appwrite DB (can book). false = from Google Places (discover only). */
  isBookable: boolean;
  /** Only present for internal doctors */
  internalData?: DoctorWithDistance;
  /** Only present for external doctors */
  externalData?: PlaceDoctor;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Merge two doctor arrays, deduplicating by $id */
function mergeDoctorsUnique(arrA: Doctor[], arrB: Doctor[]): Doctor[] {
  const map = new Map<string, Doctor>();
  [...arrA, ...arrB].forEach((d) => map.set(d.$id, d));
  return Array.from(map.values());
}

/** Build a composite sort score. Lower = better. */
function compositeScore(distance: number, rating: number): number {
  if (distance < 3) {
    return (5 - rating) * 100 + distance;
  }
  if (distance <= 15) {
    return distance * 10 + (5 - rating) * 20;
  }
  return distance * 20 + (5 - rating) * 5;
}

/** Convert internal Doctor to unified result */
function toUnifiedInternal(doc: DoctorWithDistance): UnifiedDoctorResult {
  return {
    id: doc.$id,
    full_name: doc.full_name,
    major_field: doc.major_field,
    sub_specialty: doc.sub_specialty || doc.major_field,
    location_text: `${doc.clinic_district}, ${doc.clinic_governorate}`,
    distance_km: doc.distance_km,
    google_rating: doc.google_rating ?? 0,
    review_count: doc.review_count ?? 0,
    isBookable: true,
    internalData: doc,
  };
}

/** Convert external PlaceDoctor to unified result */
function toUnifiedExternal(place: PlaceDoctor): UnifiedDoctorResult {
  return {
    id: place.placeId,
    full_name: place.full_name,
    major_field: place.major_field,
    sub_specialty: place.sub_specialty,
    location_text: place.clinic_address,
    distance_km: place.distance_km,
    google_rating: place.google_rating ?? 0,
    review_count: place.review_count ?? 0,
    isBookable: false,
    externalData: place,
  };
}

/** Merge internal + external results, deduplicate by proximity + name similarity */
function mergeUnifiedResults(
  internal: DoctorWithDistance[],
  external: PlaceDoctor[]
): UnifiedDoctorResult[] {
  const unified: UnifiedDoctorResult[] = [];
  const seenPlaceIds = new Set<string>();

  // Add internals first (they are bookable)
  for (const doc of internal) {
    unified.push(toUnifiedInternal(doc));
  }

  // Add externals only if not already matched to an internal doctor
  for (const place of external) {
    // Simple dedup: if an internal doctor has the same name (case-insensitive), skip the external
    const alreadyHave = internal.some(
      (d) => d.full_name.toLowerCase() === place.full_name.toLowerCase()
    );
    if (!alreadyHave && !seenPlaceIds.has(place.placeId)) {
      unified.push(toUnifiedExternal(place));
      seenPlaceIds.add(place.placeId);
    }
  }

  return unified;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Fetch top-rated doctors for the Home screen */
export async function getSuggestedDoctors(limit = 5): Promise<Doctor[]> {
  const { documents } = await databases.listDocuments(
    databaseId,
    collections.doctorProfiles,
    [Query.orderDesc('google_rating'), Query.limit(limit)]
  );
  return documents as unknown as Doctor[];
}

/** Fetch a single doctor by document ID */
export async function getDoctorById(doctorId: string): Promise<Doctor> {
  const doc = await databases.getDocument(databaseId, collections.doctorProfiles, doctorId);
  return doc as unknown as Doctor;
}

/** Filter doctors by major field (category tap on Home) */
export async function getDoctorsByField(
  majorField: 'physician' | 'dentist' | 'physiotherapy',
  limit = 20
): Promise<Doctor[]> {
  const { documents } = await databases.listDocuments(
    databaseId,
    collections.doctorProfiles,
    [Query.equal('major_field', majorField), Query.orderDesc('google_rating'), Query.limit(limit)]
  );
  return documents as unknown as Doctor[];
}

/**
 * LIVE AI-powered search:
 * 1. Extracts AI intent from query (via Appwrite function)
 * 2. Queries internal Appwrite Doctor_Profiles database
 * 3. Queries external OpenStreetMap (Overpass API) for real-world doctors
 * 4. Calculates distances for both sets
 * 5. Merges, deduplicates, and sorts by proximity + rating
 */
export async function searchDoctors(
  query: string,
  userLocation?: LatLng
): Promise<{
  intent: SearchIntent | null;
  results: UnifiedDoctorResult[];
  locationUsed: boolean;
  externalCount: number;
}> {
  const rawQuery = query.trim();
  if (!rawQuery) return { intent: null, results: [], locationUsed: false, externalCount: 0 };

  // ── Step 1: AI intent extraction ────────────────────────────────────────────
  let intent: SearchIntent | null = null;
  try {
    const execution = await functions.createExecution(
      fns.maintenanceCron,
      JSON.stringify({ query: rawQuery }),
      false,
      '/',
      ExecutionMethod.POST
    );
    const parsed = JSON.parse(execution.responseBody);
    if (parsed.success && parsed.intent) {
      intent = parsed.intent;
    }
  } catch (err) {
    console.error('[doctorService] AI search intent extraction failed:', err);
  }

  // ── Step 2: Build search query strings ──────────────────────────────────────
  // For Overpass API we need a clean text query
  let placesQuery = rawQuery;
  if (intent?.specialty) {
    placesQuery = `${intent.specialty} doctor`;
  }
  if (intent?.major_field === 'dentist') {
    placesQuery = intent?.specialty ? `${intent.specialty} dentist` : 'dentist';
  }
  if (intent?.major_field === 'physiotherapy') {
    placesQuery = intent?.specialty ? `${intent.specialty} physiotherapy` : 'physiotherapist';
  }

  // ── Step 3: Parallel search — internal DB + Overpass API ────────────────
  const [internalDoctors, externalPlaces] = await Promise.all([
    searchInternalDoctors(rawQuery, intent, userLocation),
    searchGooglePlaces(placesQuery, userLocation, 15000),
  ]);

  // ── Step 4: Merge and sort ────────────────────────────────────────────────
  const merged = mergeUnifiedResults(internalDoctors, externalPlaces);

  const locationUsed = !!userLocation;

  if (locationUsed) {
    merged.sort((a, b) => {
      const scoreA = compositeScore(a.distance_km ?? 999, a.google_rating);
      const scoreB = compositeScore(b.distance_km ?? 999, b.google_rating);
      return scoreA - scoreB;
    });
  } else {
    merged.sort((a, b) => b.google_rating - a.google_rating);
  }

  return {
    intent,
    results: merged.slice(0, 20),
    locationUsed,
    externalCount: externalPlaces.length,
  };
}

/** Internal database search (multi-strategy) */
async function searchInternalDoctors(
  rawQuery: string,
  intent: SearchIntent | null,
  userLocation?: LatLng
): Promise<DoctorWithDistance[]> {
  let allDoctors: Doctor[] = [];

  // Strategy A: AI-guided specialty search
  if (intent?.major_field || intent?.specialty) {
    try {
      const filters: string[] = [Query.limit(50)];
      if (intent.major_field) {
        filters.push(Query.equal('major_field', intent.major_field));
      }
      if (intent.specialty) {
        filters.push(Query.search('search_index', intent.specialty));
      }
      filters.push(Query.orderDesc('google_rating'));

      const { documents } = await databases.listDocuments(
        databaseId,
        collections.doctorProfiles,
        filters
      );
      allDoctors = documents as unknown as Doctor[];
    } catch (err) {
      console.error('[doctorService] AI-guided search failed:', err);
    }
  }

  // Strategy B: Raw full-text search on search_index
  try {
    const { documents } = await databases.listDocuments(
      databaseId,
      collections.doctorProfiles,
      [
        Query.search('search_index', rawQuery.toLowerCase()),
        Query.orderDesc('google_rating'),
        Query.limit(50),
      ]
    );
    const rawResults = documents as unknown as Doctor[];
    allDoctors = mergeDoctorsUnique(allDoctors, rawResults);
  } catch (err) {
    console.error('[doctorService] Raw search_index query failed:', err);
  }

  // Calculate distances
  let enriched: DoctorWithDistance[] = allDoctors;
  if (userLocation) {
    enriched = allDoctors.map((doc) => {
      const docLoc = decodeGeohash(doc.geohash);
      if (docLoc) {
        const distance = calculateDistanceKm(
          userLocation.latitude,
          userLocation.longitude,
          docLoc.latitude,
          docLoc.longitude
        );
        return { ...doc, distance_km: distance };
      }
      return doc;
    });
  }

  return enriched;
}

/** Fetch reviews for a doctor */
export async function getDoctorReviews(doctorId: string, limit = 10) {
  const { documents } = await databases.listDocuments(
    databaseId,
    collections.patientReviews,
    [Query.equal('doctor_id', doctorId), Query.orderDesc('$createdAt'), Query.limit(limit)]
  );
  return documents;
}
