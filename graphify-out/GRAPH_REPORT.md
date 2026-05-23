# Graph Report - .  (2026-05-24)

## Corpus Check
- Corpus is ~18,202 words - fits in a single context window. You may not need a graph.

## Summary
- 125 nodes · 128 edges · 15 communities (11 shown, 4 thin omitted)
- Extraction: 98% EXTRACTED · 2% INFERRED · 0% AMBIGUOUS · INFERRED: 2 edges (avg confidence: 0.9)
- Token cost: 0 input · 0 output

## Community Hubs (Navigation)
- [[_COMMUNITY_Booking Engine & Notifications|Booking Engine & Notifications]]
- [[_COMMUNITY_Root Project Configuration|Root Project Configuration]]
- [[_COMMUNITY_AI Pipeline & Appwrite SDK|AI Pipeline & Appwrite SDK]]
- [[_COMMUNITY_Weekly Cron Package Config|Weekly Cron Package Config]]
- [[_COMMUNITY_Database Collections & DLS Security|Database Collections & DLS Security]]
- [[_COMMUNITY_Booking Engine Package Config|Booking Engine Package Config]]
- [[_COMMUNITY_Booking Engine Implementation|Booking Engine Implementation]]
- [[_COMMUNITY_Weekly Cron Implementation|Weekly Cron Implementation]]
- [[_COMMUNITY_Appwrite Deployment Config|Appwrite Deployment Config]]
- [[_COMMUNITY_Database Seed Script|Database Seed Script]]
- [[_COMMUNITY_Messaging Setup Script|Messaging Setup Script]]
- [[_COMMUNITY_Database Setup Script|Database Setup Script]]
- [[_COMMUNITY_Auth RBAC Setup Script|Auth RBAC Setup Script]]
- [[_COMMUNITY_Backend Test Script|Backend Test Script]]
- [[_COMMUNITY_Search Flow Test Script|Search Flow Test Script]]

## God Nodes (most connected - your core abstractions)
1. `Medical Care Hub & Personal Health Monitor` - 17 edges
2. `Medical_Hub_Prod Database` - 10 edges
3. `scripts` - 7 edges
4. `Transactional Booking Engine Function` - 6 edges
5. `node-appwrite SDK` - 6 edges
6. `Weekly Maintenance Cron Function` - 5 edges
7. `robustJSONParse()` - 4 edges
8. `AI Search Intent Router` - 4 edges
9. `run()` - 3 edges
10. `Doctor_Profiles Collection` - 3 edges

## Surprising Connections (you probably didn't know these)
- `Transactional Booking Engine Function` --enforces--> `Permissions Using patientAuthId Pattern`  [EXTRACTED]
  README.md → functions/transactional-booking-engine/src/main.js
- `Medical Care Hub & Personal Health Monitor` --deployed_with--> `Appwrite CLI`  [INFERRED]
  README.md → .agents/skills/appwrite-cli/SKILL.md
- `AI Search Intent Router` --configures--> `Gemini responseMimeType JSON Mode`  [EXTRACTED]
  README.md → functions/weekly-maintenance-cron/src/main.js
- `AI Search Intent Router` --calls--> `robustJSONParse Function`  [EXTRACTED]
  README.md → functions/weekly-maintenance-cron/src/main.js
- `Internal Reputation Sync` --implements--> `Search Index Generation Logic`  [EXTRACTED]
  README.md → functions/weekly-maintenance-cron/src/main.js

## Hyperedges (group relationships)
- **Appointment Booking Flow** — transactional_booking_engine, appointments, schedule_slots, composite_booking_lock, rollback_mechanism, appt_slot_id_lock [EXTRACTED 1.00]
- **AI Search & Health Coach Pipeline** — weekly_maintenance_cron, ai_search_intent_router, ai_health_coach, google_gemini_25_flash, robust_json_parse, gemini_response_mimetype [EXTRACTED 1.00]
- **Notification System** — transactional_booking_engine, resend_smtp, fcm_notifications, apns_notifications, setup_messaging [EXTRACTED 1.00]

## Communities (15 total, 4 thin omitted)

### Community 0 - "Booking Engine & Notifications"
Cohesion: 0.10
Nodes (21): APNs (Apple Push Notification), appt_{slot_id} Lock ID Pattern, Appwrite CLI, appwrite.config.json, Composite Booking Lock Pattern, FCM (Firebase Cloud Messaging), Medical Care Hub & Personal Health Monitor, Medical_Vault Storage Bucket (+13 more)

### Community 1 - "Root Project Configuration"
Cohesion: 0.11
Nodes (17): author, dependencies, dotenv, node-appwrite, description, keywords, license, main (+9 more)

### Community 2 - "AI Pipeline & Appwrite SDK"
Cohesion: 0.17
Nodes (13): AI Health Coach, AI Search Intent Router, Permission & Role System, Gemini responseMimeType JSON Mode, Google Gemini 2.5 Flash, Internal Reputation Sync, node-appwrite SDK, robustJSONParse Function (+5 more)

### Community 3 - "Weekly Cron Package Config"
Cohesion: 0.15
Nodes (12): author, dependencies, node-appwrite, description, keywords, license, main, name (+4 more)

### Community 4 - "Database Collections & DLS Security"
Cohesion: 0.26
Nodes (12): AI_Insights_Cache Collection, Appointments Collection, Appwrite Backend Infrastructure, Doctor_Profiles Collection, Document-Level Security (DLS), Health_Metrics Collection, Medical_Hub_Prod Database, Patient_Conditions Collection (+4 more)

### Community 5 - "Booking Engine Package Config"
Cohesion: 0.25
Nodes (7): dependencies, node-appwrite, description, devDependencies, main, name, version

### Community 6 - "Booking Engine Implementation"
Cohesion: 0.29
Nodes (6): sdk, client, databases, messaging, payload, permissions

### Community 7 - "Weekly Cron Implementation"
Cohesion: 0.53
Nodes (5): sdk, handleAiSearchIntentRouter(), handleWeeklyMaintenance(), parseFlatJSONString(), robustJSONParse()

### Community 8 - "Appwrite Deployment Config"
Cohesion: 0.40
Nodes (4): endpoint, functions, projectId, projectName

### Community 9 - "Database Seed Script"
Cohesion: 0.60
Nodes (4): clearCollection(), encodeGeohash(), run(), sdk

### Community 10 - "Messaging Setup Script"
Cohesion: 0.50
Nodes (4): fs, normalizeNewlines(), path, run()

## Knowledge Gaps
- **67 isolated node(s):** `projectId`, `projectName`, `endpoint`, `functions`, `name` (+62 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **4 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `Medical Care Hub & Personal Health Monitor` connect `Booking Engine & Notifications` to `AI Pipeline & Appwrite SDK`, `Database Collections & DLS Security`?**
  _High betweenness centrality (0.101) - this node is a cross-community bridge._
- **Why does `Appwrite Backend Infrastructure` connect `Database Collections & DLS Security` to `Booking Engine & Notifications`?**
  _High betweenness centrality (0.049) - this node is a cross-community bridge._
- **What connects `projectId`, `projectName`, `endpoint` to the rest of the system?**
  _71 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `Booking Engine & Notifications` be split into smaller, more focused modules?**
  _Cohesion score 0.1 - nodes in this community are weakly interconnected._
- **Should `Root Project Configuration` be split into smaller, more focused modules?**
  _Cohesion score 0.1111111111111111 - nodes in this community are weakly interconnected._