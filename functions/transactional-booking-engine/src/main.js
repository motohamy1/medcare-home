const sdk = require('node-appwrite');

/**
 * Transactional Booking Engine Appwrite Function
 * Handles highly concurrent, transaction-safe doctor appointment booking.
 * Triggers push notifications upon successful reservation.
 */
module.exports = async (context) => {
    // 1. Parse request body
    let payload = {};
    if (context.req.body) {
        payload = context.req.body;
        if (typeof payload === 'string') {
            try {
                payload = JSON.parse(payload);
            } catch (e) {
                context.error("Failed to parse body as JSON: " + payload);
            }
        }
    }

    const { slot_id, doctor_id, patient_profile_id, symptoms_notes } = payload;

    if (!slot_id || !doctor_id || !patient_profile_id) {
        context.error("Missing required parameters in request body.");
        return context.res.json({
            success: false,
            error: "Missing required parameters: slot_id, doctor_id, and patient_profile_id are required."
        }, 400);
    }

    // 2. Initialize Appwrite Client & Services
    const endpoint = process.env.APPWRITE_ENDPOINT || context.variables.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_PROJECT_ID || context.variables.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY || context.variables.APPWRITE_API_KEY;

    if (!projectId || !apiKey) {
        context.error("CRITICAL ERROR: Server configuration error. Missing project ID or API key.");
        return context.res.json({
            success: false,
            error: "Internal Server Configuration Error."
        }, 500);
    }

    const client = new sdk.Client()
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);

    const databases = new sdk.Databases(client);
    const messaging = new sdk.Messaging(client);

    const databaseId = 'Medical_Hub_Prod';
    
    // Concurrency Lock: We represent each slot's appointment uniquely by its slot_id.
    // By using "appt_" + slot_id as the document ID for the Appointments collection,
    // Appwrite's database layer guarantees that only ONE appointment can ever be created for a single slot.
    // This provides hard, unassailable concurrency safety.
    const appointmentDocId = `appt_${slot_id}`;

    context.log(`Attempting to book slot: ${slot_id} for doctor: ${doctor_id} and patient: ${patient_profile_id}`);

    let slot = null;
    try {
        // 3. Fetch slot to check availability
        slot = await databases.getDocument(databaseId, 'Schedule_Slots', slot_id);
    } catch (e) {
        context.error(`Failed to fetch slot ID ${slot_id}: ${e.message}`);
        return context.res.json({
            success: false,
            error: `Schedule slot not found: ${slot_id}`
        }, 404);
    }

    if (slot.status !== 'AVAILABLE') {
        context.log(`Slot ${slot_id} is already booked or locked. Current status: ${slot.status}`);
        return context.res.json({
            success: false,
            error: "Booking Conflict: Slot is already booked or locked by another patient."
        }, 409);
    }

    // 4. Optimistic locking / Transact phase
    try {
        console.log(`Locking slot: ${slot_id}...`);
        await databases.updateDocument(databaseId, 'Schedule_Slots', slot_id, {
            status: 'LOCKED'
        });
    } catch (e) {
        context.error(`Failed to lock slot ${slot_id}: ${e.message}`);
        return context.res.json({
            success: false,
            error: "Failed to secure slot. Please try again."
        }, 500);
    }

    // 5. Create the Appointment Document (Unique lock check)
    let appointment = null;
    try {
        context.log(`Creating Appointment document with ID: ${appointmentDocId}...`);
        
        // Document security: Enforce Read/Write ONLY by the patient and the doctor
        const permissions = [
            sdk.Permission.read(sdk.Role.user(patient_profile_id)), // Patient auth_id
            sdk.Permission.read(sdk.Role.user(doctor_id)),          // Doctor auth_id
            sdk.Permission.write(sdk.Role.user(patient_profile_id)),
            sdk.Permission.write(sdk.Role.user(doctor_id))
        ];

        appointment = await databases.createDocument(
            databaseId,
            'Appointments',
            appointmentDocId,
            {
                patient_profile_id,
                doctor_id,
                slot_id,
                symptoms_notes: symptoms_notes || '',
                status: 'PENDING'
            },
            permissions
        );

        context.log(`Appointment ${appointmentDocId} successfully created.`);

    } catch (e) {
        context.error(`Concurrency collision or failure creating appointment: ${e.message}`);
        
        // ROLLBACK: Release slot status back to AVAILABLE
        try {
            context.log(`ROLLBACK: Reverting slot ${slot_id} status back to AVAILABLE...`);
            await databases.updateDocument(databaseId, 'Schedule_Slots', slot_id, {
                status: 'AVAILABLE'
            });
        } catch (rollbackErr) {
            context.error(`CRITICAL ROLLBACK FAILURE for slot ${slot_id}: ${rollbackErr.message}`);
        }

        if (e.code === 409) {
            return context.res.json({
                success: false,
                error: "Booking Conflict: This slot was just booked by another user."
            }, 409);
        }

        return context.res.json({
            success: false,
            error: "Failed to create appointment document: " + e.message
        }, 500);
    }

    // 6. Complete Transaction: Update Slot status to BOOKED
    try {
        context.log(`Confirming slot booking status for slot ${slot_id}...`);
        await databases.updateDocument(databaseId, 'Schedule_Slots', slot_id, {
            status: 'BOOKED'
        });
    } catch (e) {
        context.error(`Failed to update slot status to BOOKED: ${e.message}`);
        // Note: The appointment is already created, so we shouldn't fail the entire request, but log the mismatch.
    }

    // 7. Trigger Messaging (Push Notification)
    try {
        context.log(`Sending Push Notification to Doctor (${doctor_id})...`);
        
        // In Appwrite, we can send push notifications to specific users
        // The doctor ID acts as their user/auth ID
        await messaging.createPush(
            sdk.ID.unique(),
            "New Appointment Booking Request",
            "A patient has requested an appointment. Please review and confirm on your dashboard.",
            [], // topics
            [doctor_id], // targeted users (doctor_id)
            [], // targets
            {
                appointmentId: appointmentDocId,
                patientProfileId: patient_profile_id,
                slotId: slot_id
            }
        );
        
        context.log("Push notification successfully sent.");
    } catch (e) {
        context.error(`Failed to send push notification to doctor: ${e.message}`);
        // Do not fail the booking request if only the push notification failed
    }

    return context.res.json({
        success: true,
        message: "Appointment successfully requested and slot reserved.",
        appointment: {
            appointment_id: appointment.$id,
            patient_profile_id: appointment.patient_profile_id,
            doctor_id: appointment.doctor_id,
            slot_id: appointment.slot_id,
            status: appointment.status
        }
    }, 201);
};
