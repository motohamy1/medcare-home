const fs = require('fs');
const path = require('path');
require('dotenv').config();

/**
 * Messaging Provider Setup Script for Medical Care Hub
 * 
 * This script automates the creation of messaging providers in Appwrite
 * so that transactional emails and push notifications can be sent.
 * 
 * WHAT IT DOES:
 *   1. Lists existing messaging providers (idempotency check)
 *   2. Creates Resend SMTP provider for transactional emails
 *   3. Creates FCM (Firebase Cloud Messaging) provider for Android Push
 *   4. Creates APNs provider for iOS Push
 *   5. Outputs a checklist of manual frontend configuration steps
 * 
 * WHAT YOU MUST HAVE BEFORE RUNNING:
 *   - Resend account + API key (free tier: 3,000 emails/month)
 *   - Firebase project + service account JSON (free)
 *   - Apple Developer account + APNs auth key .p8 file (paid)
 * 
 * USAGE:
 *   node scripts/setup-messaging.js
 * 
 * ENVIRONMENT VARIABLES REQUIRED (see .env.example):
 *   APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY
 *   RESEND_API_KEY, RESEND_FROM_EMAIL, RESEND_FROM_NAME
 *   FCM_SERVICE_ACCOUNT_JSON or FCM_SERVICE_ACCOUNT_JSON_PATH
 *   APNS_AUTH_KEY or APNS_AUTH_KEY_PATH, APNS_AUTH_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID
 */

function normalizeNewlines(str) {
    if (!str || typeof str !== 'string') return str;
    // Replace literal \n with actual newlines (common in env vars)
    return str.replace(/\\n/g, '\n');
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
    console.log(`Target Project ID: ${projectId}`);
    console.log('');

    const apiHeaders = {
        'X-Appwrite-Project': projectId,
        'X-Appwrite-Key': apiKey,
        'Content-Type': 'application/json'
    };

    // ==========================================================
    // STEP 1: List Existing Providers
    // ==========================================================
    console.log('========================================');
    console.log('STEP 1: Listing Existing Messaging Providers');
    console.log('========================================');

    let existingProviders = [];
    try {
        const res = await fetch(`${endpoint}/messaging/providers`, {
            method: 'GET',
            headers: apiHeaders
        });

        if (!res.ok) {
            const errorText = await res.text();
            console.warn(`  Warning: Could not list providers (Status ${res.status}): ${errorText}`);
        } else {
            const data = await res.json();
            existingProviders = data.providers || [];
            if (existingProviders.length === 0) {
                console.log('  No existing providers found.');
            } else {
                existingProviders.forEach(p => {
                    console.log(`  - [${p.$id}] ${p.name} (${p.type || 'unknown'})`);
                });
            }
        }
    } catch (err) {
        console.warn(`  Warning: Failed to list providers: ${err.message}`);
    }

    const existingProviderIds = new Set(existingProviders.map(p => p.$id));
    const results = [];

    // ==========================================================
    // STEP 2: Create Resend SMTP Provider
    // ==========================================================
    console.log('');
    console.log('========================================');
    console.log('STEP 2: Resend SMTP Provider');
    console.log('========================================');

    const resendApiKey = process.env.RESEND_API_KEY;
    const resendFromEmail = process.env.RESEND_FROM_EMAIL;
    const resendFromName = process.env.RESEND_FROM_NAME || 'Medical Care Hub';

    if (!resendApiKey || !resendFromEmail) {
        console.log('  SKIPPED: Missing RESEND_API_KEY or RESEND_FROM_EMAIL in .env');
        console.log('  To set up Resend SMTP:');
        console.log('    1. Create a free account at https://resend.com');
        console.log('    2. Verify your domain (e.g., medcarehome.com)');
        console.log('    3. Copy your API key and from-email into .env');
        results.push({ provider: 'Resend SMTP', status: 'SKIPPED (missing credentials)' });
    } else if (existingProviderIds.has('resend-smtp')) {
        console.log('  SKIPPED: Provider "resend-smtp" already exists.');
        results.push({ provider: 'Resend SMTP', status: 'SKIPPED (already exists)' });
    } else {
        try {
            const body = {
                providerId: 'resend-smtp',
                name: 'Resend SMTP',
                host: 'smtp.resend.com',
                port: 587,
                username: 'resend',
                password: resendApiKey,
                fromName: resendFromName,
                fromEmail: resendFromEmail
            };

            const res = await fetch(`${endpoint}/messaging/providers/smtp`, {
                method: 'POST',
                headers: apiHeaders,
                body: JSON.stringify(body)
            });

            if (res.ok) {
                console.log('  SUCCESS: Resend SMTP provider created.');
                console.log(`    Provider ID: resend-smtp`);
                console.log(`    From: ${resendFromName} <${resendFromEmail}>`);
                console.log(`    Host: smtp.resend.com:587`);
                results.push({ provider: 'Resend SMTP', status: 'CREATED' });
            } else {
                const errorData = await res.text();
                console.error(`  FAILED: Could not create Resend SMTP provider (Status ${res.status}): ${errorData}`);
                results.push({ provider: 'Resend SMTP', status: `FAILED (${res.status})` });
            }
        } catch (err) {
            console.error(`  FAILED: ${err.message}`);
            results.push({ provider: 'Resend SMTP', status: `FAILED (${err.message})` });
        }
    }

    // ==========================================================
    // STEP 3: Create FCM Provider (Android Push)
    // ==========================================================
    console.log('');
    console.log('========================================');
    console.log('STEP 3: FCM Provider (Android Push)');
    console.log('========================================');

    let fcmServiceAccountJson = process.env.FCM_SERVICE_ACCOUNT_JSON;
    if (!fcmServiceAccountJson && process.env.FCM_SERVICE_ACCOUNT_JSON_PATH) {
        const resolvedPath = path.resolve(process.env.FCM_SERVICE_ACCOUNT_JSON_PATH);
        if (fs.existsSync(resolvedPath)) {
            fcmServiceAccountJson = fs.readFileSync(resolvedPath, 'utf8');
        } else {
            console.log(`  WARNING: FCM_SERVICE_ACCOUNT_JSON_PATH not found: ${resolvedPath}`);
        }
    }

    if (!fcmServiceAccountJson) {
        console.log('  SKIPPED: Missing FCM_SERVICE_ACCOUNT_JSON or FCM_SERVICE_ACCOUNT_JSON_PATH in .env');
        console.log('  To set up FCM:');
        console.log('    1. Create a Firebase project at https://console.firebase.google.com');
        console.log('    2. Go to Project Settings > Service Accounts > Generate New Private Key');
        console.log('    3. Save the JSON file and set FCM_SERVICE_ACCOUNT_JSON_PATH in .env');
        console.log('    4. OR paste the raw JSON into FCM_SERVICE_ACCOUNT_JSON in .env');
        results.push({ provider: 'FCM (Android)', status: 'SKIPPED (missing credentials)' });
    } else if (existingProviderIds.has('fcm-android')) {
        console.log('  SKIPPED: Provider "fcm-android" already exists.');
        results.push({ provider: 'FCM (Android)', status: 'SKIPPED (already exists)' });
    } else {
        try {
            // Validate JSON before sending
            JSON.parse(fcmServiceAccountJson);

            const body = {
                providerId: 'fcm-android',
                name: 'Firebase Cloud Messaging (Android)',
                serviceAccountJSON: fcmServiceAccountJson
            };

            const res = await fetch(`${endpoint}/messaging/providers/fcm`, {
                method: 'POST',
                headers: apiHeaders,
                body: JSON.stringify(body)
            });

            if (res.ok) {
                console.log('  SUCCESS: FCM provider created.');
                console.log(`    Provider ID: fcm-android`);
                results.push({ provider: 'FCM (Android)', status: 'CREATED' });
            } else {
                const errorData = await res.text();
                console.error(`  FAILED: Could not create FCM provider (Status ${res.status}): ${errorData}`);
                results.push({ provider: 'FCM (Android)', status: `FAILED (${res.status})` });
            }
        } catch (err) {
            console.error(`  FAILED: ${err.message}`);
            results.push({ provider: 'FCM (Android)', status: `FAILED (${err.message})` });
        }
    }

    // ==========================================================
    // STEP 4: Create APNs Provider (iOS Push)
    // ==========================================================
    console.log('');
    console.log('========================================');
    console.log('STEP 4: APNs Provider (iOS Push)');
    console.log('========================================');

    let apnsAuthKey = process.env.APNS_AUTH_KEY;
    if (!apnsAuthKey && process.env.APNS_AUTH_KEY_PATH) {
        const resolvedPath = path.resolve(process.env.APNS_AUTH_KEY_PATH);
        if (fs.existsSync(resolvedPath)) {
            apnsAuthKey = fs.readFileSync(resolvedPath, 'utf8');
        } else {
            console.log(`  WARNING: APNS_AUTH_KEY_PATH not found: ${resolvedPath}`);
        }
    }

    const apnsAuthKeyId = process.env.APNS_AUTH_KEY_ID;
    const apnsTeamId = process.env.APNS_TEAM_ID;
    const apnsBundleId = process.env.APNS_BUNDLE_ID;
    const apnsSandbox = process.env.APNS_SANDBOX !== 'false'; // default true

    if (!apnsAuthKey || !apnsAuthKeyId || !apnsTeamId || !apnsBundleId) {
        console.log('  SKIPPED: Missing APNs credentials in .env');
        console.log('  Required: APNS_AUTH_KEY (or APNS_AUTH_KEY_PATH), APNS_AUTH_KEY_ID, APNS_TEAM_ID, APNS_BUNDLE_ID');
        console.log('  To set up APNs:');
        console.log('    1. Enroll in Apple Developer Program ($99/year)');
        console.log('    2. Go to Certificates, Identifiers & Profiles > Keys');
        console.log('    3. Create an APNs Auth Key (Apple Push Notifications service)');
        console.log('    4. Download the .p8 file and note the Key ID and Team ID');
        console.log('    5. Set APNS_AUTH_KEY_PATH to the .p8 file in .env');
        results.push({ provider: 'APNs (iOS)', status: 'SKIPPED (missing credentials)' });
    } else if (existingProviderIds.has('apns-ios')) {
        console.log('  SKIPPED: Provider "apns-ios" already exists.');
        results.push({ provider: 'APNs (iOS)', status: 'SKIPPED (already exists)' });
    } else {
        try {
            const normalizedKey = normalizeNewlines(apnsAuthKey);

            const body = {
                providerId: 'apns-ios',
                name: 'Apple Push Notification Service (iOS)',
                authKey: normalizedKey,
                authKeyId: apnsAuthKeyId,
                teamId: apnsTeamId,
                bundleId: apnsBundleId,
                sandbox: apnsSandbox
            };

            const res = await fetch(`${endpoint}/messaging/providers/apns`, {
                method: 'POST',
                headers: apiHeaders,
                body: JSON.stringify(body)
            });

            if (res.ok) {
                console.log('  SUCCESS: APNs provider created.');
                console.log(`    Provider ID: apns-ios`);
                console.log(`    Bundle ID: ${apnsBundleId}`);
                console.log(`    Environment: ${apnsSandbox ? 'SANDBOX (development)' : 'PRODUCTION'}`);
                results.push({ provider: 'APNs (iOS)', status: 'CREATED' });
            } else {
                const errorData = await res.text();
                console.error(`  FAILED: Could not create APNs provider (Status ${res.status}): ${errorData}`);
                results.push({ provider: 'APNs (iOS)', status: `FAILED (${res.status})` });
            }
        } catch (err) {
            console.error(`  FAILED: ${err.message}`);
            results.push({ provider: 'APNs (iOS)', status: `FAILED (${err.message})` });
        }
    }

    // ==========================================================
    // STEP 5: Summary & Manual Checklist
    // ==========================================================
    console.log('');
    console.log('========================================');
    console.log('SETUP COMPLETE');
    console.log('========================================');
    console.log('');
    console.log('Provider Status Summary:');
    results.forEach(r => {
        const symbol = r.status.startsWith('CREATED') ? '[✓]' : (r.status.startsWith('FAILED') ? '[✗]' : '[−]');
        console.log(`  ${symbol} ${r.provider}: ${r.status}`);
    });
    console.log('');
    console.log('========================================');
    console.log('MANUAL CONFIGURATION CHECKLIST');
    console.log('========================================');
    console.log('');
    console.log('1. FRONTEND PUSH NOTIFICATION SETUP (Expo React Native)');
    console.log('   [ ] Install expo-notifications in your Expo app');
    console.log('   [ ] Configure FCM by uploading your google-services.json (Android)');
    console.log('   [ ] Configure APNs entitlement in your app.json / app.config.js');
    console.log('   [ ] Register the device token with Appwrite on app launch:');
    console.log('       const token = await Notifications.getDevicePushTokenAsync();');
    console.log('       await account.createPushTarget(token, "apns-ios"); // iOS');
    console.log('       await account.createPushTarget(token, "fcm-android"); // Android');
    console.log('');
    console.log('2. TRANSACTIONAL EMAIL TEMPLATES (Appwrite Console)');
    console.log('   [ ] Go to Messaging > Templates in the Appwrite Console');
    console.log('   [ ] Create an email template for "Booking Confirmation"');
    console.log('   [ ] Create an email template for "Appointment Reminder"');
    console.log('   [ ] Reference {{variables}} for dynamic content (patient name, date, etc.)');
    console.log('');
    console.log('3. PUSH NOTIFICATION TEMPLATES (Appwrite Console)');
    console.log('   [ ] Go to Messaging > Templates in the Appwrite Console');
    console.log('   [ ] Create a push template for "New Appointment Request"');
    console.log('   [ ] Create a push template for "Appointment Status Update"');
    console.log('');
    console.log('4. VERIFY PROVIDERS (Appwrite Console)');
    console.log('   [ ] Go to Messaging > Providers');
    console.log('   [ ] Verify each provider shows "Active" status');
    console.log('   [ ] Send a test email/push from the Console to validate connectivity');
    console.log('');
    console.log('5. ENVIRONMENT VARIABLES FOR EDGE FUNCTIONS');
    console.log('   [ ] In Appwrite Console > Functions, add these env vars to each function:');
    console.log('       APPWRITE_ENDPOINT, APPWRITE_PROJECT_ID, APPWRITE_API_KEY');
    console.log('       (Functions already reference these for SDK initialization)');
    console.log('');
    console.log('========================================');
    console.log('NEXT STEPS');
    console.log('========================================');
    console.log('');
    console.log('Once providers are active, the transactional-booking-engine function');
    console.log('will automatically send push notifications to doctors when appointments');
    console.log('are created. To also send transactional emails, update the function');
    console.log('to call messaging.createEmail() in addition to messaging.createPush().');
    console.log('');
}

run().catch(err => {
    console.error('FATAL ERROR running messaging setup script:', err);
    process.exit(1);
});
