import { calculateDistanceKm, type LatLng } from '@/lib/location';

const OVERPASS_API_URL = 'https://overpass-api.de/api/interpreter';

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
function buildOverpassQuery(keywords: string, userLocation?: LatLng, radiusMeters = 15000): string {
  const kw = keywords.toLowerCase();

  // Determine which amenity types to search
  let amenityFilters = '';
  if (kw.includes('dentist') || kw.includes('dental') || kw.includes('tooth')) {
    amenityFilters = '["amenity"="dentist"]';
  } else if (kw.includes('physio') || kw.includes('therapy') || kw.includes('rehab')) {
    amenityFilters = '["amenity"="physiotherapist"]';
  } else {
    // Default: search all medical types
    amenityFilters = '["amenity"~"doctors|doctor|hospital|clinic"]';
  }

  // Also search by name if query looks like a proper name
  const hasName = keywords.length >= 3 && !kw.includes('doctor') && !kw.includes('dentist') && !kw.includes('hospital');
  const nameFilter = hasName ? `["name"~"${escapeRegex(keywords)}", i]` : '';

  // Combine all filters
  const allFilters = `${amenityFilters}${nameFilter}`;

  if (userLocation) {
    const lat = userLocation.latitude;
    const lon = userLocation.longitude;
    const r = radiusMeters;

    return `[out:json][timeout:20];
(
  node${allFilters}(around:${r},${lat},${lon});
  way${allFilters}(around:${r},${lat},${lon});
  relation${allFilters}(around:${r},${lat},${lon});
);
out center 30;
`;
  } else {
    // No location: search globally (useful for named searches like "Dr Ahmed")
    // Limit to 30 results to avoid timeouts
    return `[out:json][timeout:20];
(
  node${allFilters};
  way${allFilters};
  relation${allFilters};
);
out center 30;
`;
  }
}

/** Escape a string for use in Overpass regex */
function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// ─── Overpass API Search (FREE, no API key) ──────────────────────────────────
export async function searchGooglePlaces(
  query: string,
  userLocation?: LatLng,
  radiusMeters = 15000
): Promise<PlaceDoctor[]> {
  const overpassQuery = buildOverpassQuery(query, userLocation, radiusMeters);

  try {
    const res = await fetch(OVERPASS_API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'Accept': 'application/json',
      },
      body: new URLSearchParams({ data: overpassQuery }).toString(),
    });

    if (!res.ok) {
      const errText = await res.text();
      console.error('[places] Overpass API error:', res.status, errText.slice(0, 300));
      return [];
    }

    const data = await res.json();
    const elements: any[] = data.elements || [];

    const results: PlaceDoctor[] = [];

    for (const el of elements) {
      const tags = el.tags || {};
      const name = tags.name || tags['name:en'] || '';

      // Skip unnamed entries
      if (!name || name.trim().length < 2) continue;

      // Get coordinates: nodes have lat/lon directly; ways/relations have center
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

    // Sort by distance if we have location, otherwise keep OSM order
    if (userLocation) {
      results.sort((a, b) => (a.distance_km ?? 999) - (b.distance_km ?? 999));
    }

    return results;
  } catch (err) {
    console.error('[places] Failed to fetch Overpass data:', err);
    return [];
  }
}
