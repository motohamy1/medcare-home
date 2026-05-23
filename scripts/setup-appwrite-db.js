const sdk = require('node-appwrite');
require('dotenv').config();

const databaseId = 'Medical_Hub_Prod';
const databaseName = 'Medical_Hub_Prod';

async function run() {
    const endpoint = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!projectId || !apiKey) {
        console.error("CRITICAL ERROR: APPWRITE_PROJECT_ID and APPWRITE_API_KEY must be set in your .env file.");
        process.exit(1);
    }

    console.log(`Connecting to Appwrite Endpoint: ${endpoint}`);
    console.log(`Target Project ID: ${projectId}`);

    const client = new sdk.Client()
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);

    const databases = new sdk.Databases(client);
    const storage = new sdk.Storage(client);

    // 1. Create or verify database
    try {
        console.log(`Checking if database "${databaseId}" exists...`);
        await databases.get(databaseId);
        console.log(`Database "${databaseId}" already exists.`);
    } catch (e) {
        if (e.code === 404) {
            console.log(`Creating database "${databaseId}"...`);
            await databases.create(databaseId, databaseName);
            console.log(`Database "${databaseId}" created successfully.`);
        } else {
            console.error("Error retrieving database details:", e);
            throw e;
        }
    }

    // 2. Define collection structures
    const collections = [
        {
            id: 'Patient_Profiles',
            name: 'Patient Profiles',
            dls: true,
            permissions: [
                sdk.Permission.create(sdk.Role.users()),
                sdk.Permission.read(sdk.Role.users()),
                sdk.Permission.update(sdk.Role.users()),
                sdk.Permission.delete(sdk.Role.users())
            ],
            attributes: [
                { type: 'string', key: 'auth_id', size: 255, required: true },
                { type: 'boolean', key: 'is_primary', required: false, default: true },
                { type: 'enum', key: 'relationship', elements: ['self', 'child', 'spouse', 'parent'], required: false, default: 'self' },
                { type: 'string', key: 'full_name', size: 255, required: true },
                { type: 'datetime', key: 'date_of_birth', required: false },
                { type: 'enum', key: 'gender', elements: ['male', 'female'], required: false },
                { type: 'string', key: 'blood_type', size: 10, required: false },
                { type: 'string', key: 'governorate', size: 255, required: false },
                { type: 'string', key: 'district', size: 255, required: false }
            ],
            indexes: [
                { key: 'idx_auth_id', type: 'key', attributes: ['auth_id'] }
            ]
        },
        {
            id: 'Doctor_Profiles',
            name: 'Doctor Profiles',
            dls: false,
            permissions: [
                sdk.Permission.read(sdk.Role.any()),
                sdk.Permission.create(sdk.Role.users()), // Authorized doctors can create profiles
                sdk.Permission.update(sdk.Role.users()),
                sdk.Permission.delete(sdk.Role.users())
            ],
            attributes: [
                { type: 'string', key: 'auth_id', size: 255, required: true },
                { type: 'string', key: 'full_name', size: 255, required: true },
                { type: 'enum', key: 'major_field', elements: ['physician', 'dentist', 'physiotherapy'], required: true },
                { type: 'string', key: 'sub_specialty', size: 255, required: true },
                { type: 'string', key: 'clinic_governorate', size: 255, required: true },
                { type: 'string', key: 'clinic_district', size: 255, required: true },
                { type: 'string', key: 'geohash', size: 50, required: true },
                { type: 'integer', key: 'consultation_fee', required: false },
                { type: 'float', key: 'google_rating', required: false, default: 0.0 },
                { type: 'integer', key: 'review_count', required: false, default: 0 },
                { type: 'string', key: 'search_index', size: 1000, required: false }
            ],
            indexes: [
                { key: 'idx_auth_id', type: 'key', attributes: ['auth_id'] },
                { key: 'idx_geohash', type: 'key', attributes: ['geohash'] },
                { key: 'ft_search_index', type: 'fulltext', attributes: ['search_index'] }
            ]
        },
        {
            id: 'Schedule_Slots',
            name: 'Schedule Slots',
            dls: false,
            permissions: [
                sdk.Permission.read(sdk.Role.any())
                // Write access restricted (Server-side/Function only, so no collection level write permissions)
            ],
            attributes: [
                { type: 'string', key: 'doctor_id', size: 255, required: true },
                { type: 'datetime', key: 'start_time', required: true },
                { type: 'datetime', key: 'end_time', required: true },
                { type: 'enum', key: 'status', elements: ['AVAILABLE', 'LOCKED', 'BOOKED'], required: false, default: 'AVAILABLE' }
            ],
            indexes: [
                { key: 'idx_doctor_time', type: 'key', attributes: ['doctor_id', 'start_time'] }
            ]
        },
        {
            id: 'Appointments',
            name: 'Appointments',
            dls: true,
            permissions: [
                sdk.Permission.create(sdk.Role.users()),
                sdk.Permission.read(sdk.Role.users()),
                sdk.Permission.update(sdk.Role.users()),
                sdk.Permission.delete(sdk.Role.users())
            ],
            attributes: [
                { type: 'string', key: 'patient_profile_id', size: 255, required: true },
                { type: 'string', key: 'doctor_id', size: 255, required: true },
                { type: 'string', key: 'slot_id', size: 255, required: true },
                { type: 'string', key: 'symptoms_notes', size: 1000, required: false },
                { type: 'enum', key: 'status', elements: ['PENDING', 'CONFIRMED', 'COMPLETED', 'CANCELLED', 'NO_SHOW'], required: false, default: 'PENDING' }
            ],
            indexes: [
                { key: 'idx_doctor_id', type: 'key', attributes: ['doctor_id'] },
                { key: 'idx_patient_profile_id', type: 'key', attributes: ['patient_profile_id'] }
            ]
        },
        {
            id: 'Patient_Conditions',
            name: 'Patient Conditions',
            dls: true,
            permissions: [
                sdk.Permission.create(sdk.Role.users()),
                sdk.Permission.read(sdk.Role.users()),
                sdk.Permission.update(sdk.Role.users()),
                sdk.Permission.delete(sdk.Role.users())
            ],
            attributes: [
                { type: 'string', key: 'patient_profile_id', size: 255, required: true },
                { type: 'string', key: 'name', size: 255, required: true },
                { type: 'enum', key: 'status', elements: ['active', 'managed', 'resolved'], required: false, default: 'active' }
            ],
            indexes: [
                { key: 'idx_patient_profile_id', type: 'key', attributes: ['patient_profile_id'] }
            ]
        },
        {
            id: 'Health_Metrics',
            name: 'Health Metrics',
            dls: true,
            permissions: [
                sdk.Permission.create(sdk.Role.users()),
                sdk.Permission.read(sdk.Role.users()),
                sdk.Permission.update(sdk.Role.users()),
                sdk.Permission.delete(sdk.Role.users())
            ],
            attributes: [
                { type: 'string', key: 'patient_profile_id', size: 255, required: true },
                { type: 'enum', key: 'category', elements: ['bp', 'heart_rate', 'weight', 'glucose'], required: true },
                { type: 'float', key: 'value_primary', required: true },
                { type: 'float', key: 'value_secondary', required: false },
                { type: 'string', key: 'unit', size: 50, required: false },
                { type: 'datetime', key: 'measured_at', required: true }
            ],
            indexes: [
                { key: 'idx_patient_measured', type: 'key', attributes: ['patient_profile_id', 'measured_at'] }
            ]
        },
        {
            id: 'AI_Insights_Cache',
            name: 'AI Insights Cache',
            dls: true,
            permissions: [
                sdk.Permission.read(sdk.Role.users())
                // Write access restricted to edge functions (admin key)
            ],
            attributes: [
                { type: 'string', key: 'patient_profile_id', size: 255, required: true },
                { type: 'datetime', key: 'generated_at', required: true },
                { type: 'string', key: 'content_json', size: 5000, required: true }
            ],
            indexes: [
                { key: 'idx_patient_profile_id', type: 'key', attributes: ['patient_profile_id'] }
            ]
        },
        {
            id: 'Patient_Reviews',
            name: 'Patient Reviews',
            dls: true,
            permissions: [
                sdk.Permission.create(sdk.Role.users()),
                sdk.Permission.read(sdk.Role.any()),
                sdk.Permission.update(sdk.Role.users()),
                sdk.Permission.delete(sdk.Role.users())
            ],
            attributes: [
                { type: 'string', key: 'doctor_id', size: 255, required: true },
                { type: 'string', key: 'patient_profile_id', size: 255, required: true },
                { type: 'integer', key: 'rating', required: true },
                { type: 'string', key: 'review_text', size: 2000, required: false }
            ],
            indexes: [
                { key: 'idx_doctor_id', type: 'key', attributes: ['doctor_id'] }
            ]
        },
        {
            id: 'Vault_Metadata',
            name: 'Vault Metadata',
            dls: true,
            permissions: [
                sdk.Permission.create(sdk.Role.users()),
                sdk.Permission.read(sdk.Role.users()),
                sdk.Permission.update(sdk.Role.users()),
                sdk.Permission.delete(sdk.Role.users())
            ],
            attributes: [
                { type: 'string', key: 'patient_profile_id', size: 255, required: true },
                { type: 'string', key: 'file_id', size: 255, required: true },
                { type: 'string', key: 'title', size: 255, required: true },
                { type: 'enum', key: 'category', elements: ['lab_result', 'imaging', 'prescription'], required: true },
                { type: 'datetime', key: 'upload_date', required: false }
            ],
            indexes: [
                { key: 'idx_patient_profile_id', type: 'key', attributes: ['patient_profile_id'] }
            ]
        }
    ];

    // 3. Provision Collections, Attributes, and Indexes
    for (const col of collections) {
        console.log(`----------------------------------------`);
        console.log(`Processing Collection: ${col.name} (${col.id})...`);
        
        let existingCollection = null;
        try {
            existingCollection = await databases.getCollection(databaseId, col.id);
            console.log(`Collection "${col.id}" already exists.`);
        } catch (e) {
            if (e.code === 404) {
                console.log(`Creating collection "${col.id}"...`);
                existingCollection = await databases.createCollection(
                    databaseId,
                    col.id,
                    col.name,
                    col.permissions,
                    col.dls
                );
                console.log(`Collection "${col.id}" created successfully.`);
            } else {
                throw e;
            }
        }

        // Fetch current attributes to see what is already there
        const existingAttrsMap = new Map(existingCollection.attributes.map(a => [a.key, a]));

        // Create missing attributes
        for (const attr of col.attributes) {
            if (existingAttrsMap.has(attr.key)) {
                console.log(`  Attribute "${attr.key}" already exists.`);
                continue;
            }

            console.log(`  Creating attribute "${attr.key}" (${attr.type})...`);
            switch (attr.type) {
                case 'string':
                    await databases.createStringAttribute(databaseId, col.id, attr.key, attr.size, attr.required, attr.default, false);
                    break;
                case 'boolean':
                    await databases.createBooleanAttribute(databaseId, col.id, attr.key, attr.required, attr.default, false);
                    break;
                case 'integer':
                    await databases.createIntegerAttribute(databaseId, col.id, attr.key, attr.required, null, null, attr.default, false);
                    break;
                case 'float':
                    await databases.createFloatAttribute(databaseId, col.id, attr.key, attr.required, null, null, attr.default, false);
                    break;
                case 'datetime':
                    await databases.createDatetimeAttribute(databaseId, col.id, attr.key, attr.required, attr.default, false);
                    break;
                case 'enum':
                    await databases.createEnumAttribute(databaseId, col.id, attr.key, attr.elements, attr.required, attr.default, false);
                    break;
            }
        }

        // Wait for attributes to process before indexing
        console.log(`  Waiting for attributes in "${col.id}" to process...`);
        let pending = true;
        while (pending) {
            const currentCollection = await databases.getCollection(databaseId, col.id);
            const processingAttrs = currentCollection.attributes.filter(a => a.status === 'processing');
            if (processingAttrs.length === 0) {
                pending = false;
                console.log(`  All attributes for "${col.id}" are active.`);
            } else {
                console.log(`    Waiting... ${processingAttrs.length} attributes still processing.`);
                await new Promise(resolve => setTimeout(resolve, 2000));
            }
        }

        // Create indexes
        const existingIndexesMap = new Map(existingCollection.indexes ? existingCollection.indexes.map(i => [i.key, i]) : []);
        for (const idx of col.indexes) {
            if (existingIndexesMap.has(idx.key)) {
                console.log(`  Index "${idx.key}" already exists.`);
                continue;
            }

            console.log(`  Creating index "${idx.key}" (${idx.type}) on attributes [${idx.attributes.join(', ')}]...`);
            try {
                // If it's fulltext or key, Appwrite API creates them
                const orders = idx.attributes.map(() => 'asc'); // default asc
                await databases.createIndex(
                    databaseId,
                    col.id,
                    idx.key,
                    idx.type,
                    idx.attributes,
                    orders
                );
                console.log(`  Index "${idx.key}" created successfully.`);
            } catch (e) {
                console.error(`  Failed to create index "${idx.key}":`, e.message);
            }
        }
    }

    // 4. Provision Storage Bucket "Medical_Vault"
    console.log(`----------------------------------------`);
    console.log("Configuring Storage Buckets...");
    const bucketId = 'Medical_Vault';
    const bucketName = 'Medical Vault';
    try {
        await storage.getBucket(bucketId);
        console.log(`Bucket "${bucketId}" already exists.`);
    } catch (e) {
        if (e.code === 404) {
            console.log(`Creating Bucket "${bucketId}"...`);
            await storage.createBucket(
                bucketId,
                bucketName,
                [
                    sdk.Permission.create(sdk.Role.users()),
                    sdk.Permission.read(sdk.Role.users()),
                    sdk.Permission.update(sdk.Role.users()),
                    sdk.Permission.delete(sdk.Role.users())
                ],
                true, // fileSecurity (enforces File-level security / DLS)
                true, // enabled
                10 * 1024 * 1024, // maximum size 10MB in bytes
                ['pdf', 'jpg', 'png', 'jpeg'], // allowed extensions
                sdk.Compression.Gzip, // compression
                false, // encryption disabled
                false // antivirus disabled
            );
            console.log(`Bucket "${bucketId}" created successfully.`);
        } else {
            console.error("Error retrieving bucket details:", e);
            throw e;
        }
    }

    console.log(`----------------------------------------`);
    console.log("SUCCESS: All databases, collections, attributes, indexes, and storage buckets provisioned!");
}

run().catch(err => {
    console.error("FATAL ERROR running provisioning script:", err);
    process.exit(1);
});
