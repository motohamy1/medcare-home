import { calculateDistanceKm, type LatLng } from '@/lib/location';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';
const PHOTON_API_URL = 'https://photon.komoot.io/api/';

/** Approximate Egypt bounding box used when no user location is available */
const EGYPT_BBOX = { south: 22.0, north: 32.0, west: 25.0, east: 37.0 };

/** Default Egypt center (Cairo) used when user location is unavailable */
const DEFAULT_EGYPT_LOCATION: LatLng = { latitude: 30.0444, longitude: 31.2357 };

// ─── Types ───────────────────────────────────────────────────────────────────
export interface PlaceDoctor {
  /** OSM node/way ID */
  placeId: string;
  /** Name from OSM */
  full_name: string;
  /** Mapped from OSM amenity type */
  major_field: 'physician' | 'dentist' | 'physiotherapy' | 'unknown';
  /** Specialty from OSM healthcare:speciality tag */
  sub_specialty: string;
  /** Full address assembled from addr:* tags */
  clinic_address: string;
  /** Latitude */
  latitude: number;
  /** Longitude */
  longitude: number;
  /** Google rating not available from OSM, default to 0 */
  google_rating: number;
  /** Review count not available from OSM */
  review_count: number;
  /** Distance from user in km */
  distance_km?: number;
  /** Always external */
  isExternal: true;
  /** Is this also in our Appwrite DB? */
  isOnMedCare: boolean;
}

// ─── OSM Helpers ─────────────────────────────────────────────────────────────

/** Map OSM amenity to our major_field */
function mapOsmAmenity(amenity: string): 'physician' | 'dentist' | 'physiotherapy' | 'unknown' {
  const a = (amenity || '').toLowerCase();
  if (a === 'dentist') return 'dentist';
  if (a === 'physiotherapist' || a === 'physiotherapy') return 'physiotherapy';
  if (a === 'doctor' || a === 'hospital' || a === 'clinic' || a === 'doctors') return 'physician';
  return 'unknown';
}

/** Assemble a readable address from OSM addr:* tags */
function buildAddress(tags: Record<string, string>): string {
  const parts: string[] = [];
  if (tags['addr:street']) parts.push(tags['addr:street']);
  if (tags['addr:city']) parts.push(tags['addr:city']);
  if (tags['addr:state']) parts.push(tags['addr:state']);
  if (tags['addr:country']) parts.push(tags['addr:country']);
  return parts.join(', ') || 'Address not available';
}

/** Infer sub-specialty from OSM healthcare:speciality + query context */
function inferSubSpecialty(tags: Record<string, string>, queryContext: string): string {
  const spec = (tags['healthcare:speciality'] || '').toLowerCase();
  const q = queryContext.toLowerCase();

  // OSM speciality tag direct match
  if (spec.includes('cardiology')) return 'Cardiology';
  if (spec.includes('pediatrics')) return 'Pediatrics';
  if (spec.includes('dermatology')) return 'Dermatology';
  if (spec.includes('orthopedics')) return 'Orthopedics';
  if (spec.includes('neurology')) return 'Neurology';
  if (spec.includes('gynecology')) return 'Gynecology';
  if (spec.includes('gastroenterology')) return 'Gastroenterology';
  if (spec.includes('ophthalmology')) return 'Ophthalmology';
  if (spec.includes('ent')) return 'ENT';
  if (spec.includes('urology')) return 'Urology';
  if (spec.includes('psychiatry')) return 'Psychiatry';
  if (spec.includes('dental')) return 'Dentistry';
  if (spec.includes('physiotherapy')) return 'Physiotherapy';

  // Query keyword fallback
  if (q.includes('pediatric') || q.includes('child')) return 'Pediatrics';
  if (q.includes('cardio') || q.includes('heart')) return 'Cardiology';
  if (q.includes('derma') || q.includes('skin')) return 'Dermatology';
  if (q.includes('ortho') || q.includes('bone') || q.includes('joint')) return 'Orthopedics';
  if (q.includes('neuro') || q.includes('brain')) return 'Neurology';
  if (q.includes('gyn') || q.includes('women')) return 'Gynecology';
  if (q.includes('gastro') || q.includes('stomach')) return 'Gastroenterology';
  if (q.includes('eye') || q.includes('vision')) return 'Ophthalmology';
  if (q.includes('ent') || q.includes('ear')) return 'ENT';
  if (q.includes('psych') || q.includes('mental')) return 'Psychiatry';
  if (q.includes('urology') || q.includes('kidney')) return 'Urology';

  // Amenity fallback
  const amenity = (tags['amenity'] || '').toLowerCase();
  if (amenity === 'hospital') return 'General Hospital';
  if (amenity === 'clinic') return 'General Clinic';
  if (amenity === 'dentist') return 'General Dentistry';

  return 'General Practice';
}

/**
 * Build Overpass QL query for nearby medical facilities.
 * If userLocation is provided, uses "around" search.
 * Otherwise, uses a bounding box over Egypt as fallback.
 */
function shouldApplyNameFilter(keywords: string): boolean {
  if (!keywords || keywords.trim().length < 2) return false;
  const lower = keywords.toLowerCase();

  return (
    !lower.includes('doctor') &&
    !lower.includes('dentist') &&
    !lower.includes('hospital') &&
    !lower.includes('عيادة') &&
    !lower.includes('مستشفى') &&
    !lower.includes('دكتور') &&
    !lower.includes('طبيب')
  );
}

function buildOverpassQuery(keywords: string, userLocation?: LatLng, radiusMeters = 15000): string {
  const kw = keywords.toLowerCase();

  // Determine which amenity types to search in priority order
  let amenityTypes: string[];
  if (kw.includes('dentist') || kw.includes('dental') || kw.includes('tooth') || kw.includes('أسنان') || kw.includes('ضرزري')) {
    amenityTypes = ['dentist'];
  } else if (kw.includes('physio') || kw.includes('therapy') || kw.includes('rehab') || kw.includes('علاج') || kw.includes('طبيعي')) {
    amenityTypes = ['physiotherapist'];
  } else {
    // Priority: individual doctors first, then clinics, then hospitals
    amenityTypes = ['doctor', 'doctors', 'clinic', 'hospital'];
  }

  const hasName = shouldApplyNameFilter(keywords);
  const nameFilter = hasName ? `["name"~"${escapeRegex(keywords)}", i]` : '';

  // Build grouped union in priority order
  const elements = ['node', 'way', 'relation'];
  const groups: string[] = [];
  for (const amenity of amenityTypes) {
    for (const el of elements) {
      groups.push(`${el}["amenity"="${amenity}"]${nameFilter}`);
    }
  }

  // Location: user location, or default to Egypt bounding box
  let bboxSuffix: string;
  if (userLocation) {
    const lat = userLocation.latitude;
    const lon = userLocation.longitude;
    bboxSuffix = `(around:${radiusMeters},${lat},${lon})`;
  } else {
    const { south, north, west, east } = EGYPT_BBOX;
    bboxSuffix = `(${south},${west},${north},${east})`;
  }

  const withLocation = groups.map(g => `${g}${bboxSuffix}`);

  return `[out:json][timeout:25];
(
  ${withLocation.join(';\n  ')};
);
out center 30;
`;
}

/** Escape a string for use in Overpass regex */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Overpass API Search (FREE, no API key) ──────────────────────────────────
const USER_AGENT = 'MedCare-App/1.0 (health-search; contact@medcare.app)';

function buildOverpassHeaders(contentType: string) {
  return {
    'Content-Type': contentType,
    'Accept': '*/*',
    'User-Agent': USER_AGENT,
  };
}

function fetchWithTimeout(url: string, init: RequestInit, timeoutMs = 8000): Promise<Response> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
  const requestInit = { ...init, signal: controller.signal };

  return fetch(url, requestInit).finally(() => clearTimeout(timeoutId));
}

function inferMajorFieldFromQuery(keywords: string): 'physician' | 'dentist' | 'physiotherapy' | 'unknown' {
  const q = keywords.toLowerCase();
  if (q.includes('dentist') || q.includes('dental') || q.includes('tooth')) return 'dentist';
  if (q.includes('physio') || q.includes('therapy') || q.includes('rehab')) return 'physiotherapy';
  if (q.includes('clinic') || q.includes('hospital') || q.includes('doctor') || q.includes('doctors')) return 'physician';
  return 'unknown';
}

async function fetchOverpassResponse(endpoint: string, overpassQuery: string): Promise<Response | null> {
  try {
    const res = await fetchWithTimeout(endpoint, {
      method: 'POST',
      headers: buildOverpassHeaders('application/x-www-form-urlencoded'),
      body: `data=${encodeURIComponent(overpassQuery)}`,
    }, 20000);

    if (res.ok) return res;

    if (res.status === 429) {
      console.warn('[places] Overpass rate-limited (429), skipping');
    } else {
      const bodyText = await res.text();
      console.warn(`[places] Overpass returned ${res.status}`);
      console.warn(bodyText.slice(0, 200));
    }
  } catch (innerErr) {
    console.warn('[places] Overpass request failed:', innerErr);
  }

  return null;
}

async function fetchPhotonResults(
  textQuery: string,
  effectiveLocation: LatLng,
  limit: number,
  osmTags?: string[]
): Promise<PlaceDoctor[]> {
  const url = new URL(PHOTON_API_URL);
  url.searchParams.set('q', textQuery);
  url.searchParams.set('limit', String(limit));
  url.searchParams.set('lat', String(effectiveLocation.latitude));
  url.searchParams.set('lon', String(effectiveLocation.longitude));
  url.searchParams.set('bbox', '25.0,22.0,37.0,32.0');

  if (osmTags) {
    for (const tag of osmTags) {
      url.searchParams.append('osm_tag', tag);
    }
  }

  try {
    const res = await fetchWithTimeout(url.toString(), {
      method: 'GET',
      headers: {
        Accept: 'application/json',
        'User-Agent': USER_AGENT,
      },
    }, 10000);

    if (!res.ok) {
      console.warn(`[places] Photon failed with ${res.status}`);
      return [];
    }

    const data = await res.json();
    const results: Array<PlaceDoctor | null> = (data.features || []).map((item: any) => {
      const lat = Number(item.geometry?.coordinates?.[1]);
      const lon = Number(item.geometry?.coordinates?.[0]);
      if (!lat || !lon) return null;

      const country = (item.properties?.country || '').toLowerCase();
      if (country && country !== 'egypt' && country !== 'مصر' && country !== 'eg') {
        return null;
      }

      const distance = calculateDistanceKm(effectiveLocation.latitude, effectiveLocation.longitude, lat, lon);

      const props = item.properties || {};
      const street = [props.street, props.housenumber].filter(Boolean).join(' ');
      const city = props.city || props.county || props.state || '';
      const addressCountry = props.country || '';

      return {
        placeId: `${props.osm_id}_${props.osm_type}`,
        full_name: props.name || props.street || textQuery,
        major_field: inferMajorFieldFromQuery(textQuery),
        sub_specialty: inferSubSpecialty((item.properties || {}) as Record<string, string>, textQuery),
        clinic_address: [street, city, addressCountry].filter(Boolean).join(', ') || 'Address not available',
        latitude: lat,
        longitude: lon,
        google_rating: 0,
        review_count: 0,
        distance_km: distance,
        isExternal: true,
        isOnMedCare: false,
      };
    });

    return results.filter((entry): entry is PlaceDoctor => entry !== null);
  } catch (err) {
    console.warn('[places] fetchPhotonResults failed:', err);
    return [];
  }
}

const MEDICAL_OSM_TAGS = [
  'amenity=doctor',
  'amenity=hospital',
  'amenity=clinic',
  'amenity=dentist',
  'amenity=physiotherapist',
  'amenity=doctors',
];

async function searchPhotonPlaces(query: string, userLocation?: LatLng, limit = 30): Promise<PlaceDoctor[]> {
  const textQuery = query.trim() || 'doctor';
  const effectiveLocation = userLocation ?? DEFAULT_EGYPT_LOCATION;

  let results = await fetchPhotonResults(textQuery, effectiveLocation, limit);

  // If specialty/name query found nothing, retry with generic "doctor" + medical tags
  // This ensures real medical POIs are found even when no place matches the exact query name
  if (results.length === 0 && textQuery !== 'doctor') {
    console.log('[places] Photon returned nothing for specific query, retrying with generic "doctor"');
    results = await fetchPhotonResults('doctor', effectiveLocation, limit, MEDICAL_OSM_TAGS);
  }

  return results.slice(0, limit);
}

function parseOverpassElements(data: any, query: string, userLocation?: LatLng): PlaceDoctor[] {
  const elements: any[] = data.elements || [];
  const results: PlaceDoctor[] = [];

  for (const el of elements) {
    const tags = el.tags || {};
    const name = tags.name || tags['name:en'] || '';

    if (!name || name.trim().length < 2) continue;

    const lat = el.lat ?? el.center?.lat;
    const lon = el.lon ?? el.center?.lon;
    if (lat == null || lon == null) continue;

    const distance = userLocation
      ? calculateDistanceKm(userLocation.latitude, userLocation.longitude, lat, lon)
      : undefined;

    results.push({
      placeId: String(el.id),
      full_name: name,
      major_field: mapOsmAmenity(tags.amenity),
      sub_specialty: inferSubSpecialty(tags, query),
      clinic_address: buildAddress(tags),
      latitude: lat,
      longitude: lon,
      google_rating: 0,
      review_count: 0,
      distance_km: distance,
      isExternal: true,
      isOnMedCare: false,
    });
  }

  return results;
}

export async function searchGooglePlaces(
  query: string,
  userLocation?: LatLng,
  radiusMeters = 15000
): Promise<PlaceDoctor[]> {
  const effectiveLocation = userLocation ?? DEFAULT_EGYPT_LOCATION;
  const overpassQuery = buildOverpassQuery(query, userLocation, radiusMeters);

  const res = await fetchOverpassResponse(OVERPASS_API_URL, overpassQuery);
  if (res) {
    try {
      const data = await res.json();
      const results = parseOverpassElements(data, query, effectiveLocation);

      results.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999));

      if (results.length > 0) return results;
    } catch (parseErr) {
      console.warn('[places] Failed to parse Overpass response:', parseErr);
    }
  }

  return await searchPhotonPlaces(query, effectiveLocation, 30);
}
