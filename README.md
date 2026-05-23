# Medical Care Hub & Personal Health Monitor — Backend & Infrastructure Setup

This repository contains the complete production-grade Appwrite backend schemas, database provisioning systems, and serverless Edge Functions (Node.js/TypeScript).

---

## 📂 Repository Architecture

```text
├── functions/
│   ├── weekly-maintenance-cron/      # Consolidated: AI Search Router + Weekly Maintenance
│   │   ├── src/main.js
│   │   └── package.json
│   └── transactional-booking-engine/ # Concurrency-safe booking + push/email notifications
│       ├── src/main.js
│       └── package.json
├── scripts/
│   ├── setup-appwrite-db.js          # Database & Storage provisioning engine
│   ├── setup-auth-rbac.js            # Auth providers, Teams, Admin user, RBAC
│   ├── setup-messaging.js            # Resend SMTP, FCM, APNs provider automation
│   ├── seed-db.js                    # Demo data seeding
│   ├── test-backend.js               # Integration & stress tests
│   └── test-search-flow.js           # End-to-end search flow test
├── .env.example                      # Environment variables placeholder
├── appwrite.json                     # CLI deployment configuration manifest
└── package.json                      # Setup scripts and developer environment
```

---

## 🛠️ Infrastructure Overview

### 1. The Database Provisioning System (`scripts/setup-appwrite-db.js`)
An automated Node.js engine powered by `node-appwrite` that connects to Appwrite and guarantees:
*   Creation of the `Medical_Hub_Prod` Database.
*   Provisioning of all 9 Collections with strict attribute definitions, validation bounds, and Row/Document-Level Security (DLS) rules.
*   Polling of attributes to ensure all schema updates are fully active before index deployment.
*   Establishment of optimized Full-Text and Composite indexes.
*   Setup of the `Medical_Vault` Storage Bucket with active file security, a strict **10MB upload limit**, and validation to allow only `.pdf, .jpg, .png, .jpeg` extensions.

### 2. Auth & RBAC Bootstrap System (`scripts/setup-auth-rbac.js`)
An automated Node.js engine that initializes the security and access-control layer:
*   **RBAC Teams**: Creates `admins`, `doctors`, and `patients` teams for strict role-based access.
*   **Default Admin User**: Provisions an initial administrator account with email/password.
*   **Team Assignment**: Automatically links the admin user to the `admins` team.
*   **DLS Verification**: Ensures `Doctor_Profiles` has Document-Level Security (DLS) enabled so document-level permissions can restrict write access to the owner and admins.
*   **Manual Checklist**: Outputs a detailed checklist of required Appwrite Console configurations (Auth providers, Password policy, Phone OTP, Messaging providers).

### 3. Messaging Provider Automation (`scripts/setup-messaging.js`)
Automates the registration of third-party messaging providers within Appwrite so transactional emails and push notifications can be delivered:
*   **Resend SMTP**: Configures transactional email delivery (booking confirmations, reminders) using a free Resend account.
*   **FCM (Firebase Cloud Messaging)**: Configures Android push notification delivery via a Firebase service account.
*   **APNs (Apple Push Notification service)**: Configures iOS push notification delivery using an Apple Developer auth key.
*   **Idempotent & Defensive**: Skips providers that already exist or lack credentials; never crashes mid-run.
*   **Flexible Credential Input**: Supports both raw env-var strings and file paths (e.g., `./secrets/fcm-service-account.json`).

### 4. Edge Functions (Node.js 18)

#### A. Consolidated Weekly Maintenance Cron & AI Search Router (`weekly-maintenance-cron`)
This consolidated function routes actions based on the trigger type (Scheduled vs. HTTP):
*   **AI Search Intent Router Mode (HTTP triggered)**:
    *   Uses Google Gemini 2.5 Flash to extract medical specialties and search intent from raw user query strings (e.g., "child high fever").
    *   Extracts `major_field` (physician, dentist, physiotherapy), `specialty`, and `symptoms` into a strict, validated JSON response.
*   **Weekly Maintenance Cron Mode (Scheduled: runs every Sunday at 02:00 AM)**:
    *   **Internal Reputation Sync**: Aggregates patient reviews from the `Patient_Reviews` collection, calculates average ratings and total review counts per doctor, and synchronizes them directly to `Doctor_Profiles`.
    *   **AI Health Coach**: Retrieves the last 7 days of biometrics from `Health_Metrics` (anonymizing patient identities), generates custom preventative health tips using Google Gemini 2.5 Flash, and caches them in the `AI_Insights_Cache` collection.
*   **Manual Testing**: Accepts manual HTTP triggers with `?job=maintenance` or `{ "job": "maintenance" }` for testing.

#### B. Transactional Booking Engine (`transactional-booking-engine`)
*   **Trigger**: Synchronous HTTP upon checkout/booking request.
*   **Concurrency Guard**: Bypasses BaaS non-transactional limitations using a composite booking lock pattern (`appt_${slot_id}`) acting as an absolute database-level unique constraint.
*   **Rollback Mechanism**: Gracefully resets the clinic calendar slot status to `AVAILABLE` if appointments fail mid-transaction.
*   **Notification Engine**: Dispatches push notifications and transactional emails (via Resend SMTP) to the doctor immediately upon booking validation.

---

## 🚀 Installation & Deployment

### Step 1: Install Local Tooling Dependencies
Ensure you have Node.js 18+ active in your workspace, then run:
```bash
npm install
```

### Step 2: Configure Environment Variables
Copy `.env.example` into a new `.env` file and input your credentials:
```bash
cp .env.example .env
```
Ensure `APPWRITE_API_KEY` has full access to `databases`, `collections`, `attributes`, `indexes`, `buckets`, and `functions`.

### Step 3: Run Database Provisioning
To automatically create all databases, collections, attributes, indexes, and storage buckets:
```bash
npm run setup
```

### Step 4: Initialize Authentication & RBAC
To create the RBAC teams, default admin user, and verify security settings:
```bash
npm run setup:auth
```

**After running this script**, follow the printed manual checklist to enable Auth providers in the Appwrite Console:
*   Enable **Email/Password** and **Phone (OTP)** providers
*   Configure password policy and session security

### Step 5: Configure Messaging Providers
To register Resend SMTP, FCM, and APNs providers for transactional emails and push notifications:
```bash
npm run setup:messaging
```

**Credential requirements** (see `.env.example`):
*   **Resend**: Free account at [resend.com](https://resend.com) → API key + verified domain
*   **FCM**: Firebase project → Service account JSON
*   **APNs**: Apple Developer Program → Auth Key `.p8` file

The script is defensive: it skips any provider whose credentials are missing and prints setup instructions.

### Step 6: Deploy Serverless Functions
Install the Appwrite CLI, login to your project, and run:
```bash
appwrite push functions --all
```
*Make sure to configure the corresponding environment variables (`GEMINI_API_KEY`, etc.) inside the Appwrite Web Console under each function's settings.*

---

## 🔐 RBAC & Permission Architecture

The backend enforces strict Document-Level Security (DLS) with collection-specific rules:

| Collection | Read Access | Write Access | Notes |
|---|---|---|---|
| `Patient_Profiles` | Owner only (`auth_id`) | Owner only | DLS enforced. Collection-level only allows `create`; R/U/D are per-document by `auth_id`. One auth account can manage multiple profiles. |
| `Doctor_Profiles` | Public (`any`) | Owner + Admins | DLS enforced. Collection-level allows `read` (public discovery) and `create` (registration); U/D are per-document by owner or admin team. |
| `Schedule_Slots` | Public (`any`) | Server-side only | No collection-level write. Locked exclusively by Edge Functions to prevent race conditions. |
| `Appointments` | Patient + Doctor | Patient + Doctor | DLS enforced. Collection-level only allows `create`; R/U/D are per-document by patient `auth_id` and doctor `auth_id`. |
| `Patient_Conditions` | Owner only | Owner only | Strict DLS. Collection-level only allows `create`; R/U/D are per-document by `auth_id`. |
| `Health_Metrics` | Owner only | Owner only | Strict DLS. Collection-level only allows `create`; R/U/D are per-document by `auth_id`. |
| `AI_Insights_Cache` | Owner only | Server-side only | No collection-level permissions. Read is per-document by `auth_id`. Write is restricted to Edge Functions (admin API key). |
| `Vault_Metadata` | Owner only | Owner only | Strict DLS. Collection-level only allows `create`; R/U/D are per-document by `auth_id`. |
| `Patient_Reviews` | Public | Authenticated users | DLS enabled. Public read for ratings; authenticated users can write. Document-level perms restrict U/D to the reviewer. |

### Teams
*   **`admins`**: Full platform access. Can create/modify any `Doctor_Profiles` document.
*   **`doctors`**: Reserved for verified medical professionals. Used for future doctor-specific access control.
*   **`patients`**: Standard registered users. Used for patient-specific access control.

### Identity Decoupling
Users authenticate via Appwrite Auth (Email/Password or Phone OTP). Their medical data lives in `Patient_Profiles`, linked by `auth_id`. A single auth account can manage multiple profiles (e.g., a parent managing a child's medical data) via the `relationship` enum (`self`, `child`, `spouse`, `parent`).

---

## 🧪 Testing the Backend

### Prerequisites
Before running any tests, ensure:
1. You have run `npm run setup` to create the database and collections
2. You have run `npm run seed` to populate demo data
3. You have deployed functions via `appwrite push functions --all`
4. You have configured `GEMINI_API_KEY` in each function's environment variables in the Appwrite Console

### Test 1: Search for a Doctor (Two-Step Flow)

The search workflow consists of two steps:

**Step A**: The **AI Search Intent Router** extracts structured intent from a natural language query.
**Step B**: The frontend uses that structured intent to query `Doctor_Profiles` directly via the Appwrite SDK.

#### Option A — Run the Automated Test Script
```bash
# Search in English
npm run test:search -- "pediatrician in maadi"

# Search in Arabic
npm run test:search -- "طبيب أطفال في المعادي"

# Search with symptoms
npm run test:search -- "child has high fever and vomiting"
```

Expected output:
```
📡 STEP 1: Calling AI Search Intent Router...
   ✅ Intent extracted:
      • Major Field:  physician
      • Specialty:    pediatrics
      • Symptoms:     [high fever, vomiting, child]

📡 STEP 2: Querying Doctor_Profiles with filters...
   ✅ Found 3 doctors matching your search.

   [1] Dr. Ahmed Hassan
       • Specialty:    physician — pediatrics
       • Location:     Maadi, Cairo
       • Fee:          300 EGP
       • Rating:       4.5 ⭐ (12 reviews)
```

#### Option B — Manual Testing with curl

**1. Call the AI Search Intent Router (via the consolidated function):**
```bash
curl -X POST https://fra.cloud.appwrite.io/v1/functions/weekly-maintenance-cron/executions \
  -H "X-Appwrite-Project: medcarehome" \
  -H "Content-Type: application/json" \
  -d '{"query": "pediatrician in maadi"}'
```

Expected response:
```json
{
  "success": true,
  "query": "pediatrician in maadi",
  "intent": {
    "major_field": "physician",
    "specialty": "pediatrics",
    "symptoms": []
  }
}
```

**2. Query Doctor_Profiles using the Appwrite SDK (in your frontend):**
```javascript
import { Client, Databases, Query } from 'appwrite';

const client = new Client()
    .setEndpoint('https://fra.cloud.appwrite.io/v1')
    .setProject('medcarehome');

const databases = new Databases(client);

// Use the intent from Step 1 to filter doctors
const doctors = await databases.listDocuments(
    'Medical_Hub_Prod',
    'Doctor_Profiles',
    [
        Query.equal('major_field', 'physician'),
        Query.search('search_index', 'pediatrics'),
        Query.equal('clinic_governorate', 'Cairo'),
        Query.equal('clinic_district', 'Maadi'),
        Query.limit(20)
    ]
);
```

#### Option C — Proximity Search (Geohash)
For location-based discovery without exact district matching, use geohash prefix queries:

```javascript
// Maadi's geohash prefix (approximate)
const maadiGeohashPrefix = 'ssv';

const nearbyDoctors = await databases.listDocuments(
    'Medical_Hub_Prod',
    'Doctor_Profiles',
    [
        Query.equal('major_field', 'physician'),
        Query.search('search_index', 'pediatrics'),
        Query.startsWith('geohash', maadiGeohashPrefix),
        Query.limit(20)
    ]
);
```

---

### Test 2: Book an Appointment (Concurrency Stress Test)

```bash
npm run test:backend
```

This script runs three test suites:
1. **AI Search Intent Router** — Tests multilingual queries (Arabic + English)
2. **High-Concurrency Booking** — Spawns 5 parallel threads targeting the same slot to verify the composite lock prevents double-booking
3. **Cron Maintenance Integrity** — Manually triggers the weekly cron and verifies reputation aggregation + AI health coach caching

---

### Test 3: Verify Auth & RBAC

```bash
npm run setup:auth
```

This script outputs the current state of:
- Teams (`admins`, `doctors`, `patients`)
- Default admin user
- Doctor_Profiles DLS verification
- A manual checklist of remaining Console configuration steps

---

### Test 4: Verify Messaging Providers

```bash
npm run setup:messaging
```

This script:
- Lists existing messaging providers
- Creates Resend SMTP, FCM, and APNs providers if credentials are present
- Skips gracefully if credentials are missing and prints setup instructions
