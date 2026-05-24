import {
  Client,
  Account,
  Databases,
  Functions,
  Storage,
  ID,
  Query,
  Permission,
  Role,
  ExecutionMethod,
} from 'react-native-appwrite';

// ─── Appwrite Project Configuration ──────────────────────────────────────────
export const APPWRITE_CONFIG = {
  endpoint: 'https://fra.cloud.appwrite.io/v1',
  projectId: 'medcarehome',
  databaseId: 'Medical_Hub_Prod',

  // Collection IDs (match setup-appwrite-db.js)
  collections: {
    patientProfiles: 'Patient_Profiles',
    doctorProfiles: 'Doctor_Profiles',
    scheduleSlots: 'Schedule_Slots',
    appointments: 'Appointments',
    patientConditions: 'Patient_Conditions',
    healthMetrics: 'Health_Metrics',
    aiInsightsCache: 'AI_Insights_Cache',
    patientReviews: 'Patient_Reviews',
    vaultMetadata: 'Vault_Metadata',
  },

  // Serverless Function IDs (match appwrite.json)
  functions: {
    bookingEngine: 'transactional-booking-engine',
    maintenanceCron: 'weekly-maintenance-cron',
  },

  // Storage Bucket IDs
  buckets: {
    medicalVault: 'Medical_Vault',
  },

  // Mobile platform identifier (must match Appwrite console registration)
  androidPackage: 'com.medcarehome.mobileapp',
} as const;

// ─── Singleton Client ────────────────────────────────────────────────────────
const client = new Client()
  .setEndpoint(APPWRITE_CONFIG.endpoint)
  .setProject(APPWRITE_CONFIG.projectId)
  .setPlatform(APPWRITE_CONFIG.androidPackage);

// ─── Service Instances ───────────────────────────────────────────────────────
export const account = new Account(client);
export const databases = new Databases(client);
export const functions = new Functions(client);
export const storage = new Storage(client);

// ─── Re-exports ──────────────────────────────────────────────────────────────
export { ID, Query, Permission, Role, ExecutionMethod };
export default client;
