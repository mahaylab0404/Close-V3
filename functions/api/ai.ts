
import { Router } from 'itty-router';
import { Env } from '../env';
import { GoogleGenAI, Type } from "@google/genai";

const router = Router();

console.log('[DEBUG] api/ai.ts loaded');

router.all('*', (request) => {
    console.log(`[DEBUG] AI Router hit: ${request.method} ${request.url}`);
});

// Helper for JSON responses
const json = (data: any, status = 200) => new Response(JSON.stringify(data), {
    status,
    headers: {
        'Content-Type': 'application/json',
        // CORS handled by index.ts
    }
});

router.post('/api/ai/pathfinder', async (request, env: Env) => {
    try {
        const body = await request.json() as any;
        const { userData } = body;

        if (!userData) {
            return json({ error: 'Missing userData' }, 400);
        }

        // Initialize Gemini with server-side secret
        const genAI = new GoogleGenAI({ apiKey: env.GEMINI_API_KEY });
        const model = 'gemini-2.0-flash-lite-preview-02-05';

        // 1. Tone Adaptation Logic
        const sentimentMap: Record<string, string> = {
            'ready': 'Direct, strategic, and action-oriented. Focus on maximizing value and speed.',
            'hesitant': 'Educational, supportive, and data-driven. Build confidence through clear facts.',
            'overwhelmed': 'Empathetic, reassuring, and step-by-step. specific "Concierge-style" guidance to reduce stress.',
            'default': 'Professional, warm, and authoritative Real Estate Specialist.'
        };
        const userTone = sentimentMap[userData.emotionalReadiness || 'default'] || sentimentMap['default'];

        // 2. Location Intelligence Logic (South Florida focus)
        let localResources = "Verified Sources: Florida Dept of Revenue (Tax nuances), Florida Building Code.";
        const zip = userData.zip?.toString() || "";

        if (zip.startsWith('331')) {
            localResources += " SPECIFIC LOCAL SOURCES: Miami-Dade Clerk of Courts (for probate/liens), Miami-Dade Property Appraiser (pa.miamidade.gov), Team Metro (Code Compliance).";
        } else if (zip.startsWith('333') || zip.startsWith('330')) {
            localResources += " SPECIFIC LOCAL SOURCES: Broward County Property Appraiser (bcpa.net), Broward Environmental Protection/Building Code.";
        } else if (zip.startsWith('334')) {
            localResources += " SPECIFIC LOCAL SOURCES: Palm Beach Property Appraiser (pbcgov.org/papa), Palm Beach Planning, Zoning & Building.";
        }

        const systemInstruction = `
        You are "Closr Intelligence" – a Lead Generation Specialist for South Florida SRES® Agents.
        
        CURRENT OPERATING MODE: ${userTone}
        
        STRICT OPERATING RULES:
        1. DATA SOURCE MANDATE: You MUST prioritize searching the following domains for lead signals:
           - ${localResources}
        2. LEAD SIGNAL IDENTIFICATION:
           - "Transition Leads": Homes with 30+ years of ownership + recent building permits.
           - "Probate Leads": Recent filings in the last 60 days where the property has significant equity.
           - "Pre-Foreclosure": Recent Lis Pendens filings from the County Clerk.
        3. RECENCY: Only return leads where the signal (permit, filing, transfer) occurred in the LAST 12 MONTHS.
        4. CITATION: Every lead MUST include a 'source_url' or 'source_description' referencing a specific government site.
        5. ETHICS: Never return leads from private social media. Only use verified public records.
        `;

        const prompt = `
            Create a personalized Pathfinder Guide for a client in ${userData.location || 'South Florida'} who wants to ${userData.intent || 'make a move'}.
            
            Client Context:
            - Motivation: ${userData.reason}
            - Timeline Urgency: ${userData.urgency}
            - Condition of Property: ${userData.condition}
            - Emotional State: ${userData.emotionalReadiness} (ADJUST TONE ACCORDINGLY)
            
            RETURN A JSON ARRAY with 4 specific advice pillars (Financial, Emotional, Lifestyle, Market).
            Each advice pillar must be HIGHLY SPECIFIC to the client's situation and cite the local resources mentioned above where relevant.
            
            JSON SCHEMA:
            [
              {
                "title": "Short catchy title",
                "content": "2-3 sentences of specific, actionable advice matching the required tone.",
                "pillar": "Financial Safeguards | Emotional & Physical Prep | Market Strategy | Lifestyle Readiness | Purchase Strategy",
                "priority": "high | medium",
                "source": "Specific Local Agency (e.g. BCPA.net) or SRES® Best Practice"
              }
            ]
        `;

        const response = await genAI.models.generateContent({
            model,
            contents: prompt,
            config: {
                systemInstruction: systemInstruction,
                responseMimeType: "application/json",
                responseSchema: {
                    type: Type.ARRAY,
                    items: {
                        type: Type.OBJECT,
                        properties: {
                            title: { type: Type.STRING },
                            content: { type: Type.STRING },
                            pillar: {
                                type: Type.STRING,
                                enum: ["Financial Safeguards", "Emotional & Physical Prep", "Market Strategy", "Lifestyle Readiness", "Purchase Strategy"]
                            },
                            priority: { type: Type.STRING },
                            source: { type: Type.STRING }
                        },
                        required: ["title", "content", "pillar", "priority", "source"]
                    }
                }
            }
        });

        const text = response.text || '[]';

        // Clean potential markdown backticks/json markers
        let cleanText = text;
        const jsonStart = text.indexOf('[');
        const jsonEnd = text.lastIndexOf(']') + 1;
        if (jsonStart !== -1 && jsonEnd !== -1) {
            cleanText = text.substring(jsonStart, jsonEnd);
        }

        const advice = JSON.parse(cleanText);
        return json(advice);

    } catch (error) {
        console.error('Pathfinder API error:', error);
        // Return fallback advice if AI fails, matching the structure
        return json([{
            title: "Consult a Specialist",
            content: "We're having trouble generating your custom guide right now. Please contact a Closr agent directly for a personalized consultation.",
            pillar: "Emotional & Physical Prep",
            priority: "high",
            source: "System"
        }]);
    }
});

// Debug fallback
router.all('*', (request) => json({
    debug: 'matched_fallback',
    url: request.url,
    method: request.method
}, 404));

export default router;
