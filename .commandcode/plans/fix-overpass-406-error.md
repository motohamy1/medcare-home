# Fix Overpass API 406 Error on Pediatric Search

## Problem
Searching "pediateric" (or "pediatric") causes a 406 Not Acceptable error from Overpass API because:
1. No specialty branch exists for pediatric keywords, so the name filter incorrectly activates
2. The query is sent via GET, which fails on complex queries due to URL length/encoding

## File to Modify
`mobile-app/src/lib/places.ts`

## Changes

### 1. Add pediatric specialty branch in `buildOverpassQuery` (~line 100)
Before the default `else` block, add:
```ts
} else if (kw.includes('pediatric') || kw.includes('pediat') || kw.includes('child')) {
  amenityFilters = '["amenity"~"doctors|doctor|hospital|clinic"]["healthcare:speciality"~"pediatrics", i]';
}
```

### 2. Expand the medical keywords blocklist for `hasName` (~line 108)
Replace the current `hasName` check:
```ts
const medicalKeywords = [
  'doctor','dentist','hospital','clinic','pediatric','pediat','child',
  'cardio','heart','derma','skin','ortho','bone','neuro','gyn','eye',
  'ent','ear','psych','urology','kidney','gastro','stomach','physio',
  'therapy','rehab'
];
const hasName = keywords.length >= 3 && !medicalKeywords.some(mk => kw.includes(mk));
```

### 3. Switch fetch from GET to POST in `searchGooglePlaces` (~line 140)
```ts
const res = await fetch(OVERPASS_API_URL, {
  method: 'POST',
  headers: {
    'Content-Type': 'application/x-www-form-urlencoded',
    'Accept': 'application/json',
  },
  body: `data=${encodeURIComponent(overpassQuery)}`,
});
```

## Verification
- Search "pediatric" → returns pediatric clinics, no 406
- Search "pediateric" (misspelling) → gracefully returns empty or fallback results
- Search "Dr Ahmed" → name filter still activates for proper name searches
- Search "dentist" → still returns dentist results
