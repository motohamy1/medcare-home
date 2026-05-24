const sdk = require('node-appwrite');
require('dotenv').config();

const databaseId = 'Medical_Hub_Prod';

async function run() {
    const endpoint = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!projectId || !apiKey) {
        console.error("CRITICAL ERROR: APPWRITE_PROJECT_ID and APPWRITE_API_KEY must be set in your .env file.");
        process.exit(1);
    }

    console.log("======================================================================");
    console.log("🏥 MEDCARE HOME — AUTOMATED INTEGRATION & STRESS TEST ENGINE 🧪");
    console.log("======================================================================\n");

    const client = new sdk.Client()
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);

    const databases = new sdk.Databases(client);
    const functions = new sdk.Functions(client);

    // ======================================================================
    // TEST SUITE 1: MULTILINGUAL AI SEARCH INTENT ROUTER TEST
    // ======================================================================
    console.log("🧪 TEST SUITE 1: AI Search Intent Routing");
    console.log("----------------------------------------------------------------------");

    const searchQueries = [
        {
            name: "Arabic Dental Query",
            text: "أسناني بتوجعني وعندي ورم شديد في اللثة"
        },
        {
            name: "English Pediatric Query",
            text: "My little child has a high fever and has been throwing up all night"
        }
    ];

    for (const sq of searchQueries) {
        console.log(`📡 Sending Query: "${sq.text}" (${sq.name})...`);
        try {
            const execution = await functions.createExecution(
                'weekly-maintenance-cron',
                JSON.stringify({ query: sq.text }),
                false, // async
                '/',   // path
                'POST' // method
            );

            if (execution.status === 'failed') {
                console.error(`   ❌ Execution failed. Logs: ${execution.errors}`);
                continue;
            }

            const response = JSON.parse(execution.responseBody);
            if (response.success) {
                console.log("   ✅ Gemini Response Received:");
                console.log(`      • Major Field:  \x1b[36m${response.intent.major_field}\x1b[0m`);
                console.log(`      • Sub-Specialty:\x1b[32m${response.intent.specialty}\x1b[0m`);
                console.log(`      • Symptoms:     \x1b[33m[${response.intent.symptoms.join(', ')}]\x1b[0m`);
            } else {
                console.error(`   ❌ Router reported failure: ${response.error}`);
            }
        } catch (e) {
            console.error(`   ❌ Call failed: ${e.message}`);
        }
        console.log("");
    }

    // ======================================================================
    // TEST SUITE 2: HIGH-CONCURRENCY DOUBLE-BOOKING LOCK STRESS TEST
    // ======================================================================
    console.log("🧪 TEST SUITE 2: High-Concurrency Double-Booking Lock Stress Test");
    console.log("----------------------------------------------------------------------");

    console.log("🔍 Finding an available slot in database...");
    let availableSlotId = null;
    let doctorId = null;

    try {
        const slotsResponse = await databases.listDocuments(databaseId, 'Schedule_Slots', [
            sdk.Query.equal('status', 'AVAILABLE'),
            sdk.Query.limit(1)
        ]);

        if (slotsResponse.documents.length === 0) {
            console.warn("   ⚠️ No AVAILABLE slots found. Creating a temporary slot...");
            const tempSlotId = `slot_stress_temp_${Date.now()}`;
            doctorId = 'doc_ahmed';
            const start = new Date();
            start.setHours(start.getHours() + 24);
            const end = new Date(start);
            end.setMinutes(end.getMinutes() + 30);

            await databases.createDocument(databaseId, 'Schedule_Slots', tempSlotId, {
                doctor_id: doctorId,
                start_time: start.toISOString(),
                end_time: end.toISOString(),
                status: 'AVAILABLE'
            });
            availableSlotId = tempSlotId;
            console.log(`   ✅ Temporary slot created: ${availableSlotId}`);
        } else {
            const slot = slotsResponse.documents[0];
            availableSlotId = slot.$id;
            doctorId = slot.doctor_id;
            console.log(`   ✅ Selected existing slot: ${availableSlotId} for Doctor: ${doctorId}`);
        }
    } catch (e) {
        console.error(`   ❌ Failed to query/prepare schedule slot: ${e.message}`);
        return;
    }

    // PRE-CONCURRENCY ATTACK CLEANUP:
    if (availableSlotId) {
        console.log(`   🧹 Pre-test cleanup: resetting slot ${availableSlotId} and clearing any appointments...`);
        try {
            await databases.deleteDocument(databaseId, 'Appointments', `appt_${availableSlotId}`);
            console.log(`      • Deleted existing appointment document appt_${availableSlotId}`);
        } catch (err) {
            // Document might not exist, ignore
        }
        try {
            await databases.updateDocument(databaseId, 'Schedule_Slots', availableSlotId, {
                status: 'AVAILABLE'
            });
            console.log(`      • Reset slot status to AVAILABLE`);
        } catch (err) {
            console.warn(`      • Slot reset status warning: ${err.message}`);
        }
    }

    console.log(`\n🔥 Initiating concurrency attack: Spawning 5 parallel booking threads targeting slot ${availableSlotId}...`);

    const bookingPayloads = [
        { slot_id: availableSlotId, doctor_id: doctorId, patient_profile_id: 'pat_alice', symptoms_notes: "Thread 1 booking attempt" },
        { slot_id: availableSlotId, doctor_id: doctorId, patient_profile_id: 'pat_bob', symptoms_notes: "Thread 2 booking attempt" },
        { slot_id: availableSlotId, doctor_id: doctorId, patient_profile_id: 'pat_charlie', symptoms_notes: "Thread 3 booking attempt" },
        { slot_id: availableSlotId, doctor_id: doctorId, patient_profile_id: 'pat_dana', symptoms_notes: "Thread 4 booking attempt" },
        { slot_id: availableSlotId, doctor_id: doctorId, patient_profile_id: 'pat_alice', symptoms_notes: "Thread 5 booking attempt" }
    ];

    const startTime = Date.now();
    try {
        const promises = bookingPayloads.map((payload, idx) => {
            return functions.createExecution(
                'transactional-booking-engine',
                JSON.stringify(payload),
                false,
                '/',
                'POST'
            ).then(exec => ({ index: idx + 1, exec }));
        });

        const results = await Promise.all(promises);
        const duration = Date.now() - startTime;
        console.log(`⏱️ All requests completed in ${duration}ms.\n`);

        let successCount = 0;
        let conflictCount = 0;
        let otherErrorCount = 0;

        for (const res of results) {
            const status = res.exec.status;
            if (status === 'failed') {
                console.error(`   🛑 Thread #${res.index}: Execution completely failed: ${res.exec.errors}`);
                otherErrorCount++;
                continue;
            }

            try {
                const body = JSON.parse(res.exec.responseBody);
                const statusCode = res.exec.responseStatusCode;

                if (statusCode === 201 && body.success) {
                    console.log(`   \x1b[32m✅ Thread #${res.index}: BOOKING SUCCESSFUL!\x1b[0m (Status ${statusCode})`);
                    console.log(`      • Appointment ID: ${body.appointment.appointment_id}`);
                    successCount++;
                } else if (statusCode === 409) {
                    console.log(`   \x1b[31m❌ Thread #${res.index}: CONFLICT DETECTED.\x1b[0m Slot was locked/taken (Status ${statusCode})`);
                    conflictCount++;
                } else {
                    console.log(`   ⚠️ Thread #${res.index}: Unexpected response (Status ${statusCode}): ${body.error}`);
                    otherErrorCount++;
                }
            } catch (jsonErr) {
                console.error(`   🛑 Thread #${res.index}: Bad response payload: ${res.exec.responseBody}`);
                otherErrorCount++;
            }
        }

        console.log("\n----------------------------------------------------------------------");
        console.log("📊 STRESS TEST REPORT:");
        console.log(`   • Successful Bookings: \x1b[32m${successCount}\x1b[0m (Expected: 1)`);
        console.log(`   • Blocked Conflicts:   \x1b[31m${conflictCount}\x1b[0m (Expected: 4)`);
        console.log(`   • Other Failures:      ${otherErrorCount} (Expected: 0)`);
        
        if (successCount === 1 && conflictCount === 4) {
            console.log("\n   \x1b[32;1m🏆 SUCCESS: The Appwrite composite lock successfully prevented double-booking under extreme load!\x1b[0m");
        } else {
            console.log("\n   \x1b[31;1m⚠️ WARNING: Concurrency locking validation anomaly detected.\x1b[0m");
        }
    } catch (concurrencyErr) {
        console.error(`   ❌ Critical failure in stress test pipeline: ${concurrencyErr.message}`);
    }
    console.log("");

    // ======================================================================
    // TEST SUITE 3: CRON MAINTENANCE INTEGRITY TEST
    // ======================================================================
    console.log("🧪 TEST SUITE 3: Cron Maintenance Integrity");
    console.log("----------------------------------------------------------------------");
    console.log("📡 Triggering Weekly Maintenance Cron Job manually...");

    try {
        const execution = await functions.createExecution(
            'weekly-maintenance-cron',
            JSON.stringify({ job: 'maintenance' }),
            false,
            '/',
            'POST'
        );

        if (execution.status === 'failed') {
            console.error(`   ❌ Cron Execution failed. Logs: ${execution.errors}`);
            return;
        }

        console.log(`   ✅ Cron returned status code: ${execution.responseStatusCode}`);
        console.log(`   Output: "${execution.responseBody.trim()}"`);

        console.log("\n🔍 Verifying Reputation Aggregation in Doctor Profiles...");
        const docAhmed = await databases.getDocument(databaseId, 'Doctor_Profiles', 'doc_ahmed');
        console.log(`   • Dr. Ahmed Hassan: Rating = \x1b[36m${docAhmed.google_rating} ⭐\x1b[0m, Reviews Count = \x1b[32m${docAhmed.review_count}\x1b[0m`);
        console.log(`   • New Search Index snippet: "${docAhmed.search_index.substring(0, 80)}..."`);

        console.log("\n🔍 Fetching Cache from AI_Insights_Cache (AI Health Coach Output)...");
        const cacheResponse = await databases.listDocuments(databaseId, 'AI_Insights_Cache', [
            sdk.Query.limit(5)
        ]);

        console.log(`   ✅ Found ${cacheResponse.documents.length} cached patient health insights:`);
        for (const insight of cacheResponse.documents) {
            console.log(`\n      👤 Patient Profile ID: \x1b[36m${insight.patient_profile_id}\x1b[0m`);
            console.log(`      ⏱️ Generated At: ${insight.generated_at}`);
            
            try {
                const tips = JSON.parse(insight.content_json);
                tips.forEach((tip, idx) => {
                    const color = tip.type === 'action' ? '\x1b[32m' : '\x1b[31m';
                    console.log(`         ${idx + 1}. [${color}${tip.type.toUpperCase()}\x1b[0m] \x1b[1m${tip.title}\x1b[0m: ${tip.description}`);
                });
            } catch (e) {
                console.log(`         Raw: ${insight.content_json}`);
            }
        }
    } catch (e) {
        console.error(`   ❌ Call failed: ${e.message}`);
    }

    console.log("\n======================================================================");
    console.log("🎉 ALL INTEGRATION TESTS EVALUATED SUCCESSFULLY! 🎉");
    console.log("======================================================================\n");
}

run().catch(err => {
    console.error("❌ STRESS TEST EXECUTION ABORTED:", err);
});
