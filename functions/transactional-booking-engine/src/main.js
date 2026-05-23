const sdk = require('node-appwrite');

/**
 * Transactional Booking Engine Appwrite Function
 * Handles highly concurrent, transaction-safe doctor appointment booking.
 * Triggers push notifications and transactional emails (Resend SMTP) to the doctor upon successful reservation.
 * Enforces strict Document-Level Security using the patient's auth_id (not profile document ID) for permissions.
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

    // 4. Verify patient profile ownership and resolve auth_id
    let patientAuthId = null;
    try {
        const patientProfile = await databases.getDocument(databaseId, 'Patient_Profiles', patient_profile_id);
        patientAuthId = patientProfile.auth_id;
        if (!patientAuthId) {
            throw new Error("Patient profile does not have a valid auth_id.");
        }

        // SECURITY: If this function is called by an authenticated user (not server-side API key),
        // verify the caller owns the requested patient profile.
        const callerUserId = context.req.headers['x-appwrite-user-id'] || null;
        if (callerUserId && callerUserId !== patientAuthId) {
            context.error(`SECURITY VIOLATION: Caller (${callerUserId}) attempted to book for patient profile owned by (${patientAuthId}).`);
            return context.res.json({
                success: false,
                error: "Forbidden: You can only book appointments for your own patient profiles."
            }, 403);
        }

        context.log(`Resolved patient auth_id: ${patientAuthId}`);
    } catch (e) {
        context.error(`Failed to resolve patient profile ${patient_profile_id}: ${e.message}`);
        return context.res.json({
            success: false,
            error: `Invalid patient profile: ${patient_profile_id}`
        }, 400);
    }

    // 5. Optimistic locking / Transact phase
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

    // 6. Create the Appointment Document (Unique lock check)
    let appointment = null;
    try {
        context.log(`Creating Appointment document with ID: ${appointmentDocId}...`);
        
        // Document security: Enforce Read/Write ONLY by the patient's auth_id and the doctor's auth_id.
        // CRITICAL: We use patientAuthId (the Appwrite Auth user ID), NOT patient_profile_id (the document ID).
        const permissions = [
            sdk.Permission.read(sdk.Role.user(patientAuthId)),
            sdk.Permission.read(sdk.Role.user(doctor_id)),
            sdk.Permission.write(sdk.Role.user(patientAuthId)),
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

    // 7. Trigger Messaging (Push Notification to Doctor)
    let pushStatus = 'pending';
    try {
        context.log(`Sending Push Notification to Doctor (${doctor_id})...`);
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
        pushStatus = 'sent';
        context.log("Push notification successfully sent.");
    } catch (e) {
        pushStatus = 'failed';
        context.error(`Failed to send push notification to doctor: ${e.message}`);
        // Do not fail the booking request if only the push notification failed
    }

    // 8. Send Transactional Email Confirmation to Doctor
    let emailStatus = 'pending';
    try {
        context.log(`Sending transactional email confirmation to Doctor (${doctor_id})...`);

        // Fetch doctor profile to personalize email
        let doctorName = 'Doctor';
        try {
            const doctorProfile = await databases.getDocument(databaseId, 'Doctor_Profiles', doctor_id);
            doctorName = doctorProfile.full_name || doctorName;
        } catch (profileErr) {
            context.log(`Could not fetch doctor profile for email personalization: ${profileErr.message}`);
        }

        // Fetch patient profile to include in email
        let patientName = 'A patient';
        try {
            const patientProfile = await databases.getDocument(databaseId, 'Patient_Profiles', patient_profile_id);
            patientName = patientProfile.full_name || patientName;
        } catch (profileErr) {
            context.log(`Could not fetch patient profile for email personalization: ${profileErr.message}`);
        }

        const emailHtml = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; border: 1px solid #e0e0e0; border-radius: 8px;">
            <h2 style="color: #2c3e50;">New Appointment Booking</h2>
            <p>Hello Dr. ${doctorName},</p>
            <p><strong>${patientName}</strong> has requested a new appointment through Medical Care Hub.</p>
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
            <p><strong>Appointment ID:</strong> ${appointmentDocId}</p>
            <p><strong>Slot ID:</strong> ${slot_id}</p>
            <p><strong>Status:</strong> PENDING (awaiting your confirmation)</p>
            ${symptoms_notes ? `<p><strong>Patient Notes:</strong> ${symptoms_notes}</p>` : ''}
            <hr style="border: none; border-top: 1px solid #e0e0e0; margin: 20px 0;" />
            <p style="color: #666; font-size: 12px;">This is an automated message from Medical Care Hub. Please log in to your dashboard to confirm or manage this appointment.</p>
        </div>
        `;

        await messaging.createEmail(
            sdk.ID.unique(),
            `New Appointment Request — ${appointmentDocId}`,
            emailHtml,
            [], // topics
            [doctor_id], // targeted users
            [], // targets
            [], // cc
            [], // bcc
            [], // attachments
            false, // draft
            true, // html = true (content is HTML)
            appointmentDocId // replyTo (optional)
        );

        emailStatus = 'sent';
        context.log("Transactional email successfully sent.");
    } catch (e) {
        emailStatus = 'failed';
        context.error(`Failed to send transactional email to doctor: ${e.message}`);
        // Do not fail the booking request if only the email failed
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
        },
        notifications: {
            push: pushStatus,
            email: emailStatus
        }
    }, 201);
};
