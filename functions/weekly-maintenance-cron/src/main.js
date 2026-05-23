const sdk = require('node-appwrite');

/**
 * Weekly Maintenance Cron & AI Search Intent Router (Consolidated)
 * 
 * Scheduled: Runs every Sunday at 02:00 AM (0 2 * * 0) -> Performs maintenance tasks.
 * HTTP Triggered: Acts as the AI Search Intent Router using Google Gemini 1.5 Flash.
 */
module.exports = async (context) => {
    const trigger = context.req.headers['x-appwrite-trigger'] || 'http';
    context.log(`Consolidated function triggered via: "${trigger}"`);

    // Determine the route:
    let isMaintenance = (trigger === 'schedule');

    // Allow manual override for testing/administration via HTTP parameters
    if (context.req.query && (context.req.query.job === 'maintenance' || context.req.query.maintenance === 'true')) {
        isMaintenance = true;
    }
    if (context.req.body) {
        let body = context.req.body;
        if (typeof body === 'string') {
            try { body = JSON.parse(body); } catch (e) {}
        }
        if (typeof body === 'object' && body !== null && (body.job === 'maintenance' || body.maintenance === true)) {
            isMaintenance = true;
        }
    }

    if (isMaintenance) {
        context.log("Routing to Weekly Maintenance Job...");
        return await handleWeeklyMaintenance(context);
    } else {
        context.log("Routing to AI Search Intent Router Job...");
        return await handleAiSearchIntentRouter(context);
    }
};

/**
 * AI Search Intent Router
 * Uses Google Gemini 1.5 Flash to extract medical specialties and search intent
 * from raw user search strings (e.g., "child high fever").
 */
async function handleAiSearchIntentRouter(context) {
    // 1. Get search query from body or query params
    let searchString = '';
    if (context.req.body) {
        let body = context.req.body;
        if (typeof body === 'string') {
            try {
                body = JSON.parse(body);
            } catch (e) {
                // String body but not JSON, treat as raw query
                searchString = body;
            }
        }
        if (typeof body === 'object' && body !== null) {
            searchString = body.query || body.q || '';
        }
    }
    
    // Fallback to query parameters
    if (!searchString && context.req.query) {
        searchString = context.req.query.query || context.req.query.q || '';
    }

    if (!searchString) {
        context.error("Missing search string 'query' or 'q' in request.");
        return context.res.json({
            success: false,
            error: "Missing search string 'query' or 'q' in request. Pass as { \"query\": \"...\" } or ?q=..."
        }, 400);
    }

    context.log(`Extracted search string: "${searchString}"`);

    // 2. Read Gemini API key from environment variables
    const geminiKey = process.env.GEMINI_API_KEY || context.variables?.GEMINI_API_KEY;
    if (!geminiKey) {
        context.error("CRITICAL ERROR: GEMINI_API_KEY environment variable is not defined.");
        return context.res.json({
            success: false,
            error: "Server configuration error: Gemini API key missing."
        }, 500);
    }

    try {
        // 3. Construct call to Google Gemini 1.5 Flash API
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
        
        const systemPrompt = `Extract medical intent from the user query. Classify the major field strictly into one of: "physician", "dentist", "physiotherapy". Infer the most relevant medical specialty/sub-specialty, and extract list of symptoms.
You MUST respond with a strict, valid JSON object following this schema exactly:
{
  "major_field": "physician" | "dentist" | "physiotherapy",
  "specialty": "pediatrics" | "orthopedics" | "cardiology" | etc (infer the sub-specialty or general field),
  "symptoms": ["list", "of", "extracted", "symptoms"]
}
Do not return any explanation or other text. Return ONLY the strict raw JSON object.`;

        const requestBody = {
            contents: [
                {
                    parts: [
                        { text: `User Query: ${searchString}` }
                    ]
                }
            ],
            generationConfig: {
                responseMimeType: "application/json",
                temperature: 0.1
            },
            systemInstruction: {
                parts: [
                    { text: systemPrompt }
                ]
            }
        };

        context.log("Sending request to Google Gemini 1.5 Flash API...");
        const response = await fetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json'
            },
            body: JSON.stringify(requestBody)
        });

        if (!response.ok) {
            const errorText = await response.text();
            context.error(`Gemini API responded with status ${response.status}: ${errorText}`);
            return context.res.json({
                success: false,
                error: `Gemini API error (Status ${response.status})`
            }, 502);
        }

        const data = await response.json();
        
        // Extract raw text content from Gemini output structure
        const candidates = data.candidates;
        if (!candidates || candidates.length === 0 || !candidates[0].content || !candidates[0].content.parts || candidates[0].content.parts.length === 0) {
            context.error("Invalid response payload from Gemini API: " + JSON.stringify(data));
            return context.res.json({
                success: false,
                error: "Gemini did not return any candidates."
            }, 502);
        }

        const rawText = candidates[0].content.parts[0].text.trim();
        context.log(`Gemini raw response text: ${rawText}`);

        // Parse extracted intent
        let intent;
        try {
            intent = JSON.parse(rawText);
        } catch (parseError) {
            context.error("Failed to parse Gemini output as JSON: " + rawText);
            return context.res.json({
                success: false,
                error: "Failed to parse model output. Raw text was: " + rawText
            }, 502);
        }

        // Return structured intent back to the client
        return context.res.json({
            success: true,
            query: searchString,
            intent: {
                major_field: intent.major_field || "physician",
                specialty: intent.specialty || "general",
                symptoms: intent.symptoms || []
            }
        }, 200);

    } catch (err) {
        context.error("Unexpected error in ai-search-intent-router logic: " + err.stack);
        return context.res.json({
            success: false,
            error: "Internal Server Error: " + err.message
        }, 500);
    }
}

/**
 * Weekly Maintenance Job
 * Combines two maintenance jobs:
 * 1. AI Health Coach: Aggregates metrics & conditions, generates tips via Gemini, caches them.
 * 2. Internal Reputation Sync: Aggregates patient reviews, updates doctor ratings & search index.
 */
async function handleWeeklyMaintenance(context) {
    // 1. Initialize Appwrite Client & Services
    const endpoint = process.env.APPWRITE_ENDPOINT || context.variables?.APPWRITE_ENDPOINT || 'https://cloud.appwrite.io/v1';
    const projectId = process.env.APPWRITE_PROJECT_ID || context.variables?.APPWRITE_PROJECT_ID;
    const apiKey = process.env.APPWRITE_API_KEY || context.variables?.APPWRITE_API_KEY;
    const geminiKey = process.env.GEMINI_API_KEY || context.variables?.GEMINI_API_KEY;

    if (!projectId || !apiKey) {
        context.error("CRITICAL ERROR: Appwrite project ID or API key configuration is missing.");
        return context.res.text("Appwrite Config Missing.", 500);
    }

    const client = new sdk.Client()
        .setEndpoint(endpoint)
        .setProject(projectId)
        .setKey(apiKey);

    const databases = new sdk.Databases(client);
    const databaseId = 'Medical_Hub_Prod';

    let hasErrors = false;

    // ==========================================
    // TASK 1: Internal Reputation Sync
    // ==========================================
    try {
        context.log("--- Starting Internal Reputation Sync ---");
        const doctorsRes = await databases.listDocuments(databaseId, 'Doctor_Profiles', [
            sdk.Query.limit(100)
        ]);

        const doctors = doctorsRes.documents;
        context.log(`Found ${doctors.length} doctors to process.`);

        for (const doc of doctors) {
            try {
                const reviewsRes = await databases.listDocuments(databaseId, 'Patient_Reviews', [
                    sdk.Query.equal('doctor_id', doc.$id),
                    sdk.Query.limit(500)
                ]);

                const reviewCount = reviewsRes.total;
                let calculatedRating = 0;

                if (reviewCount > 0) {
                    const totalScore = reviewsRes.documents.reduce((acc, review) => acc + (review.rating || 0), 0);
                    calculatedRating = parseFloat((totalScore / reviewsRes.documents.length).toFixed(1));
                }

                const ratingString = `rating_${Math.floor(calculatedRating)}`;
                const searchIndexContent = [
                    doc.full_name, doc.major_field, doc.sub_specialty, doc.clinic_governorate, doc.clinic_district, ratingString,
                    doc.major_field === 'physician' ? 'doctor physician medical clinic طبيب دكتور طبي' : '',
                    doc.major_field === 'dentist' ? 'dentist teeth dental clinic طبيب أسنان أسنان عيادة' : '',
                    doc.major_field === 'physiotherapy' ? 'physiotherapist therapy massage clinic علاج طبيعي مساج طبيعي عيادة' : ''
                ].filter(Boolean).join(' ').toLowerCase();

                await databases.updateDocument(databaseId, 'Doctor_Profiles', doc.$id, {
                    google_rating: calculatedRating,
                    review_count: reviewCount,
                    search_index: searchIndexContent.substring(0, 1000)
                });
            } catch (syncError) {
                context.error(`Error calculating reputation for doc ${doc.$id}: ${syncError.message}`);
                hasErrors = true;
            }
        }
        context.log("--- Internal Reputation Sync Completed ---");
    } catch (err) {
        context.error("Fatal error in reputation sync: " + err.stack);
        hasErrors = true;
    }

    // ==========================================
    // TASK 2: AI Health Coach Cron
    // ==========================================
    try {
        context.log("--- Starting AI Health Coach ---");
        if (!geminiKey) {
            context.error("Skipping AI Health Coach: GEMINI_API_KEY is not defined.");
            hasErrors = true;
        } else {
            const sevenDaysAgo = new Date();
            sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
            
            const metricsResponse = await databases.listDocuments(databaseId, 'Health_Metrics', [
                sdk.Query.greaterThanEqual('measured_at', sevenDaysAgo.toISOString()),
                sdk.Query.limit(5000)
            ]);

            const metrics = metricsResponse.documents;
            context.log(`Retrieved ${metrics.length} metrics from the last 7 days.`);

            if (metrics.length > 0) {
                const patientDataMap = new Map();
                for (const m of metrics) {
                    const pid = m.patient_profile_id;
                    if (!patientDataMap.has(pid)) patientDataMap.set(pid, { metrics: [], conditions: [] });
                    patientDataMap.get(pid).metrics.push({ category: m.category, value_primary: m.value_primary, unit: m.unit });
                }

                for (const [patientId, data] of patientDataMap.entries()) {
                    try {
                        const conditionsRes = await databases.listDocuments(databaseId, 'Patient_Conditions', [
                            sdk.Query.equal('patient_profile_id', patientId),
                            sdk.Query.equal('status', 'active'),
                            sdk.Query.limit(100)
                        ]);
                        data.conditions = conditionsRes.documents.map(c => c.name);

                        const modelInput = { active_conditions: data.conditions, biometrics_log: data.metrics };
                        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${geminiKey}`;
                        const systemPrompt = `You are a preventative health coach. Analyze the user's anonymized biometrics log and active conditions. Do not diagnose, prescribe, or provide diagnostic claims. Based on these raw biometrics, return exactly 3 actionable lifestyle, nutritional, or activity tips. You MUST respond with a strict, valid JSON array containing exactly 3 objects: [ { "type": "action" | "avoid", "title": "Short title of the tip", "description": "Elaborate actionable advice in simple terms." } ]`;

                        const response = await fetch(geminiUrl, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify({
                                contents: [{ parts: [{ text: `Patient Biometrics & Conditions: ${JSON.stringify(modelInput)}` }] }],
                                generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
                                systemInstruction: { parts: [{ text: systemPrompt }] }
                            })
                        });

                        if (!response.ok) throw new Error(`Gemini responded with status ${response.status}`);
                        const resJson = await response.json();
                        const rawText = resJson.candidates[0].content.parts[0].text.trim();
                        JSON.parse(rawText); 
                        
                        const cacheDocId = `insight_${patientId}`;
                        const cacheData = { patient_profile_id: patientId, generated_at: new Date().toISOString(), content_json: rawText };
                        const permissions = [sdk.Permission.read(sdk.Role.user(patientId))];

                        try {
                            await databases.updateDocument(databaseId, 'AI_Insights_Cache', cacheDocId, cacheData);
                        } catch (updateErr) {
                            if (updateErr.code === 404) {
                                await databases.createDocument(databaseId, 'AI_Insights_Cache', cacheDocId, cacheData, permissions);
                            } else throw updateErr;
                        }
                    } catch (gemError) {
                        context.error(`Failed to process AI health coach insights for patient ${patientId}: ${gemError.message}`);
                        hasErrors = true;
                    }
                }
            }
        }
        context.log("--- AI Health Coach Completed ---");
    } catch (err) {
        context.error("Fatal error in health coach cron execution: " + err.stack);
        hasErrors = true;
    }

    if (hasErrors) {
        return context.res.text("Weekly Maintenance Cron finished with some errors. Check logs.", 500);
    }
    return context.res.text("Weekly Maintenance Cron executed successfully.", 200);
}
