const sdk = require("node-appwrite");
require("dotenv").config();

/**
 * Manual Backend Test Script — Search for a Pediatrician
 *
 * This script demonstrates the complete two-step search flow:
 *   1. Call the AI Search Intent Router with a natural language query
 *   2. Use the returned structured intent to query Doctor_Profiles with location filters
 *
 * USAGE:
 *   node scripts/test-search-flow.js "pediatrician in maadi"
 *   node scripts/test-search-flow.js "طبيب أطفال في المعادي"
 */

const databaseId = "Medical_Hub_Prod";

async function run() {
  const endpoint =
    process.env.APPWRITE_ENDPOINT || "https://fra.cloud.appwrite.io/v1";
  const projectId = process.env.APPWRITE_PROJECT_ID;
  const apiKey = process.env.APPWRITE_API_KEY;

  if (!projectId || !apiKey) {
    console.error(
      "CRITICAL: APPWRITE_PROJECT_ID and APPWRITE_API_KEY must be set in .env",
    );
    process.exit(1);
  }

  // Get search query from command line argument or use default
  const searchQuery = process.argv[2] || "pediatrician in maadi";
  console.log(
    "======================================================================",
  );
  console.log("🔍 MEDCARE HOME — SEARCH FLOW TEST");
  console.log(
    "======================================================================\n",
  );
  console.log(`Query: "${searchQuery}"\n`);

  const client = new sdk.Client()
    .setEndpoint(endpoint)
    .setProject(projectId)
    .setKey(apiKey);

  console.log(`Using Appwrite endpoint: ${endpoint}`);
  console.log(`Using Appwrite project: ${projectId}`);

  const functions = new sdk.Functions(client);
  const databases = new sdk.Databases(client);

  // ======================================================================
  // STEP 1: AI Search Intent Router
  // ======================================================================
  console.log(
    "📡 STEP 1: Calling AI Search Intent Router (via weekly-maintenance-cron)...",
  );
  console.log(
    "----------------------------------------------------------------------",
  );

  let intent = null;
  try {
    const execution = await functions.createExecution(
      "weekly-maintenance-cron",
      JSON.stringify({ query: searchQuery }),
      false,
      "/",
      "POST",
    );

    if (execution.status === "failed") {
      console.error("   ❌ AI Router execution failed:", execution.errors);
      process.exit(1);
    }

    const response = JSON.parse(execution.responseBody);
    if (!response.success) {
      console.error("   ❌ AI Router returned error:", response.error);
      process.exit(1);
    }

    intent = response.intent;
    console.log("   ✅ Intent extracted:");
    console.log(`      • Major Field:  ${intent.major_field}`);
    console.log(`      • Specialty:    ${intent.specialty}`);
    console.log(`      • Symptoms:     [${intent.symptoms.join(", ")}]`);
  } catch (e) {
    console.error("   ❌ Failed to call AI Search Intent Router:", e.message);
    process.exit(1);
  }

  // ======================================================================
  // STEP 2: Query Doctor_Profiles with Intent + Location
  // ======================================================================
  console.log("\n📡 STEP 2: Querying Doctor_Profiles with filters...");
  console.log(
    "----------------------------------------------------------------------",
  );

  // Build query filters from intent
  const queries = [
    sdk.Query.equal("major_field", intent.major_field),
    sdk.Query.search("search_index", intent.specialty),
  ];

  // Optional: Add location filter if your query mentions a district/governorate
  // For demo purposes, we also search broadly.
  // In production, you would parse location from the query or use the user's GPS + geohash.

  // Example: search within a specific governorate
  // queries.push(sdk.Query.equal('clinic_governorate', 'Cairo'));

  try {
    const results = await databases.listDocuments(
      databaseId,
      "Doctor_Profiles",
      [...queries, sdk.Query.limit(20)],
    );

    console.log(`   ✅ Found ${results.total} doctors matching your search.\n`);

    if (results.documents.length === 0) {
      console.log(
        "   No doctors found. Try broadening your search or check seed data.",
      );
    } else {
      console.log("   Results:\n");
      results.documents.forEach((doc, idx) => {
        console.log(`   [${idx + 1}] ${doc.full_name}`);
        console.log(
          `       • Specialty:    ${doc.major_field} — ${doc.sub_specialty}`,
        );
        console.log(
          `       • Location:     ${doc.clinic_district}, ${doc.clinic_governorate}`,
        );
        console.log(
          `       • Fee:          ${doc.consultation_fee || "N/A"} EGP`,
        );
        console.log(
          `       • Rating:       ${doc.google_rating} ⭐ (${doc.review_count} reviews)`,
        );
        console.log(`       • Geohash:      ${doc.geohash}`);
        console.log("");
      });
    }
  } catch (e) {
    console.error("   ❌ Failed to query Doctor_Profiles:", e.message);
    console.error(
      "   Tip: Make sure you have run 'npm run seed' to populate demo data.",
    );
    process.exit(1);
  }

  console.log(
    "======================================================================",
  );
  console.log("✅ SEARCH FLOW TEST COMPLETE");
  console.log(
    "======================================================================\n",
  );
}

run().catch((err) => {
  console.error("❌ Search flow test aborted:", err);
  process.exit(1);
});
