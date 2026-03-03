
import { Lead } from '../types';
import { ai, EXPERT_SYSTEM_PROMPT } from './geminiService';

export interface ActionPlan {
    scripts: {
        label: string;
        text: string;
        tone: 'empathetic' | 'direct' | 'urgent';
    }[];
    steps: {
        order: number;
        action: string;
        description: string;
        role: 'agent' | 'assistant' | 'vendor';
    }[];
    recommendedStrategy: string;
}

export interface HomesteadSavings {
    marketValue: number;
    assessedValue: number;
    portabilityAmount: number;
    annualTaxSavings: number;
    notes: string;
}

export interface RepairEstimate {
    category: string;
    estimatedCost: number;
    urgency: 'high' | 'medium' | 'low';
    impactOnValue: number;
    description: string;
}

export const generateActionPlan = async (lead: Lead): Promise<ActionPlan> => {
    const model = 'gemini-3-flash-preview';
    const prompt = `
    GENERATE SMART ACTION PLAN for Real Estate Lead:
    Name: ${lead.name}
    Address: ${lead.address}
    Type: ${lead.type}
    Signal: ${lead.reason}
    Score: ${lead.score}

    TASK:
    1. Create 3 distinct scripts for the agent to use (Phone, Text, Email) tailored to the specific signal (e.g., Probate, Divorce, Foreclosure).
    2. Outline a 5-step immediate action timeline.
    3. Define the overall strategic approach.

    JSON RESPONSE FORMAT:
    {
        "scripts": [
            { "label": "Initial Call", "text": "...", "tone": "empathetic" }
        ],
        "steps": [
            { "order": 1, "action": "...", "description": "...", "role": "agent" }
        ],
        "recommendedStrategy": "..."
    }
    `;

    try {
        const result = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                systemInstruction: EXPERT_SYSTEM_PROMPT,
                responseMimeType: 'application/json',
                tools: [{ googleSearch: {} }]
            }
        });
        return JSON.parse(result.text || '{}');
    } catch (e) {
        console.error("Failed to generate action plan", e);
        return { scripts: [], steps: [], recommendedStrategy: "Manual review required." };
    }
};

export const calculateHomesteadPortability = (marketValue: number, assessedValue: number, tenureYears: number): HomesteadSavings => {
    // Florida "Save Our Homes" Portability Cap is $500,000
    // Portability = Market Value - Assessed Value (capped)

    // Simple heuristic: If tenure < 2 years, unlikely to have significant cap difference
    if (tenureYears < 2) {
        return {
            marketValue,
            assessedValue,
            portabilityAmount: 0,
            annualTaxSavings: 0,
            notes: "Tenure too short to accumulate significant SOH savings."
        };
    }

    const rawDiff = Math.max(0, marketValue - assessedValue);
    const portabilityAmount = Math.min(rawDiff, 500000);

    // Estimate tax savings (approx 1.8% millage rate average in Miami-Dade/Broward)
    const annualTaxSavings = portabilityAmount * 0.018;

    return {
        marketValue,
        assessedValue,
        portabilityAmount,
        annualTaxSavings,
        notes: `Eligible to transfer up to $${portabilityAmount.toLocaleString()} of assessment difference to next homestead.`
    };
};

export const estimateRepairs = async (lead: Lead): Promise<RepairEstimate[]> => {
    // In a real app, we'd use property age, size, and condition data.
    // using Gemini to infer from "reason" or "scoringFactors" if available, or general zip code data.

    const model = 'gemini-3-flash-preview';
    const prompt = `
    ESTIMATE PRE-LISTING REPAIRS for:
    Address: ${lead.address}
    Signal context: ${lead.reason}
    
    Analyze the likely condition based on the signal (e.g., "Probate" often implies deferred maintenance, "Foreclosure" implies distress).
    Search for property age if possible.

    JSON RESPONSE FORMAT:
    [
        { "category": "Roof", "estimatedCost": 15000, "urgency": "high", "impactOnValue": 25000, "description": "Likely original roof based on age." }
    ]
    `;

    try {
        const result = await ai.models.generateContent({
            model,
            contents: prompt,
            config: {
                systemInstruction: "You are a Construction Estimator for South Florida homes.",
                responseMimeType: 'application/json',
                tools: [{ googleSearch: {} }]
            }
        });
        return JSON.parse(result.text || '[]');
    } catch (e) {
        console.error("Failed to estimate repairs", e);
        return [];
    }
};
