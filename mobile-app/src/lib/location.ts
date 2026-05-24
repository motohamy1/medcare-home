import * as Location from 'expo-location';

// ngeohash has no @types package, use require
const ngeohash = require('ngeohash');

// ─── Types ───────────────────────────────────────────────────────────────────
export interface LatLng {
  latitude: number;
  longitude: number;
}

export interface LocationResult {
  granted: boolean;
  location: LatLng | null;
  error?: string;
}

// ─── Permission ──────────────────────────────────────────────────────────────
export async function requestLocationPermission(): Promise<boolean> {
  const { status } = await Location.requestForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

export async function checkLocationPermission(): Promise<boolean> {
  const { status } = await Location.getForegroundPermissionsAsync();
  return status === Location.PermissionStatus.GRANTED;
}

// ─── Current Location ────────────────────────────────────────────────────────
export async function getCurrentLocation(): Promise<LocationResult> {
  try {
    const hasPermission = await checkLocationPermission();
    if (!hasPermission) {
      const granted = await requestLocationPermission();
      if (!granted) {
        return { granted: false, location: null, error: 'Location permission denied' };
      }
    }

    const position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.Balanced,
    });

    return {
      granted: true,
      location: {
        latitude: position.coords.latitude,
        longitude: position.coords.longitude,
      },
    };
  } catch (err: any) {
    console.error('[Location] Failed to get location:', err);
    return { granted: false, location: null, error: err?.message || 'Unknown location error' };
  }
}

// ─── Geohash ─────────────────────────────────────────────────────────────────
export function decodeGeohash(geohash: string): LatLng | null {
  try {
    if (!geohash || geohash.length < 4) return null;
    const decoded = ngeohash.decode(geohash);
    return {
      latitude: decoded.latitude,
      longitude: decoded.longitude,
    };
  } catch (err) {
    console.error('[Location] Failed to decode geohash:', geohash, err);
    return null;
  }
}

// ─── Haversine Distance ──────────────────────────────────────────────────────
export function calculateDistanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number
): number {
  const R = 6371; // Earth radius in km
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) *
      Math.cos(toRad(lat2)) *
      Math.sin(dLon / 2) *
      Math.sin(dLon / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return parseFloat((R * c).toFixed(1));
}

function toRad(deg: number): number {
  return deg * (Math.PI / 180);
}

// ─── Format Distance for UI ──────────────────────────────────────────────────
export function formatDistance(km: number): string {
  if (km < 1) {
    return `${Math.round(km * 1000)} m`;
  }
  if (km < 10) {
    return `${km.toFixed(1)} km`;
  }
  return `${Math.round(km)} km`;
}
