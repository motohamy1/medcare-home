import { databases, ID, Query, Permission, Role, APPWRITE_CONFIG } from '@/lib/appwrite';

const { databaseId, collections } = APPWRITE_CONFIG;

// ─── Types ───────────────────────────────────────────────────────────────────
export type VitalCategory = 'bp' | 'heart_rate' | 'weight' | 'glucose';

export interface HealthMetric {
  $id: string;
  patient_profile_id: string;
  category: VitalCategory;
  value_primary: number;
  value_secondary: number | null;
  unit: string;
  measured_at: string;
  $createdAt: string;
}

export interface AIInsight {
  $id: string;
  patient_profile_id: string;
  generated_at: string;
  content_json: string;
}

// ─── Category Display Info ───────────────────────────────────────────────────
export const VITAL_DISPLAY: Record<VitalCategory, {
  label: string;
  emoji: string;
  unit: string;
  normalRange: string;
}> = {
  heart_rate: { label: 'Heart Rate', emoji: '❤️', unit: 'BPM', normalRange: '60–100' },
  bp:         { label: 'Blood Pressure', emoji: '🩺', unit: 'mmHg', normalRange: '90/60–120/80' },
  weight:     { label: 'Weight', emoji: '⚖️', unit: 'kg', normalRange: '—' },
  glucose:    { label: 'Blood Glucose', emoji: '💉', unit: 'mg/dL', normalRange: '70–100' },
};

// ─── Mutations ───────────────────────────────────────────────────────────────

/** Log a new vital reading (persists to Health_Metrics collection) */
export async function logVital(params: {
  patientProfileId: string;
  authId: string;
  category: VitalCategory;
  valuePrimary: number;
  valueSecondary?: number;
  unit: string;
}): Promise<HealthMetric> {
  const doc = await databases.createDocument(
    databaseId,
    collections.healthMetrics,
    ID.unique(),
    {
      patient_profile_id: params.patientProfileId,
      category: params.category,
      value_primary: params.valuePrimary,
      value_secondary: params.valueSecondary ?? null,
      unit: params.unit,
      measured_at: new Date().toISOString(),
    },
    // DLS: only the owner can access this document
    [
      Permission.read(Role.user(params.authId)),
      Permission.update(Role.user(params.authId)),
      Permission.delete(Role.user(params.authId)),
    ]
  );
  return doc as unknown as HealthMetric;
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Get recent vitals for a patient, ordered newest first */
export async function getRecentVitals(
  patientProfileId: string,
  limit = 20
): Promise<HealthMetric[]> {
  const { documents } = await databases.listDocuments(
    databaseId,
    collections.healthMetrics,
    [
      Query.equal('patient_profile_id', patientProfileId),
      Query.orderDesc('measured_at'),
      Query.limit(limit),
    ]
  );
  return documents as unknown as HealthMetric[];
}

/** Get the latest reading for each vital category */
export async function getLatestVitals(
  patientProfileId: string
): Promise<Partial<Record<VitalCategory, HealthMetric>>> {
  const allRecent = await getRecentVitals(patientProfileId, 50);
  const latest: Partial<Record<VitalCategory, HealthMetric>> = {};

  for (const metric of allRecent) {
    if (!latest[metric.category]) {
      latest[metric.category] = metric;
    }
  }

  return latest;
}

/** Get the latest AI health insight for a patient */
export async function getHealthInsight(
  patientProfileId: string
): Promise<AIInsight | null> {
  try {
    const { documents } = await databases.listDocuments(
      databaseId,
      collections.aiInsightsCache,
      [
        Query.equal('patient_profile_id', patientProfileId),
        Query.orderDesc('generated_at'),
        Query.limit(1),
      ]
    );
    return documents.length > 0 ? (documents[0] as unknown as AIInsight) : null;
  } catch {
    return null;
  }
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Format a vital value for display */
export function formatVitalValue(metric: HealthMetric): string {
  if (metric.category === 'bp' && metric.value_secondary != null) {
    return `${metric.value_primary}/${metric.value_secondary}`;
  }
  return `${metric.value_primary}`;
}

/** Determine vital status (Normal, High, Low) based on category */
export function getVitalStatus(metric: HealthMetric): 'Normal' | 'High' | 'Low' | 'Excellent' {
  switch (metric.category) {
    case 'heart_rate':
      if (metric.value_primary < 60) return 'Low';
      if (metric.value_primary > 100) return 'High';
      return 'Normal';
    case 'bp':
      if (metric.value_primary > 140) return 'High';
      if (metric.value_primary < 90) return 'Low';
      return metric.value_primary <= 120 ? 'Excellent' : 'Normal';
    case 'glucose':
      if (metric.value_primary > 100) return 'High';
      if (metric.value_primary < 70) return 'Low';
      return 'Normal';
    default:
      return 'Normal';
  }
}

/** Get relative time string (e.g., "2 mins ago") */
export function getRelativeTime(isoDate: string): string {
  const now = Date.now();
  const then = new Date(isoDate).getTime();
  const diffMs = now - then;

  const mins = Math.floor(diffMs / 60000);
  if (mins < 1) return 'Just now';
  if (mins < 60) return `${mins} min${mins > 1 ? 's' : ''} ago`;

  const hours = Math.floor(mins / 60);
  if (hours < 24) return `${hours} hour${hours > 1 ? 's' : ''} ago`;

  const days = Math.floor(hours / 24);
  if (days === 1) return 'Yesterday';
  return `${days} days ago`;
}
