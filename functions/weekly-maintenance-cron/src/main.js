const sdk = require('node-appwrite');

/**
 * Weekly Maintenance Cron & AI Search Intent Router (Consolidated)
 *
 * Scheduled: Runs every Sunday at 02:00 AM (0 2 * * 0) -> Performs maintenance tasks.
 * HTTP Triggered: Acts as the AI Search Intent Router using Google Gemini 2.5 Flash.
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
 * Weekly Maintenance Job
 * Combines two maintenance jobs:
 * 1. AI Health Coach: Aggregates metrics & conditions, generates tips via Gemini, caches them.
 * 2. Internal Reputation Sync: Aggregates patient reviews, updates doctor ratings & search index.
 */
/**
 * AI Search Intent Router
 * Uses Google Gemini 2.5 Flash to extract medical specialties and search intent
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
                searchString = body;
            }
        }
        if (typeof body === 'object' && body !== null) {
            searchString = body.query || body.q || '';
        }
    }

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
        // 3. Construct call to Google Gemini 2.5 Flash API
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;

        const systemPrompt = `You are a medical search intent parser for a doctor booking app. Extract structured intent from the user's raw search query.

Rules:
1. The user may search by: doctor NAME (e.g. "dr ahmed"), SPECIALTY (e.g. "cardiologist"), SYMPTOMS (e.g. "chest pain"), or LOCATION (e.g. "nasr city").
2. Classify major_field strictly into one of: "physician", "dentist", "physiotherapy".
3. Map common symptoms to specialties:
   - chest pain, shortness of breath, palpitations → cardiology
   - back pain, joint pain, fracture, sprain → orthopedics
   - fever, cough, cold, flu → general/internal medicine (or pediatrics if child-related)
   - toothache, cavity, bleeding gums → dentist
   - skin rash, acne, eczema → dermatology
   - stomach pain, nausea, vomiting → gastroenterology
   - headache, migraine, dizziness → neurology
   - pregnancy, irregular periods → gynecology
   - child fever, child cough, baby checkup → pediatrics
   - muscle strain, rehabilitation, sports injury → physiotherapy
4. If a specific doctor name is mentioned (contains "dr", "doctor", or appears to be a person's name), extract it.
5. Extract 1-5 relevant keywords from the query for fallback text search.

You MUST respond with a strict, valid JSON object exactly matching this schema:
{
  "major_field": "physician" | "dentist" | "physiotherapy",
  "specialty": "pediatrics" | "orthopedics" | "cardiology" | "dermatology" | "gastroenterology" | "neurology" | "gynecology" | "general" | "internal medicine" | etc (best match),
  "symptoms": ["list", "of", "extracted", "symptoms"],
  "doctor_name": "extracted name or null",
  "keywords": ["important", "search", "terms"]
}
Do not return any explanation, markdown, or other text. Return ONLY the strict raw JSON object.`;

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

        let response;
        let useFallback = false;
        let rawText = "";

        try {
            context.log("Sending request to Google Gemini 2.5 Flash API...");
            response = await fetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(requestBody)
            });

            if (!response.ok) {
                const errorText = await response.text();
                context.error(`Gemini API responded with status ${response.status}: ${errorText}`);
                if (response.status === 429 || response.status === 403 || response.status === 401) {
                    context.log("⚠️ Quota or Authentication error on Gemini. Falling back to local heuristic intent parser...");
                    useFallback = true;
                } else {
                    return context.res.json({
                        success: false,
                        error: `Gemini API error (Status ${response.status})`
                    }, 502);
                }
            } else {
                const data = await response.json();
                const candidates = data.candidates;
                if (!candidates || candidates.length === 0 || !candidates[0].content || !candidates[0].content.parts || candidates[0].content.parts.length === 0) {
                    context.error("Invalid response payload from Gemini API: " + JSON.stringify(data));
                    useFallback = true;
                } else {
                    rawText = candidates[0].content.parts[0].text.trim();
                    context.log(`Gemini raw response text: ${rawText}`);
                }
            }
        } catch (fetchErr) {
            context.error(`Network/Fetch error calling Gemini API: ${fetchErr.message}`);
            useFallback = true;
        }

        let intent;
        if (useFallback) {
            intent = fallbackIntentHeuristics(searchString);
            context.log(`Using Heuristic Fallback Intent: ${JSON.stringify(intent)}`);
        } else {
            try {
                intent = robustJSONParse(rawText);
            } catch (parseError) {
                context.error("Failed to parse Gemini output as JSON: " + rawText);
                intent = fallbackIntentHeuristics(searchString);
                context.log(`Fallback Heuristic triggered due to parse failure: ${JSON.stringify(intent)}`);
            }
        }

        return context.res.json({
            success: true,
            query: searchString,
            intent: {
                major_field: intent.major_field || "physician",
                specialty: intent.specialty || "general",
                symptoms: Array.isArray(intent.symptoms) ? intent.symptoms : [],
                doctor_name: intent.doctor_name || null,
                keywords: Array.isArray(intent.keywords) ? intent.keywords : []
            }
        }, 200);

    } catch (err) {
        context.error("Unexpected error in AI Search Intent Router logic: " + err.stack);
        return context.res.json({
            success: false,
            error: "Internal Server Error: " + err.message
        }, 500);
    }
}

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
                        const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${geminiKey}`;
                        const systemPrompt = `You are a preventative health coach. Analyze the user's anonymized biometrics log and active conditions. Do not diagnose, prescribe, or provide diagnostic claims. Based on these raw biometrics, return exactly 3 actionable lifestyle, nutritional, or activity tips. You MUST respond with a strict, valid JSON array containing exactly 3 objects: [ { "type": "action" | "avoid", "title": "Short title of the tip", "description": "Elaborate actionable advice in simple terms." } ]`;

                        let tips;
                        try {
                            const response = await fetch(geminiUrl, {
                                method: 'POST',
                                headers: { 'Content-Type': 'application/json' },
                                body: JSON.stringify({
                                    contents: [{ parts: [{ text: `Patient Biometrics & Conditions: ${JSON.stringify(modelInput)}` }] }],
                                    generationConfig: { responseMimeType: "application/json", temperature: 0.2 },
                                    systemInstruction: { parts: [{ text: systemPrompt }] }
                                })
                            });

                            if (!response.ok) {
                                const errText = await response.text();
                                throw new Error(`Gemini responded with status ${response.status}: ${errText}`);
                            }
                            const resJson = await response.json();
                            const rawText = resJson.candidates[0].content.parts[0].text.trim();
                            
                            // Parse robustly and then format as clean serialized JSON
                            tips = robustJSONParse(rawText);
                        } catch (gemError) {
                            context.error(`Failed to process AI health coach insights for patient ${patientId}: ${gemError.message}. Generating clinical fallback insights...`);
                            tips = fallbackHealthCoachInsights(modelInput);
                        }

                        const cleanContentJson = JSON.stringify(tips);
                        const cacheDocId = `insight_${patientId}`;
                        const cacheData = { patient_profile_id: patientId, generated_at: new Date().toISOString(), content_json: cleanContentJson };
                        const permissions = [sdk.Permission.read(sdk.Role.user(patientId))];

                        try {
                            await databases.updateDocument(databaseId, 'AI_Insights_Cache', cacheDocId, cacheData);
                        } catch (updateErr) {
                            if (updateErr.code === 404) {
                                await databases.createDocument(databaseId, 'AI_Insights_Cache', cacheDocId, cacheData, permissions);
                            } else throw updateErr;
                        }
                    } catch (patientError) {
                        context.error(`Failed to completely process patient ${patientId}: ${patientError.message}`);
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

/**
 * Clean and parse JSON generated by an AI model.
 * Handles markdown code block wrapping, raw consecutive objects, and invalid control characters.
 */
function robustJSONParse(rawText) {
    if (!rawText || typeof rawText !== 'string') {
        throw new Error("Input to JSON parser must be a non-empty string");
    }

    let cleanText = rawText.trim();

    // 1. Strip Markdown Code Blocks
    if (cleanText.startsWith("```")) {
        cleanText = cleanText.replace(/^```(?:json)?\n?/i, "");
        cleanText = cleanText.replace(/\n?```$/, "");
        cleanText = cleanText.trim();
    }

    // 2. Try parsing the text as-is
    try {
        return JSON.parse(cleanText);
    } catch (e) {
        // Fall through to more advanced recovery/parsing strategies
    }

    // 3. Clean up control characters and try parsing again
    let sanitizedText = cleanText
        .replace(/[\u0000-\u0008\u000B-\u000C\u000E-\u001F]/g, " ")
        .replace(/\n/g, "\\n")
        .replace(/\r/g, "\\r")
        .replace(/\t/g, "\\t");

    try {
        return JSON.parse(sanitizedText);
    } catch (e) {
        // Fall through
    }

    // 4. Recovery Strategy: Extract all JSON objects / curly-braced matches
    const objectMatches = cleanText.match(/\{[^{}]*\}/g);
    if (objectMatches && objectMatches.length > 0) {
        const parsedObjects = [];
        for (const objStr of objectMatches) {
            try {
                parsedObjects.push(JSON.parse(objStr));
            } catch (err) {
                // If a single object fails to parse, try sanitizing just that object string
                try {
                    const sanitizedObj = objStr
                        .replace(/[\u0000-\u0009\u000B-\u000C\u000E-\u001F]/g, " ")
                        .replace(/\n/g, "\\n")
                        .replace(/\r/g, "\\r");
                    parsedObjects.push(JSON.parse(sanitizedObj));
                } catch (innerErr) {
                    // Try our custom flat property parser as a last resort
                    try {
                        const parsedFlat = parseFlatJSONString(objStr);
                        if (parsedFlat) {
                            parsedObjects.push(parsedFlat);
                        }
                    } catch (lastResortErr) {
                        // ignore and skip
                    }
                }
            }
        }
        if (parsedObjects.length > 0) {
            return parsedObjects;
        }
    }

    // 5. If everything fails, throw the original JSON parse error
    return JSON.parse(cleanText);
}

/**
 * Relaxed parser for flat key-value JSON objects with potential unescaped double quotes inside values.
 */
function parseFlatJSONString(str) {
    const cleanStr = str.trim().replace(/^\{/, "").replace(/\}$/, "").trim();
    const result = {};
    const keyRegex = /"([^"\\]*(?:\\.[^"\\]*)*)"\s*:/g;
    let match;
    const keys = [];
    const keyIndices = [];

    while ((match = keyRegex.exec(cleanStr)) !== null) {
        keys.push(match[1]);
        keyIndices.push({
            start: match.index,
            end: keyRegex.lastIndex,
            key: match[1]
        });
    }

    if (keys.length === 0) return null;

    for (let i = 0; i < keyIndices.length; i++) {
        const current = keyIndices[i];
        const next = keyIndices[i + 1];
        
        let valueStr = next 
            ? cleanStr.substring(current.end, next.start).trim()
            : cleanStr.substring(current.end).trim();
        
        if (valueStr.endsWith(",")) {
            valueStr = valueStr.substring(0, valueStr.length - 1).trim();
        }
        
        if (valueStr.startsWith('"') && valueStr.endsWith('"')) {
            valueStr = valueStr.substring(1, valueStr.length - 1);
        }
        
        result[current.key] = valueStr;
    }

    return result;
}

/**
 * Heuristic/Regex fallback parser for medical search queries when Gemini is rate-limited.
 */
function fallbackIntentHeuristics(searchString) {
    const query = (searchString || "").toLowerCase();
    
    const result = {
        major_field: "physician",
        specialty: "general",
        symptoms: [],
        doctor_name: null,
        keywords: []
    };

    // Arabic and English symptoms
    if (query.includes("fever") || query.includes("حرارة") || query.includes("سخونية")) {
        result.symptoms.push("fever");
    }
    if (query.includes("pain") || query.includes("وجع") || query.includes("ألم") || query.includes("بتوجعني")) {
        result.symptoms.push("pain");
    }
    if (query.includes("throwing up") || query.includes("vomit") || query.includes("ترجيع") || query.includes("ورم")) {
        result.symptoms.push("vomiting");
    }
    if (query.includes("gum") || query.includes("لثة") || query.includes("ورم")) {
        result.symptoms.push("gum swelling");
    }

    // Heuristics for Field / Specialty mapping
    if (query.includes("dent") || query.includes("tooth") || query.includes("teeth") || 
        query.includes("أسنان") || query.includes("سن") || query.includes("ضرسي") || query.includes("اللثة") || query.includes("لثة")) {
        result.major_field = "dentist";
        result.specialty = "dentistry";
        result.keywords = ["dentist", "dental", "teeth"];
    } else if (query.includes("child") || query.includes("pediatric") || query.includes("baby") || 
               query.includes("طفل") || query.includes("أطفال")) {
        result.major_field = "physician";
        result.specialty = "pediatrics";
        result.keywords = ["pediatrician", "child", "pediatrics"];
    } else if (query.includes("heart") || query.includes("chest") || query.includes("cardio") || 
               query.includes("قلب") || query.includes("صدر")) {
        result.major_field = "physician";
        result.specialty = "cardiology";
        result.keywords = ["cardiologist", "heart", "cardiology"];
    } else if (query.includes("bone") || query.includes("back") || query.includes("ortho") || 
               query.includes("عظام") || query.includes("ظهر") || query.includes("مفصل")) {
        result.major_field = "physician";
        result.specialty = "orthopedics";
        result.keywords = ["orthopedic", "bones", "orthopedics"];
    } else if (query.includes("therapy") || query.includes("rehab") || query.includes("physio") || 
               query.includes("علاج طبيعي") || query.includes("مساج")) {
        result.major_field = "physiotherapy";
        result.specialty = "physiotherapy";
        result.keywords = ["physiotherapist", "physiotherapy", "rehabilitation"];
    } else if (query.includes("skin") || query.includes("rash") || query.includes("derma") || 
               query.includes("جلدية") || query.includes("بشرة")) {
        result.major_field = "physician";
        result.specialty = "dermatology";
        result.keywords = ["dermatologist", "skin", "dermatology"];
    } else {
        result.keywords = query.split(/\s+/).filter(w => w.length > 3).slice(0, 3);
    }

    const docMatch = query.match(/(?:dr|doctor|دكتور|طبيب)\s+([a-zA-Zأ-ي]+)/i);
    if (docMatch) {
        result.doctor_name = docMatch[1];
    }

    return result;
}

/**
 * Custom clinical preventatives fallback when AI Health Coach is rate-limited.
 */
function fallbackHealthCoachInsights(modelInput) {
    const conditions = modelInput.active_conditions || [];
    const tips = [];

    const hasHypertension = conditions.some(c => c.toLowerCase().includes("hyper") || c.toLowerCase().includes("tension") || c.toLowerCase().includes("blood pressure"));
    const hasDiabetes = conditions.some(c => c.toLowerCase().includes("diabet") || c.toLowerCase().includes("sugar"));

    if (hasHypertension) {
        tips.push({
            type: "action",
            title: "Reduce Sodium & Monitor Blood Pressure",
            description: "Keep your daily sodium intake below 1,500mg. Measure and log your blood pressure twice daily (morning and evening)."
        });
        tips.push({
            type: "action",
            title: "Daily 30-Minute Aerobic Walk",
            description: "Engage in moderate-intensity aerobic exercise, such as brisk walking, to help naturally lower systemic vascular resistance."
        });
        tips.push({
            type: "avoid",
            title: "Avoid High-Stress & Processed Foods",
            description: "Avoid highly processed meals, canned soups, and excessive caffeine which can trigger sudden blood pressure spikes."
        });
    } else if (hasDiabetes) {
        tips.push({
            type: "action",
            title: "Carbohydrate Portion Management",
            description: "Focus on complex carbohydrates with a low glycemic index (e.g., oats, quinoa) and spread your intake evenly throughout the day."
        });
        tips.push({
            type: "action",
            title: "Post-Meal Active Walks",
            description: "Take a light 10-15 minute walk within 30 minutes after completing your main meals to enhance insulin sensitivity."
        });
        tips.push({
            type: "avoid",
            title: "Avoid Refined Sugars & Empty Carbs",
            description: "Steer clear of sweetened beverages, white bread, and refined pastry products that cause rapid blood glucose fluctuations."
        });
    } else {
        tips.push({
            type: "action",
            title: "Hydration Optimization",
            description: "Aim to consume at least 2.5 to 3 liters of pure water daily to facilitate metabolic clearance and cellular function."
        });
        tips.push({
            type: "action",
            title: "Consistent Sleep Hygiene",
            description: "Align with your circadian rhythm by securing 7-8 hours of uninterrupted rest, retiring and waking at consistent times."
        });
        tips.push({
            type: "avoid",
            title: "Avoid Late-Night Heavy Meals",
            description: "Avoid consuming calorie-dense or heavily seasoned food within 3 hours of sleep to optimize sleep architecture and digestion."
        });
    }

    while (tips.length < 3) {
        tips.push({
            type: "action",
            title: "Routine Stretching & Mobility",
            description: "Incorporate 10 minutes of active stretching into your morning routine to enhance blood flow and joint mobility."
        });
    }

    return tips.slice(0, 3);
}
