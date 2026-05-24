import { databases, functions, Query, ExecutionMethod, APPWRITE_CONFIG } from '@/lib/appwrite';

const { databaseId, collections, functions: fns } = APPWRITE_CONFIG;

// ─── Types ───────────────────────────────────────────────────────────────────
export interface ScheduleSlot {
  $id: string;
  doctor_id: string;
  start_time: string;
  end_time: string;
  status: 'AVAILABLE' | 'LOCKED' | 'BOOKED';
}

export interface Appointment {
  $id: string;
  patient_profile_id: string;
  doctor_id: string;
  slot_id: string;
  symptoms_notes: string;
  status: 'PENDING' | 'CONFIRMED' | 'COMPLETED' | 'CANCELLED' | 'NO_SHOW';
  $createdAt: string;
}

export interface BookingResult {
  success: boolean;
  message?: string;
  error?: string;
  appointment?: {
    appointment_id: string;
    patient_profile_id: string;
    doctor_id: string;
    slot_id: string;
    status: string;
  };
  notifications?: {
    push: string;
    email: string;
  };
}

// ─── Queries ─────────────────────────────────────────────────────────────────

/** Fetch available time slots for a specific doctor (future slots only) */
export async function getAvailableSlots(doctorId: string): Promise<ScheduleSlot[]> {
  const { documents } = await databases.listDocuments(
    databaseId,
    collections.scheduleSlots,
    [
      Query.equal('doctor_id', doctorId),
      Query.equal('status', 'AVAILABLE'),
      Query.greaterThan('start_time', new Date().toISOString()),
      Query.orderAsc('start_time'),
      Query.limit(30),
    ]
  );
  return documents as unknown as ScheduleSlot[];
}

/**
 * Book an appointment through the Transactional Booking Engine.
 * This calls the serverless function which handles:
 * - Concurrency locking
 * - DLS permission assignment
 * - Push notification + email to doctor
 */
export async function bookAppointment(params: {
  slotId: string;
  doctorId: string;
  patientProfileId: string;
  symptomsNotes?: string;
}): Promise<BookingResult> {
  const execution = await functions.createExecution(
    fns.bookingEngine,
    JSON.stringify({
      slot_id: params.slotId,
      doctor_id: params.doctorId,
      patient_profile_id: params.patientProfileId,
      symptoms_notes: params.symptomsNotes || '',
    }),
    false, // synchronous execution
    '/',
    ExecutionMethod.POST
  );

  return JSON.parse(execution.responseBody) as BookingResult;
}

/** Get all appointments for a patient profile */
export async function getMyAppointments(patientProfileId: string): Promise<Appointment[]> {
  const { documents } = await databases.listDocuments(
    databaseId,
    collections.appointments,
    [
      Query.equal('patient_profile_id', patientProfileId),
      Query.orderDesc('$createdAt'),
    ]
  );
  return documents as unknown as Appointment[];
}

/** Get upcoming (non-completed/cancelled) appointments count */
export async function getUpcomingAppointmentsCount(patientProfileId: string): Promise<number> {
  const { total } = await databases.listDocuments(
    databaseId,
    collections.appointments,
    [
      Query.equal('patient_profile_id', patientProfileId),
      Query.equal('status', ['PENDING', 'CONFIRMED']),
      Query.limit(1), // We only need the count
    ]
  );
  return total;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** Group slots by date for calendar display */
export function groupSlotsByDate(slots: ScheduleSlot[]): Map<string, ScheduleSlot[]> {
  const grouped = new Map<string, ScheduleSlot[]>();
  for (const slot of slots) {
    const dateKey = slot.start_time.split('T')[0]; // "2026-10-04"
    const existing = grouped.get(dateKey) || [];
    existing.push(slot);
    grouped.set(dateKey, existing);
  }
  return grouped;
}

/** Format a slot time for display (e.g., "2:00 PM") */
export function formatSlotTime(isoTime: string): string {
  const date = new Date(isoTime);
  return date.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}
