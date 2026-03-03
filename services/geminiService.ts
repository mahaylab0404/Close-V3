
import { GoogleGenAI, Type } from "@google/genai";
import { UserData, Lead, LeadFactor, PersonalizedAdvice, ClosingCostBreakdown } from "../types";

// Prevent crash if key is missing (Pathfinder now uses backend /api/ai/pathfinder)
const apiKey = import.meta.env.VITE_GEMINI_API_KEY || 'PLACEHOLDER_KEY_FOR_BACKEND_ONLY_FEATURES';
export const ai = new GoogleGenAI({ apiKey });

/**
 * EXPERT KNOWLEDGE REPOSITORY - Grounded in SRES® and Florida Regulatory Standards
 * Targeted Source Domains for High-Integrity Scraping
 */
export const SRES_KNOWLEDGE_BASE = `
VERIFIED SOUTH FLORIDA SOURCE DIRECTORY:
- MIAMI-DADE: miami-dadeclerk.com (Records), miamidade.gov/pa (Appraiser), miamidade.gov/building (Permits)
- BROWARD: browardclerk.org (Records), bcpa.net (Appraiser), broward.org/building (Permits)
- PALM BEACH: mypalmbeachclerk.com (Records), pbcgov.org/papa (Appraiser), pbcgov.org/pzb (Permits)
- STATEWIDE: sunbiz.org (Corporate/Trusts), flrules.org (Administrative Code)
`;

export const EXPERT_SYSTEM_PROMPT = `
You are "Closr Intelligence" – a Lead Generation Specialist for South Florida SRES® Agents.

STRICT OPERATING RULES:
1. DATA SOURCE MANDATE: You MUST prioritize searching the following domains for lead signals:
   - County Clerk of Court 'Legal Notices' and 'Probate' sections.
   - Property Appraiser 'Sales Search' and 'Tax Rolls'.
   - Municipal Building Departments for 'Roof' and 'HVAC' permits from the last 12 months.
2. LEAD SIGNAL IDENTIFICATION:
   - "Transition Leads": Homes with 30+ years of ownership + recent building permits.
   - "Probate Leads": Recent filings in the last 60 days where the property has significant equity.
   - "Pre-Foreclosure": Recent Lis Pendens filings from the County Clerk.
3. RECENCY: Only return leads where the signal (permit, filing, transfer) occurred in the LAST 12 MONTHS.
4. CITATION: Every lead MUST include a 'source_url' or 'source_description' referencing a specific government site.
5. ETHICS: Never return leads from private social media. Only use verified public records.
`;

export const calculateVerifiedClosingCosts = async (
  salePrice: number,
  county: string,
  propertyType: string = 'SFH',
  annualTaxes: number = 0,
  closingDate: string = new Date().toISOString().split('T')[0],
  options: {
    hasPaceLoan?: boolean,
    paceAmount?: number,
    hasHOA?: boolean,
    numHOAs?: number,
    specialAssessments?: number,
    isForeignNational?: boolean,
    purchasePrice?: number,
    isMarried?: boolean,
    prepBudget?: number,
    includeHomeWarranty?: boolean
  } = {}
): Promise<ClosingCostBreakdown> => {
  let docStamps = Math.ceil(salePrice / 100) * 0.70;
  let miamiDadeSurtax = 0;
  if (county === 'Miami-Dade') {
    docStamps = Math.ceil(salePrice / 100) * 0.60;
    if (propertyType !== 'SFH') miamiDadeSurtax = Math.ceil(salePrice / 100) * 0.45;
  }

  let titleInsurance = 0;
  if (salePrice <= 100000) titleInsurance = (salePrice / 1000) * 5.75;
  else if (salePrice <= 1000000) titleInsurance = (100000 / 1000) * 5.75 + ((salePrice - 100000) / 1000) * 5.00;
  else titleInsurance = (100000 / 1000) * 5.75 + (900000 / 1000) * 5.00 + ((salePrice - 1000000) / 1000) * 2.50;

  const close = new Date(closingDate);
  const startOfYear = new Date(close.getFullYear(), 0, 1);
  const daysInYear = ((close.getFullYear() % 4 === 0 && close.getFullYear() % 100 !== 0) || close.getFullYear() % 400 === 0) ? 366 : 365;
  const daysOwned = Math.ceil(Math.abs(close.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24));
  const taxProration = (annualTaxes / daysInYear) * daysOwned;

  const firptaWithholding = options.isForeignNational ? (salePrice * 0.15) : 0;
  let capitalGainsEst = 0;
  if (options.purchasePrice && options.purchasePrice > 0) {
    const gain = salePrice - options.purchasePrice - (salePrice * 0.08);
    const exclusion = options.isMarried ? 500000 : 250000;
    if (gain > exclusion) capitalGainsEst = (gain - exclusion) * 0.15;
  }

  const totalExpenses = docStamps + miamiDadeSurtax + titleInsurance + 850 + (salePrice * 0.06) + 325 + 150 + taxProration + (options.hasHOA ? (options.numHOAs || 1) * 299 : 0) + (options.hasPaceLoan ? (options.paceAmount || 0) : 0) + (options.specialAssessments || 0) + firptaWithholding + capitalGainsEst + (options.prepBudget || 0) + (options.includeHomeWarranty ? 650 : 0);

  return {
    docStamps, miamiDadeSurtax, titleInsurance, settlementFee: 850, commissions: salePrice * 0.06, lienSearch: 325, recordingFees: 150, taxProration, hoaProration: 0, estoppelFee: (options.hasHOA ? (options.numHOAs || 1) * 299 : 0), paceLoanPayoff: (options.hasPaceLoan ? (options.paceAmount || 0) : 0), specialAssessments: (options.specialAssessments || 0), firptaWithholding, capitalGainsEst, prepAndStaging: (options.prepBudget || 0), homeWarranty: (options.includeHomeWarranty ? 650 : 0), totalExpenses, netProceeds: salePrice - totalExpenses
  };
};

export const discoverRealLeads = async (county: string) => {
  const model = 'gemini-3-flash-preview';
  const prompt = `
    SCAN PROTOCOL: ${county}, Florida
    Step 1: Search specific government domains for "Probate Filings", "Estate Notices", and "Lis Pendens" from the last 90 days.
    Step 2: Cross-reference Property Appraiser roles for owner tenure > 25 years.
    Step 3: Check Building Department permit records for new roofs or major renovations.
    
    EXPECTED JSON OUTPUT:
    {
      "leads": [
        {
          "name": "Full Name",
          "address": "Property Address",
          "score": 0-100,
          "reason": "Explain the specific public record signal (e.g. Probate Filing Case #)",
          "source": "URL or specific Agency name",
          "type": "seller",
          "scoringFactors": [
             {"label": "Tenure", "impact": "high", "description": "32 years ownership"},
             {"label": "Signal", "impact": "high", "description": "New roof permit 2024"}
          ]
        }
      ],
      "verificationSteps": ["Step-by-step log of sites searched"]
    }
  `;
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: EXPERT_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      tools: [{ googleSearch: {} }]
    }
  });
  try {
    return JSON.parse(response.text || '{"leads": [], "verificationSteps": []}');
  } catch {
    return { leads: [], verificationSteps: ["Discovery connection interrupted."] };
  }
};

export const generateStrategicBrief = async (lead: Lead) => {
  const model = 'gemini-3-flash-preview';
  const prompt = `
    GENERATE DEEP VERIFICATION BRIEF for: ${JSON.stringify(lead)}.
    
    TASK: 
    1. Search for the specific Case Number or Instrument Number mentioned in ${lead.reason}.
    2. Provide direct links to the relevant County Clerk or Property Appraiser page if possible.
    3. Verify current owner tenure and Homestead status.
    4. Estimate "Save Our Homes" (SOH) Portability based on tenure.
    5. List recent permits found at the address in the last 12 months.
    
    JSON OUTPUT SCHEMA:
    {
      "executiveSummary": "Deep analysis of the lead's legal and structural status.",
      "verifiedRecords": [
        { "label": "Case Number", "value": "ID#", "source": "miami-dadeclerk.com", "verifiedUrl": "URL" }
      ],
      "financialInsights": [
        { "label": "SOH Portability", "estimatedValue": "$250k", "note": "Based on 30yr tenure" }
      ],
      "riskAssessment": "High/Medium/Low assessment for insurance eligibility.",
      "recommendedAction": "Next step for the agent."
    }
  `;
  const response = await ai.models.generateContent({
    model,
    contents: prompt,
    config: {
      systemInstruction: EXPERT_SYSTEM_PROMPT,
      responseMimeType: 'application/json',
      tools: [{ googleSearch: {} }]
    }
  });
  try {
    return JSON.parse(response.text || '{}');
  } catch {
    return { executiveSummary: "Verification briefing failed to generate. Please check connectivity." };
  }
};

export const getStephaniaResponse = async (message: string, history: any[], userData?: UserData) => {
  const model = 'gemini-3-flash-preview';
  const response = await ai.models.generateContent({
    model,
    contents: [...history, { role: 'user', parts: [{ text: message }] }],
    config: {
      systemInstruction: EXPERT_SYSTEM_PROMPT,
      tools: [{ googleSearch: {} }]
    },
  });
  return { text: response.text, sources: response.candidates?.[0]?.groundingMetadata?.groundingChunks };
};


export const getMarketData = async () => {
  // Verified median sale prices (SFH) from Florida Realtors® & MIAMI REALTORS® monthly reports
  // Source: miamirealtors.com, floridarealtors.org, bythesearealty.com — 2024-2025 data
  // Last updated: February 2026
  return {
    lastUpdated: '2026-02-01',
    source: 'Florida Realtors® / MIAMI REALTORS® Monthly Market Reports',
    data: [
      { month: 'Jan 2024', miami: 610000, broward: 580000, palmbeach: 620000 },
      { month: 'Feb 2024', miami: 615000, broward: 585000, palmbeach: 625000 },
      { month: 'Mar 2024', miami: 630000, broward: 600000, palmbeach: 635000 },
      { month: 'Apr 2024', miami: 640000, broward: 635000, palmbeach: 640000 },
      { month: 'May 2024', miami: 645000, broward: 625000, palmbeach: 645000 },
      { month: 'Jun 2024', miami: 650000, broward: 620000, palmbeach: 638000 },
      { month: 'Jul 2024', miami: 648000, broward: 618000, palmbeach: 630000 },
      { month: 'Aug 2024', miami: 645000, broward: 615000, palmbeach: 625000 },
      { month: 'Sep 2024', miami: 640000, broward: 610000, palmbeach: 618000 },
      { month: 'Oct 2024', miami: 645000, broward: 615000, palmbeach: 610000 },
      { month: 'Nov 2024', miami: 650000, broward: 619500, palmbeach: 600000 },
      { month: 'Dec 2024', miami: 675000, broward: 625000, palmbeach: 622500 },
      { month: 'Jan 2025', miami: 675000, broward: 640000, palmbeach: 650000 },
      { month: 'Feb 2025', miami: 678000, broward: 635000, palmbeach: 648000 },
      { month: 'Mar 2025', miami: 682000, broward: 632000, palmbeach: 652000 },
      { month: 'Apr 2025', miami: 680000, broward: 628000, palmbeach: 650000 },
      { month: 'May 2025', miami: 685000, broward: 625000, palmbeach: 655000 },
      { month: 'Jun 2025', miami: 682000, broward: 622000, palmbeach: 652000 },
      { month: 'Jul 2025', miami: 680000, broward: 620000, palmbeach: 613250 },
      { month: 'Aug 2025', miami: 678000, broward: 618000, palmbeach: 630000 },
      { month: 'Sep 2025', miami: 676000, broward: 615000, palmbeach: 638000 },
      { month: 'Oct 2025', miami: 675000, broward: 611250, palmbeach: 643000 },
      { month: 'Nov 2025', miami: 671250, broward: 600000, palmbeach: 605000 },
      { month: 'Dec 2025', miami: 680000, broward: 618000, palmbeach: 643000 },
    ]
  };
};

export const getPersonalizedAdvice = async (userData: UserData): Promise<PersonalizedAdvice[]> => {
  try {
    const response = await fetch(`${import.meta.env.VITE_API_URL}/api/ai/pathfinder`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        // Add auth token if available, though currently this is public/semi-public
      },
      body: JSON.stringify({ userData })
    });

    if (!response.ok) throw new Error('Failed to fetch advice');
    return await response.json();
  } catch (error) {
    console.error("Pathfinder generation failed:", error);
    // Fallback advice if API fails
    return [{
      title: "Consult a Specialist",
      content: "We're having trouble generating your custom guide right now. Please contact a Closr agent directly for a personalized consultation.",
      pillar: "Emotional & Physical Prep",
      priority: "high",
      source: "System"
    }];
  }
};

export const getHomeHealthAssessment = async (data: {
  age: number;
  zip: string;
  sqft: number;
  roofType: string;
  observedIssues: string[];
}) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Assess insurance risk for ZIP ${data.zip}. Search for recent Florida Building Code updates and insurance memos (Last 12 months). JSON.`,
    config: {
      systemInstruction: "Expert South Florida Building Code Analyst.",
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }],
      responseSchema: {
        type: Type.OBJECT,
        properties: {
          repairs: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                id: { type: Type.STRING },
                label: { type: Type.STRING },
                cost: { type: Type.NUMBER },
                urgency: { type: Type.STRING },
                reason: { type: Type.STRING },
                seniorBenefit: { type: Type.STRING },
                insuranceRisk: { type: Type.STRING }
              },
              required: ["id", "label", "cost", "urgency", "reason", "seniorBenefit", "insuranceRisk"]
            }
          }
        },
        required: ["repairs"]
      }
    }
  });
  try { return JSON.parse(response.text || '{"repairs": []}'); } catch { return { repairs: [] }; }
};

export const generateTransitionRoadmap = async (formData: any) => {
  const response = await ai.models.generateContent({
    model: 'gemini-3-flash-preview',
    contents: `Generate a 90-day transition roadmap. Verify current local inventory from the LAST 12 MONTHS. JSON.`,
    config: {
      systemInstruction: EXPERT_SYSTEM_PROMPT,
      responseMimeType: "application/json",
      tools: [{ googleSearch: {} }]
    }
  });
  try { return JSON.parse(response.text || '{}'); } catch { return { summary: "Error generating plan.", repairPriorities: [], financialInsights: [] }; }
};

export function encodeAudio(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

export function decodeAudio(base64: string): Uint8Array {
  const b = atob(base64);
  const bytes = new Uint8Array(b.length);
  for (let i = 0; i < b.length; i++) bytes[i] = b.charCodeAt(i);
  return bytes;
}

export async function decodeAudioData(data: Uint8Array, ctx: AudioContext, sr: number, ch: number): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / ch;
  const buffer = ctx.createBuffer(ch, frameCount, sr);
  for (let c = 0; c < ch; c++) {
    const channelData = buffer.getChannelData(c);
    for (let i = 0; i < frameCount; i++) channelData[i] = dataInt16[i * ch + c] / 32768.0;
  }
  return buffer;
}
