import { databases, Query, APPWRITE_CONFIG } from '@/lib/appwrite';

const { databaseId, collections } = APPWRITE_CONFIG;

// ─── Types ───────────────────────────────────────────────────────────────────
export interface PatientCondition {
  $id: string;
  patient_profile_id: string;
  name: string;
  status: 'active' | 'managed' | 'resolved';
}

export interface VaultFile {
  $id: string;
  patient_profile_id: string;
  file_id: string;
  title: string;
  category: 'lab_result' | 'imaging' | 'prescription';
  upload_date: string;
}

// ─── Profile Queries ─────────────────────────────────────────────────────────

/** Get all patient profiles for a user (self + dependents like child, spouse, parent) */
export async function getProfiles(authId: string) {
  const { documents } = await databases.listDocuments(
    databaseId,
    collections.patientProfiles,
    [Query.equal('auth_id', authId)]
  );
  return documents;
}

/** Update patient profile fields */
export async function updateProfile(profileId: string, data: Record<string, unknown>) {
  return databases.updateDocument(
    databaseId,
    collections.patientProfiles,
    profileId,
    data
  );
}

// ─── Conditions ──────────────────────────────────────────────────────────────

/** Get all conditions for a patient profile */
export async function getConditions(patientProfileId: string): Promise<PatientCondition[]> {
  const { documents } = await databases.listDocuments(
    databaseId,
    collections.patientConditions,
    [Query.equal('patient_profile_id', patientProfileId)]
  );
  return documents as unknown as PatientCondition[];
}

// ─── Vault (Medical Documents) ───────────────────────────────────────────────

/** Get medical document metadata for a patient */
export async function getVaultFiles(patientProfileId: string): Promise<VaultFile[]> {
  const { documents } = await databases.listDocuments(
    databaseId,
    collections.vaultMetadata,
    [
      Query.equal('patient_profile_id', patientProfileId),
      Query.orderDesc('upload_date'),
    ]
  );
  return documents as unknown as VaultFile[];
}

// ─── Stats (for Profile Screen) ─────────────────────────────────────────────

/** Get total appointment count for a patient */
export async function getTotalAppointments(patientProfileId: string): Promise<number> {
  const { total } = await databases.listDocuments(
    databaseId,
    collections.appointments,
    [
      Query.equal('patient_profile_id', patientProfileId),
      Query.limit(1),
    ]
  );
  return total;
}
