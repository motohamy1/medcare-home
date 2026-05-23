/**
 * AI Search Intent Router Appwrite Function
 * Uses Google Gemini 1.5 Flash to extract medical specialties and search intent
 * from raw user search strings (e.g., "child high fever").
 */
module.exports = async (context) => {
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
    const geminiKey = process.env.GEMINI_API_KEY || context.variables.GEMINI_API_KEY;
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
        context.error("Unexpected error in ai-search-intent-router function: " + err.stack);
        return context.res.json({
            success: false,
            error: "Internal Server Error: " + err.message
        }, 500);
    }
};
