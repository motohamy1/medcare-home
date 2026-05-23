# Medical Care Hub & Personal Health Monitor — Backend & Infrastructure Setup

This repository contains the complete production-grade Appwrite backend schemas, database provisioning systems, and serverless Edge Functions (Node.js/TypeScript).

---

## 📂 Repository Architecture

```text
├── functions/
│   ├── weekly-maintenance-cron/      # Consolidated Weekly Maintenance & AI Search Intent function
│   │   ├── src/main.js
│   │   └── package.json
│   └── transactional-booking-engine/ # High-precision concurrency-safe booking logic
│       ├── src/main.js
│       └── package.json
├── scripts/
│   └── setup-appwrite-db.js          # Database & Storage provisioning engine
├── .env.example                      # Environment variables placeholder
├── appwrite.json                     # CLI deployment configuration manifest
└── package.json                      # Setup scripts and developer environment
```

---

## 🛠️ Infrastructure Overview

### 1. The Database Provisioning System (`scripts/setup-appwrite-db.js`)
An automated Node.js engine powered by `node-appwrite` that connects to Appwrite and guarantees:
*   Creation of the `Medical_Hub_Prod` Database.
*   Provisioning of all 7 Collections with strict attribute definitions, validation bounds, and Row/Document-Level Security (DLS) rules.
*   Polling of attributes to ensure all schema updates are fully active before index deployment.
*   Establishment of optimized Full-Text and Composite indexes.
*   Setup of the `Medical_Vault` Storage Bucket with active file security, a strict **10MB upload limit**, and validation to allow only `.pdf, .jpg, .png, .jpeg` extensions.

### 2. Edge Functions (Node.js 18)

#### A. Consolidated Weekly Maintenance Cron & AI Search Router (`weekly-maintenance-cron`)
This is a consolidated function that routes actions based on the trigger type (Scheduled vs. HTTP):
*   **AI Search Intent Router Mode (HTTP triggered)**:
    *   Uses Google Gemini 1.5 Flash to extract medical specialties and search intent from raw user query strings (e.g., "child high fever").
    *   Extracts `major_field` (physician, dentist, physiotherapy), `specialty`, and `symptoms` into a strict, validated JSON response.
*   **Weekly Maintenance Cron Mode (Scheduled: runs every Sunday at 02:00 AM)**:
    *   **Internal Reputation Sync**: Aggregates patient reviews from the `Patient_Reviews` collection, calculates average ratings and total review counts per doctor, and synchronizes them directly to `Doctor_Profiles` (retaining `google_rating` for seamless compatibility).
    *   **AI Health Coach**: Retrieves the last 7 days of biometrics from `Health_Metrics` (anonymizing patient identities), generates custom preventative health tips using Google Gemini 1.5 Flash, and caches them in the `AI_Insights_Cache` collection.

#### B. Transactional Booking Engine (`transactional-booking-engine`)
*   **Trigger**: Synchronous HTTP upon checkout/booking request.
*   **Concurrency Guard**: Bypasses BaaS non-transactional limitations using a composite booking lock pattern (`appt_${slot_id}`) acting as an absolute database-level unique constraint.
*   **Rollback Mechanism**: Gracefully resets the clinic calendar slot status to `AVAILABLE` if appointments fail mid-transaction.
*   **Notification Engine**: Dispatches push notifications to the doctor's device dashboard immediately upon booking validation.

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

### Step 4: Deploy Serverless Functions
Install the Appwrite CLI, login to your project, and run:
```bash
appwrite push functions --all
```
*Make sure to configure the corresponding environment variables (`GEMINI_API_KEY`, etc.) inside the Appwrite Web Console under each function's settings.*
