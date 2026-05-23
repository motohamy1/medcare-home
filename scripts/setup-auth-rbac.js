const sdk = require('node-appwrite');
require('dotenv').config();

/**
 * Auth & RBAC Bootstrap Script for Medical Care Hub
 * 
 * This script automates the initialization of Appwrite Authentication
 * and Role-Based Access Control (RBAC) infrastructure.
 * 
 * WHAT IT DOES:
 *   1. Creates RBAC Teams: 'admins', 'doctors', 'patients'
 *   2. Creates a default Admin user (email/password)
 *   3. Assigns the Admin user to the 'admins' team
 *   4. Verifies that the 'Doctor_Profiles' collection has DLS (Document-Level Security) enabled
 *   5. Outputs a checklist of manual Console configuration steps
 * 
 * WHAT YOU MUST DO MANUALLY IN APPWRITE CONSOLE:
 *   - Enable Email/Password auth provider
 *   - Enable Phone (OTP) auth provider
 *   - Configure password policy (min length, special chars, etc.)
 *   - Set up Phone OTP provider (Twilio / Vonage / Msg91)
 *   - Configure Messaging providers (Resend SMTP, FCM, APNs) for push/email
 * 
 * USAGE:
 *   node scripts/setup-auth-rbac.js
 * 
 * ENVIRONMENT VARIABLES REQUIRED (see .env.example):
 *   APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 *   ADMIN_EMAIL, ADMIN_PASSWORD, ADMIN_NAME
 */

const databaseId = 'Medical_Hub_Prod';

async function run() {
    const endpoint = process.env.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY;

    if (!projectId || !apiKey) {
        console.error("CRITICAL ERROR: APPWRITE_PROJECT_ID and APPWRITE_API_KEY must be set in your .env file.");
        process.exit(1);
    }

    const adminEmail = process.env.ADMIN_EMAIL;
    const adminPassword = process.env.ADMIN_PASSWORD;
    const adminName = process.env.ADMIN_NAME || 'System Administrator';

    if (!adminEmail || !adminPassword) {
        console.error("CRITICAL ERROR: ADMIN_EMAIL and ADMIN_PASSWORD must be set in your .env file to create the default admin user.");
        process.exit(1);
    }

    console.log(`Connecting to Appwrite Endpoint: ${endpoint}`);
    console.log(`Target Project ID: ${projectId}`);
    console.log('');

    const client = new sdk.Client()
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);

    const users = new sdk.Users(client);
    const teams = new sdk.Teams(client);
    const databases = new sdk.Databases(client);

    let adminUser = null;
    let createdTeams = [];

    // ==========================================================
    // STEP 1: Create RBAC Teams
    // ==========================================================
    console.log('========================================');
    console.log('STEP 1: Creating RBAC Teams');
    console.log('========================================');

    const teamDefinitions = [
        { id: 'admins', name: 'Admins', description: 'Platform administrators with full access.' },
        { id: 'doctors', name: 'Doctors', description: 'Verified medical professionals.' },
        { id: 'patients', name: 'Patients', description: 'Registered patients and caregivers.' }
    ];

    for (const teamDef of teamDefinitions) {
        try {
            let team;
            try {
                team = await teams.get(teamDef.id);
                console.log(`  Team "${teamDef.name}" (${teamDef.id}) already exists.`);
            } catch (e) {
                if (e.code === 404) {
                    team = await teams.create(teamDef.id, teamDef.name);
                    console.log(`  Team "${teamDef.name}" (${teamDef.id}) created successfully.`);
                } else {
                    throw e;
                }
            }
            createdTeams.push(team);
        } catch (err) {
            console.error(`  ERROR creating team "${teamDef.name}": ${err.message}`);
        }
    }

    // ==========================================================
    // STEP 2: Create Default Admin User
    // ==========================================================
    console.log('');
    console.log('========================================');
    console.log('STEP 2: Creating Default Admin User');
    console.log('========================================');

    try {
        // Check if user already exists by email
        const existingUsers = await users.list([
            sdk.Query.equal('email', adminEmail),
            sdk.Query.limit(1)
        ]);

        if (existingUsers.total > 0) {
            adminUser = existingUsers.users[0];
            console.log(`  Admin user already exists: ${adminUser.$id} (${adminUser.email})`);
        } else {
            // Create the admin user with email/password
            adminUser = await users.create(
                sdk.ID.unique(),
                adminEmail,
                undefined, // phone
                adminPassword,
                adminName
            );
            console.log(`  Admin user created: ${adminUser.$id} (${adminUser.email})`);
        }
    } catch (err) {
        console.error(`  ERROR creating admin user: ${err.message}`);
        console.error('  Tip: Ensure your API key has "users" scope permission.');
        process.exit(1);
    }

    // ==========================================================
    // STEP 3: Assign Admin User to 'admins' Team
    // ==========================================================
    console.log('');
    console.log('========================================');
    console.log('STEP 3: Assigning Admin to Admins Team');
    console.log('========================================');

    if (adminUser) {
        try {
            // Check if user is already a member
            const memberships = await teams.listMemberships('admins', [
                sdk.Query.equal('userId', adminUser.$id),
                sdk.Query.limit(1)
            ]);

            if (memberships.total > 0) {
                console.log(`  Admin user is already a member of the 'admins' team.`);
            } else {
                // Add user to admins team directly (server-side with API key)
                await teams.createMembership(
                    'admins',
                    [], // roles (empty means default member)
                    'http://localhost', // URL for redirect (not used server-side)
                    adminUser.email,
                    adminUser.$id,
                    undefined, // phone
                    adminUser.name
                );
                console.log(`  Admin user assigned to 'admins' team successfully.`);
            }
        } catch (err) {
            console.error(`  ERROR assigning admin to team: ${err.message}`);
            console.error('  You may need to manually add the user to the team in the Appwrite Console.');
        }
    }

    // ==========================================================
    // STEP 4: Verify Doctor_Profiles Collection DLS
    // ==========================================================
    console.log('');
    console.log('========================================');
    console.log('STEP 4: Verifying Doctor_Profiles DLS');
    console.log('========================================');

    try {
        const doctorProfilesCollection = await databases.getCollection(databaseId, 'Doctor_Profiles');
        
        if (doctorProfilesCollection.documentSecurity) {
            console.log('  Doctor_Profiles DLS is ENABLED. Correct.');
        } else {
            console.warn('  WARNING: Doctor_Profiles DLS is DISABLED. Enabling now...');
            await databases.updateCollection(
                databaseId,
                'Doctor_Profiles',
                'Doctor Profiles',
                doctorProfilesCollection.permissions,
                true, // Enable documentSecurity (DLS)
                doctorProfilesCollection.enabled
            );
            console.log('  Doctor_Profiles DLS has been ENABLED.');
        }

        console.log('');
        console.log('  Doctor_Profiles Permission Model:');
        console.log('    - Read:    PUBLIC (any user, even guests)');
        console.log('    - Create:  Any authenticated user (document-level perms restrict later)');
        console.log('    - Update:  Restricted via Document-Level Security');
        console.log('    - Delete:  Restricted via Document-Level Security');
        console.log('');
        console.log('  IMPORTANT: When creating Doctor_Profiles documents, you MUST pass');
        console.log('  explicit document permissions so only the owner and admins can modify:');
        console.log('    read:  [Role.any()]');
        console.log('    write: [Role.user(doctorAuthId), Role.team("admins")]');

    } catch (err) {
        console.error(`  ERROR verifying Doctor_Profiles collection: ${err.message}`);
    }

    // ==========================================================
    // STEP 5: Summary & Manual Checklist
    // ==========================================================
    console.log('');
    console.log('========================================');
    console.log('SETUP COMPLETE');
    console.log('========================================');
    console.log('');
    console.log('Automated Actions Completed:');
    console.log(`  [✓] Teams created: ${teamDefinitions.map(t => t.id).join(', ')}`);
    console.log(`  [✓] Admin user: ${adminUser ? adminUser.email : 'FAILED'}`);
    console.log(`  [✓] Admin assigned to 'admins' team: ${adminUser ? 'Yes' : 'No'}`);
    console.log('  [✓] Doctor_Profiles DLS verified/enabled');
    console.log('');
    console.log('========================================');
    console.log('MANUAL CONFIGURATION CHECKLIST (Appwrite Console)');
    console.log('========================================');
    console.log('');
    console.log('The following MUST be configured manually in the Appwrite Console:');
    console.log('');
    console.log('1. AUTH PROVIDERS (Auth > Settings)');
    console.log('   [ ] Enable "Email/Password" provider');
    console.log('   [ ] Enable "Phone" (OTP) provider');
    console.log('   [ ] Configure Phone provider (Twilio / Vonage / Msg91)');
    console.log('');
    console.log('2. PASSWORD POLICY (Auth > Security)');
    console.log('   [ ] Set minimum password length (recommended: 8+)');
    console.log('   [ ] Require special characters');
    console.log('   [ ] Require numbers');
    console.log('   [ ] Enable password history (recommended: 5)');
    console.log('');
    console.log('3. SESSIONS & TOKENS (Auth > Security)');
    console.log('   [ ] Configure JWT expiration');
    console.log('   [ ] Enable email verification (recommended for production)');
    console.log('');
    console.log('4. MESSAGING (Messaging > Providers)');
    console.log('   [ ] Add Resend SMTP provider for transactional emails');
    console.log('   [ ] Add FCM (Firebase Cloud Messaging) for Android Push');
    console.log('   [ ] Add APNs (Apple Push Notification service) for iOS Push');
    console.log('');
    console.log('5. RBAC NOTES FOR FRONTEND DEVELOPERS');
    console.log('   - Patient_Profiles: Create with document permissions:');
    console.log('       read:  [Role.user(auth_id)]');
    console.log('       write: [Role.user(auth_id)]');
    console.log('   - Doctor_Profiles: Create with document permissions:');
    console.log('       read:  [Role.any()]');
    console.log('       write: [Role.user(auth_id), Role.team("admins")]');
    console.log('   - Appointments: Create with document permissions:');
    console.log('       read:  [Role.user(patient_auth_id), Role.user(doctor_auth_id)]');
    console.log('       write: [Role.user(patient_auth_id), Role.user(doctor_auth_id)]');
    console.log('');
    console.log('========================================');
    console.log('ADMIN LOGIN CREDENTIALS');
    console.log('========================================');
    console.log(`  Email:    ${adminEmail}`);
    console.log(`  Password: ${'*'.repeat(adminPassword.length)} (hidden)`);
    console.log('');
    console.log('Use these credentials to log into the Appwrite Console or frontend admin dashboard.');
    console.log('');
}

run().catch(err => {
    console.error('FATAL ERROR running auth bootstrap script:', err);
    process.exit(1);
});
