
import { DiscoveredLead, searchMiamiDadeProperty, generateLeadId, PropertyRecord } from './publicDataService';

export interface ParsedCase {
    raw_text: string;
    defendant_name: string;
    plaintiff_name?: string;
    case_number?: string;
    case_type: 'foreclosure' | 'probate' | 'divorce' | 'unknown';
    extraction_confidence: 'high' | 'medium' | 'low';
}

/**
 * Regex patterns for common legal notice formats
 */
const PATTERNS = {
    // Matches "Case No: 2023-012345-CA-01" or "Case No. 23-1234"
    CASE_NO: /(?:CASE|CAUSE)\s*(?:NO|NUMBER|ID)?[:.]?\s*([A-Z0-9-]+)/i,

    // Matches "Plaintiff: Bank of America"
    PLAINTIFF: /(?:PLAINTIFF|PETITIONER|BANK)[:.]?\s*([^v\n\r]+)/i,

    // Matches "Defendant: John Doe" or "vs John Doe"
    DEFENDANT: /(?:DEFENDANT|RESPONDENT|VS\.?|AGAINST)[:.]?\s*([^,:\n\r]+)/i
};

/**
 * Parse raw text into structured case objects
 */
export const parseLegalNoticeText = (text: string): ParsedCase[] => {
    const lines = text.split(/\n/);
    const parsedCases: ParsedCase[] = [];

    // Simple line-by-line parsing (for lists)
    // TODO: Implement block-based parsing for paragraph-style notices

    lines.forEach(line => {
        if (line.trim().length < 10) return;

        const caseNoMatch = line.match(PATTERNS.CASE_NO);
        const defendantMatch = line.match(PATTERNS.DEFENDANT);

        // We only care if we find a potential human component (Defendant)
        // or a strong signal like a Case Number associated with a name
        if (defendantMatch && defendantMatch[1].trim().length > 3) {
            let name = defendantMatch[1].trim();
            // Clean up common artifacts
            name = name.replace(/ (et al|and others|deceased)/gi, '').trim();

            // Skip obvious banks/companies if they appear in the wrong slot
            if (name.match(/\b(BANK|LLC|INC|CORP|ASSOCIATION|TRUST)\b/i)) return;

            parsedCases.push({
                raw_text: line.trim(),
                defendant_name: name,
                plaintiff_name: line.match(PATTERNS.PLAINTIFF)?.[1]?.trim() || 'Unknown',
                case_number: caseNoMatch?.[1] || undefined,
                case_type: detectCaseType(line),
                extraction_confidence: caseNoMatch ? 'high' : 'medium'
            });
        }
    });

    return parsedCases;
};

/**
 * Detect case type based on keywords
 */
function detectCaseType(text: string): ParsedCase['case_type'] {
    const t = text.toLowerCase();
    if (t.includes('foreclos') || t.includes('lis pendens') || t.includes('mortgage')) return 'foreclosure';
    if (t.includes('probate') || t.includes('estate of') || t.includes('deceased')) return 'probate';
    if (t.includes('dissolution') || t.includes('divorce') || t.includes('family')) return 'divorce';
    return 'unknown';
}

/**
 * Verify parsed cases against Property Appraiser API
 */
export const enrichParsedCases = async (cases: ParsedCase[]): Promise<DiscoveredLead[]> => {
    const leads: DiscoveredLead[] = [];

    for (const pCase of cases) {
        // 1. Search Property Appraiser by Name
        const properties = await searchMiamiDadeProperty(pCase.defendant_name);

        if (properties.length > 0) {
            // We found a match! Create Verified Leads
            for (const prop of properties) {
                const lead: DiscoveredLead = {
                    id: generateLeadId(),
                    name: prop.ownerName,
                    address: `${prop.address}, ${prop.city}, FL ${prop.zip}`,
                    county: 'Miami-Dade',
                    folio: prop.folio,
                    score: calculateImportedLeadScore(pCase, prop),
                    verificationLevel: 'verified_record',
                    signals: [{
                        type: pCase.case_type === 'probate' ? 'probate' : 'foreclosure',
                        description: `${pCase.case_type.toUpperCase()} Case Detected: ${pCase.case_number || 'No Case #'}`,
                        strength: 'strong',
                        source: 'Imported Legal Notice',
                        sourceUrl: '', // Could map to the source if provided
                        caseNumber: pCase.case_number
                    }],
                    property: prop,
                    estimatedEquity: 'Checking...',
                    motivationTrigger: `${pCase.case_type.toUpperCase()} - Verified Owner`
                };
                leads.push(lead);
            }
        } else {
            // No property found - Create a "Signal Only" lead? 
            // For now, we only want leads we can map to a property.
            // Option: Return them as "Unverified" to display in the UI for manual check.
        }
    }

    return leads;
};

/**
 * Scoring logic for imported leads
 */
function calculateImportedLeadScore(pCase: ParsedCase, prop: PropertyRecord): number {
    let score = 70; // Base score for a court signal is high

    // Add property signals
    if (prop.homestead) score += 10;
    if (prop.tenure > 20) score += 10;

    // Equity check (if market value > last sale)
    if (prop.marketValue > prop.lastSalePrice * 1.5) score += 10;

    return Math.min(score, 100);
}
