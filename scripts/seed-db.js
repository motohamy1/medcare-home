const sdk = require('node-appwrite');
require('dotenv').config();

const databaseId = 'Medical_Hub_Prod';

// Zero-dependency Geohash encoder function for premium coordinate indexing
function encodeGeohash(latitude, longitude, precision = 9) {
    const BASE32 = "0123456789bcdefghjkmnpqrstuvwxyz";
    let latMin = -90, latMax = 90;
    let lonMin = -180, lonMax = 180;
    let geohash = "";
    let isEven = true;
    let bit = 0;
    let ch = 0;

    while (geohash.length < precision) {
        let mid;
        if (isEven) {
            mid = (lonMin + lonMax) / 2;
            if (longitude > mid) {
                ch |= (1 << (4 - bit));
                lonMin = mid;
            } else {
                lonMax = mid;
            }
        } else {
            mid = (latMin + latMax) / 2;
            if (latitude > mid) {
                ch |= (1 << (4 - bit));
                latMin = mid;
            } else {
                latMax = mid;
            }
        }

        isEven = !isEven;
        if (bit < 4) {
            bit++;
        } else {
            geohash += BASE32[ch];
            bit = 0;
            ch = 0;
        }
    }
    return geohash;
}

async function clearCollection(databases, collectionId) {
    console.log(`🧹 Clearing collection: ${collectionId}...`);
    try {
        const response = await databases.listDocuments(databaseId, collectionId, [
            sdk.Query.limit(100)
        ]);
        for (const doc of response.documents) {
            await databases.deleteDocument(databaseId, collectionId, doc.$id);
        }
        console.log(`   Cleared ${response.documents.length} existing documents.`);
    } catch (e) {
        console.warn(`   Warning/Error clearing ${collectionId}:`, e.message);
    }
}

async function run() {
    const endpoint = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!projectId || !apiKey) {
        console.error("CRITICAL ERROR: APPWRITE_PROJECT_ID and APPWRITE_API_KEY must be set in your .env file.");
        process.exit(1);
    }

    console.log(`Connecting to Appwrite Endpoint: ${endpoint}`);
    console.log(`Seeding Database: ${databaseId} for Project ID: ${projectId}`);

    const client = new sdk.Client()
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);

    const databases = new sdk.Databases(client);

    // 1. Verify Database Exists
    try {
        await databases.get(databaseId);
        console.log(`✅ Verified Database "${databaseId}" is active.`);
    } catch (e) {
        console.error(`❌ Database "${databaseId}" not found. Please run "npm run setup" first.`);
        process.exit(1);
    }

    // 2. Clear Existing Data (reverse-dependency order)
    const collectionsToClear = [
        'AI_Insights_Cache',
        'Patient_Reviews',
        'Appointments',
        'Schedule_Slots',
        'Health_Metrics',
        'Patient_Conditions',
        'Vault_Metadata',
        'Doctor_Profiles',
        'Patient_Profiles'
    ];

    for (const colId of collectionsToClear) {
        await clearCollection(databases, colId);
    }

    console.log('\n🌱 Starting High-Fidelity Seeding Process...');

    // 3. Seed Patient Profiles
    console.log('👥 Seeding Patient Profiles...');
    const patients = [
        {
            id: 'pat_alice',
            data: {
                auth_id: 'usr_alice_123',
                is_primary: true,
                relationship: 'self',
                full_name: 'Alice Smith',
                date_of_birth: new Date('1990-05-15T00:00:00.000Z').toISOString(),
                gender: 'female',
                blood_type: 'A+',
                governorate: 'Cairo',
                district: 'Heliopolis'
            }
        },
        {
            id: 'pat_bob',
            data: {
                auth_id: 'usr_alice_123', // Child linked to Alice's auth_id
                is_primary: false,
                relationship: 'child',
                full_name: 'Bob Smith',
                date_of_birth: new Date('2018-08-20T00:00:00.000Z').toISOString(),
                gender: 'male',
                blood_type: 'O+',
                governorate: 'Cairo',
                district: 'Heliopolis'
            }
        },
        {
            id: 'pat_charlie',
            data: {
                auth_id: 'usr_charlie_456',
                is_primary: true,
                relationship: 'self',
                full_name: 'Charlie Davis',
                date_of_birth: new Date('1975-11-10T00:00:00.000Z').toISOString(),
                gender: 'male',
                blood_type: 'B-',
                governorate: 'Giza',
                district: 'Dokki'
            }
        },
        {
            id: 'pat_dana',
            data: {
                auth_id: 'usr_dana_789',
                is_primary: true,
                relationship: 'self',
                full_name: 'Dana Evans',
                date_of_birth: new Date('1982-03-30T00:00:00.000Z').toISOString(),
                gender: 'female',
                blood_type: 'AB+',
                governorate: 'Alexandria',
                district: 'Smouha'
            }
        }
    ];

    for (const pat of patients) {
        await databases.createDocument(databaseId, 'Patient_Profiles', pat.id, pat.data);
        console.log(`   - Created Patient: ${pat.data.full_name} (${pat.id})`);
    }

    // 4. Seed Patient Conditions
    console.log('🩺 Seeding Patient Conditions...');
    const conditions = [
        { id: 'cond_1', data: { patient_profile_id: 'pat_alice', name: 'Hypertension', status: 'active' } },
        { id: 'cond_2', data: { patient_profile_id: 'pat_charlie', name: 'Type 2 Diabetes', status: 'managed' } },
        { id: 'cond_3', data: { patient_profile_id: 'pat_charlie', name: 'Hyperlipidemia', status: 'active' } },
        { id: 'cond_4', data: { patient_profile_id: 'pat_dana', name: 'Asthma', status: 'active' } }
    ];

    for (const cond of conditions) {
        await databases.createDocument(databaseId, 'Patient_Conditions', cond.id, cond.data);
        console.log(`   - Added Condition: ${cond.data.name} for ${cond.data.patient_profile_id}`);
    }

    // 5. Seed Health Metrics (Telemetry)
    console.log('📊 Seeding Health Metrics (7 Days History)...');
    const now = new Date();
    const metrics = [];

    // Alice: Hypertension tracking (Elevated blood pressure logs)
    for (let i = 0; i < 7; i++) {
        const measuredAt = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString();
        metrics.push({
            id: `metric_alice_bp_${i}`,
            data: {
                patient_profile_id: 'pat_alice',
                category: 'bp',
                value_primary: 135 + Math.floor(Math.random() * 10) - 5, // Systolic
                value_secondary: 85 + Math.floor(Math.random() * 6) - 3, // Diastolic
                unit: 'mmHg',
                measured_at: measuredAt
            }
        });
        metrics.push({
            id: `metric_alice_hr_${i}`,
            data: {
                patient_profile_id: 'pat_alice',
                category: 'heart_rate',
                value_primary: 76 + Math.floor(Math.random() * 8) - 4,
                unit: 'bpm',
                measured_at: measuredAt
            }
        });
    }

    // Charlie: Diabetes tracking (Unstable glucose level logs)
    for (let i = 0; i < 7; i++) {
        const measuredAt = new Date(now.getTime() - i * 24 * 60 * 60 * 1000).toISOString();
        metrics.push({
            id: `metric_charlie_gl_${i}`,
            data: {
                patient_profile_id: 'pat_charlie',
                category: 'glucose',
                value_primary: 145 + Math.floor(Math.random() * 40) - 20, // fasting blood glucose
                unit: 'mg/dL',
                measured_at: measuredAt
            }
        });
    }

    // Dana: Weight tracking
    metrics.push({
        id: 'metric_dana_wt',
        data: {
            patient_profile_id: 'pat_dana',
            category: 'weight',
            value_primary: 68.5,
            unit: 'kg',
            measured_at: now.toISOString()
        }
    });

    for (const m of metrics) {
        await databases.createDocument(databaseId, 'Health_Metrics', m.id, m.data);
    }
    console.log(`   - Created ${metrics.length} historical metric logs across all patients.`);

    // 6. Seed Doctor Profiles
    console.log('👨‍⚕️ Seeding Doctor Profiles with Geohashes...');
    const doctors = [
        {
            id: 'doc_ahmed',
            lat: 30.096,
            lng: 31.330,
            data: {
                auth_id: 'usr_doc_ahmed_11',
                full_name: 'Dr. Ahmed Hassan',
                major_field: 'physician',
                sub_specialty: 'Cardiology',
                clinic_governorate: 'Cairo',
                clinic_district: 'Heliopolis',
                geohash: '', // To be filled dynamically
                consultation_fee: 400,
                google_rating: 0.0, // Aggregated by cron
                review_count: 0,    // Aggregated by cron
                search_index: 'Ahmed Hassan Physician Cardiology Cairo Heliopolis chest pain hypertension heart attack arrhythmia palpitations high blood pressure coronary bypass'
            }
        },
        {
            id: 'doc_mona',
            lat: 29.960,
            lng: 31.258,
            data: {
                auth_id: 'usr_doc_mona_22',
                full_name: 'Dr. Mona Mansour',
                major_field: 'dentist',
                sub_specialty: 'Orthodontics',
                clinic_governorate: 'Cairo',
                clinic_district: 'Maadi',
                geohash: '',
                consultation_fee: 300,
                google_rating: 0.0,
                review_count: 0,
                search_index: 'Mona Mansour Dentist Orthodontics Cairo Maadi braces alignment teeth smile aesthetics cavities root canal cosmetic'
            }
        },
        {
            id: 'doc_john',
            lat: 30.038,
            lng: 31.211,
            data: {
                auth_id: 'usr_doc_john_33',
                full_name: 'Dr. John Samuel',
                major_field: 'physiotherapy',
                sub_specialty: 'Sports Rehabilitation',
                clinic_governorate: 'Giza',
                clinic_district: 'Dokki',
                geohash: '',
                consultation_fee: 250,
                google_rating: 0.0,
                review_count: 0,
                search_index: 'John Samuel Physiotherapy Sports Rehabilitation Giza Dokki knee recovery back pain scoliosis physical therapy massage muscles strain ligament tear'
            }
        },
        {
            id: 'doc_sarah',
            lat: 29.985,
            lng: 31.130,
            data: {
                auth_id: 'usr_doc_sarah_44',
                full_name: 'Dr. Sarah Fawzy',
                major_field: 'physician',
                sub_specialty: 'Pediatrics',
                clinic_governorate: 'Giza',
                clinic_district: 'Pyramids',
                geohash: '',
                consultation_fee: 350,
                google_rating: 0.0,
                review_count: 0,
                search_index: 'Sarah Fawzy Physician Pediatrics Giza Pyramids children infant baby fever vaccination colic autism development growth checkup'
            }
        },
        {
            id: 'doc_tarek',
            lat: 31.209,
            lng: 30.017,
            data: {
                auth_id: 'usr_doc_tarek_55',
                full_name: 'Dr. Tarek Metwally',
                major_field: 'dentist',
                sub_specialty: 'Implantology',
                clinic_governorate: 'Alexandria',
                clinic_district: 'Smouha',
                geohash: '',
                consultation_fee: 500,
                google_rating: 0.0,
                review_count: 0,
                search_index: 'Tarek Metwally Dentist Implantology Alexandria Smouha teeth implant crown bridge dentures gums oral surgery aesthetics'
            }
        },
        {
            id: 'doc_yasmine',
            lat: 30.056,
            lng: 31.341,
            data: {
                auth_id: 'usr_doc_yasmine_66',
                full_name: 'Dr. Yasmine Ali',
                major_field: 'physiotherapy',
                sub_specialty: 'Pediatric Physiotherapy',
                clinic_governorate: 'Cairo',
                clinic_district: 'Nasr City',
                geohash: '',
                consultation_fee: 200,
                google_rating: 0.0,
                review_count: 0,
                search_index: 'Yasmine Ali Physiotherapy Pediatric Physiotherapy Cairo Nasr City motor skills child posture balance cerebral palsy physical training developmental delays'
            }
        }
    ];

    for (const doc of doctors) {
        // Dynamically compute correct Geohash based on Coordinates
        doc.data.geohash = encodeGeohash(doc.lat, doc.lng, 9);
        await databases.createDocument(databaseId, 'Doctor_Profiles', doc.id, doc.data);
        console.log(`   - Created Doctor: ${doc.data.full_name} (${doc.id}) at [${doc.lat}, ${doc.lng}] -> Geohash: ${doc.data.geohash}`);
    }

    // 7. Seed Availability Slots (Dynamic dates in future)
    console.log('📅 Seeding Schedule Slots (Rolling Dates)...');
    const slots = [];
    const baseHour = 9; // Clinics start at 9:00 AM

    for (const doc of doctors) {
        // Create standard slots over the next 3 days
        for (let day = 1; day <= 3; day++) {
            const date = new Date(now.getFullYear(), now.getMonth(), now.getDate() + day);
            
            // Seed 4 slots per day
            for (let s = 0; s < 4; s++) {
                const start = new Date(date);
                start.setHours(baseHour + s, 0, 0, 0);
                
                const end = new Date(date);
                end.setHours(baseHour + s, 30, 0, 0);

                const slotId = `slot_${doc.id.replace('doc_', '')}_d${day}_s${s}`;
                slots.push({
                    id: slotId,
                    data: {
                        doctor_id: doc.id,
                        start_time: start.toISOString(),
                        end_time: end.toISOString(),
                        status: s === 3 ? 'BOOKED' : 'AVAILABLE' // Mark last slot as booked for calendar realism
                    }
                });
            }
        }
    }

    for (const slot of slots) {
        await databases.createDocument(databaseId, 'Schedule_Slots', slot.id, slot.data);
    }
    console.log(`   - Created ${slots.length} schedule slots in the upcoming calendar.`);

    // 8. Seed Patient Reviews
    console.log('⭐ Seeding Patient Reviews...');
    const reviews = [
        {
            id: 'rev_1',
            data: {
                doctor_id: 'doc_ahmed',
                patient_profile_id: 'pat_alice',
                rating: 5,
                review_text: 'An exceptional cardiologist. He was highly detailed and patiently explained my blood pressure logs. Highly recommended.'
            }
        },
        {
            id: 'rev_2',
            data: {
                doctor_id: 'doc_ahmed',
                patient_profile_id: 'pat_charlie',
                rating: 4,
                review_text: 'Excellent medical advice and very clean clinic. Only complaint was the waiting area was extremely crowded.'
            }
        },
        {
            id: 'rev_3',
            data: {
                doctor_id: 'doc_mona',
                patient_profile_id: 'pat_charlie',
                rating: 5,
                review_text: 'Amazing orthopedic brace alignment. Painless appointment!'
            }
        },
        {
            id: 'rev_4',
            data: {
                doctor_id: 'doc_sarah',
                patient_profile_id: 'pat_bob', // Alice reviewing for her child Bob
                rating: 5,
                review_text: 'Dr. Sarah was wonderful and gentle with my little boy Bob when he had a persistent fever. Excellent pediatrician.'
            }
        },
        {
            id: 'rev_5',
            data: {
                doctor_id: 'doc_john',
                patient_profile_id: 'pat_alice',
                rating: 3,
                review_text: 'The physical therapist is very knowledgeable, but standard therapy slots feel a bit rushed.'
            }
        }
    ];

    for (const rev of reviews) {
        await databases.createDocument(databaseId, 'Patient_Reviews', rev.id, rev.data);
        console.log(`   - Created review: Rating ${rev.data.rating} for doctor ${rev.data.doctor_id}`);
    }

    // 9. Seed Vault Metadata
    console.log('📁 Seeding Medical Vault Metadata...');
    const vaultDocs = [
        {
            id: 'vault_alice_lab',
            data: {
                patient_profile_id: 'pat_alice',
                file_id: 'file_alice_lab_001',
                title: 'Lipid Profile & BP Clinic Report',
                category: 'lab_result',
                upload_date: now.toISOString()
            }
        },
        {
            id: 'vault_charlie_xray',
            data: {
                patient_profile_id: 'pat_charlie',
                file_id: 'file_charlie_xray_002',
                title: 'Diabetic Foot Imaging',
                category: 'imaging',
                upload_date: now.toISOString()
            }
        }
    ];

    for (const v of vaultDocs) {
        await databases.createDocument(databaseId, 'Vault_Metadata', v.id, v.data);
        console.log(`   - Linked Vault Document: "${v.data.title}" for ${v.data.patient_profile_id}`);
    }

    console.log('\n🎉 DATABASE SEEDING COMPLETED SUCCESSFULLY! 🎉');
}

run().catch(err => {
    console.error("❌ FATAL ERROR running seeding script:", err);
    process.exit(1);
});
