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
  /** Search relevance score (lower is better). */
  relevanceScore?: number;
  /** True for the top recommended result. */
  isBestMatch?: boolean;
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

/** Build a combined relevance score. Lower = better. */
function computeRelevanceScore(result: UnifiedDoctorResult, intent: SearchIntent | null, locationUsed: boolean): number {
  let score = 0;

  // Force internal/bookable results slightly ahead when relevance is close.
  if (!result.isBookable) score += 8;

  // Intent match penalty: major field + specialty.
  if (intent) {
    if (intent.major_field && result.major_field !== intent.major_field) {
      score += 40;
    }

    const normalizedSpecialty = intent.specialty?.toLowerCase() || '';
    const resultSpecialty = (result.sub_specialty || result.major_field).toLowerCase();
    if (normalizedSpecialty && !resultSpecialty.includes(normalizedSpecialty)) {
      score += 18;
    }
  }

  // Distance matters when we have location.
  if (locationUsed && typeof result.distance_km === 'number') {
    score += Math.min(result.distance_km, 50) * 2;
  }

  // Prioritize higher-rated providers.
  score += Math.max(0, 5 - (result.google_rating ?? 0)) * 5;

  return score;
}

function normalizeSearchKeyword(text: string): string {
  return text.trim().toLowerCase();
}

function inferSearchIntentFromQuery(rawQuery: string): SearchIntent {
  const q = rawQuery.toLowerCase();
  const intent: SearchIntent = {
    major_field: 'physician',
    specialty: '',
    symptoms: [],
    keywords: q.split(/\s+/).filter(Boolean),
  };

  if (q.includes('dentist') || q.includes('dental') || q.includes('tooth') || q.includes('أسنان') || q.includes('ضرزري')) {
    intent.major_field = 'dentist';
    intent.specialty = 'Dentistry';
  } else if (q.includes('physio') || q.includes('therapy') || q.includes('rehab') || q.includes('علاج') || q.includes('طبيعي')) {
    intent.major_field = 'physiotherapy';
    intent.specialty = 'Physiotherapy';
  } else if (q.includes('cardio') || q.includes('heart') || q.includes('قلب')) {
    intent.specialty = 'Cardiology';
  } else if (q.includes('pediatric') || q.includes('child') || q.includes('أطفال')) {
    intent.specialty = 'Pediatrics';
  } else if (q.includes('derma') || q.includes('skin') || q.includes('جلد')) {
    intent.specialty = 'Dermatology';
  } else if (q.includes('ortho') || q.includes('bone') || q.includes('joint') || q.includes('عظام')) {
    intent.specialty = 'Orthopedics';
  } else if (q.includes('neuro') || q.includes('brain') || q.includes('عصب') || q.includes('مخ')) {
    intent.specialty = 'Neurology';
  } else if (q.includes('gyn') || q.includes('women') || q.includes('نساء')) {
    intent.specialty = 'Gynecology';
  } else if (q.includes('gastro') || q.includes('stomach') || q.includes('بطن') || q.includes('معدة')) {
    intent.specialty = 'Gastroenterology';
  } else if (q.includes('eye') || q.includes('vision') || q.includes('عيون') || q.includes('نظر')) {
    intent.specialty = 'Ophthalmology';
  } else if (q.includes('ent') || q.includes('ear') || q.includes('اذن') || q.includes('أنف')) {
    intent.specialty = 'ENT';
  } else if (q.includes('psych') || q.includes('mental') || q.includes('نفس') || q.includes('ذهن')) {
    intent.specialty = 'Psychiatry';
  } else if (q.includes('urology') || q.includes('kidney') || q.includes('كلى') || q.includes('بول')) {
    intent.specialty = 'Urology';
  }

  if (q.includes('dr ') || q.includes('dr. ') || q.includes('doctor ')) {
    intent.doctor_name = rawQuery;
  }

  const symptomKeywords = ['pain', 'fever', 'cough', 'headache', 'stomach', 'back', 'skin', 'nausea', 'dizziness'];
  intent.symptoms = symptomKeywords.filter((symptom) => q.includes(symptom));

  return intent;
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
  let aiExtractionFailed = false;
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
    } else {
      aiExtractionFailed = true;
    }
  } catch (err) {
    console.error('[doctorService] AI search intent extraction failed:', err);
    aiExtractionFailed = true;
  }

  if (!intent || aiExtractionFailed) {
    intent = inferSearchIntentFromQuery(rawQuery);
  }

  // ── Step 2: Build search query strings ──────────────────────────────────────
  // For Overpass API we need a clean text query. Use fallback mapping when AI intent is not specific.
  let placesQuery = rawQuery;
  if (intent.specialty) {
    const normalizedSpecialty = normalizeSearchKeyword(intent.specialty);
    if (intent.major_field === 'dentist') {
      placesQuery = `${normalizedSpecialty} dentist`;
    } else if (intent.major_field === 'physiotherapy') {
      placesQuery = `${normalizedSpecialty} physiotherapist`;
    } else {
      placesQuery = `${normalizedSpecialty} doctor`;
    }
  } else if (intent.major_field === 'dentist') {
    placesQuery = 'dentist';
  } else if (intent.major_field === 'physiotherapy') {
    placesQuery = 'physiotherapist';
  }

  // ── Step 3: Parallel search — internal DB + Overpass API ────────────────
  const localRadiusMeters = userLocation ? 50000 : 30000;
  const [internalDoctors, externalPlaces] = await Promise.all([
    searchInternalDoctors(rawQuery, intent, userLocation),
    searchGooglePlaces(placesQuery, userLocation, localRadiusMeters),
  ]);

  // ── Step 4: Merge, score, and sort ────────────────────────────────────────
  const merged = mergeUnifiedResults(internalDoctors, externalPlaces);
  const locationUsed = !!userLocation;
  merged.forEach((item) => {
    item.relevanceScore = computeRelevanceScore(item, intent, locationUsed);
  });

  merged.sort((a, b) => {
    if ((a.relevanceScore ?? 0) !== (b.relevanceScore ?? 0)) {
      return (a.relevanceScore ?? 0) - (b.relevanceScore ?? 0);
    }
    if (locationUsed) {
      return (a.distance_km ?? 999) - (b.distance_km ?? 999);
    }
    return (b.google_rating ?? 0) - (a.google_rating ?? 0);
  });

  if (merged.length > 0) {
    merged[0].isBestMatch = true;
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

  // Calculate distances and sort by proximity when location is available.
  // We no longer hard-filter by distance — far-away doctors get penalized
  // in relevance scoring but are still visible as a fallback.
  if (userLocation) {
    const withDistance: DoctorWithDistance[] = allDoctors.flatMap((doc) => {
      const docLoc = decodeGeohash(doc.geohash);
      if (!docLoc) return [];

      const distance = calculateDistanceKm(
        userLocation.latitude,
        userLocation.longitude,
        docLoc.latitude,
        docLoc.longitude
      );

      return [{ ...doc, distance_km: distance }];
    });

    return withDistance.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999));
  }

  return allDoctors;
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
