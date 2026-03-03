/**
 * OSINT Match Engine
 * Fuzzy name matching, address normalization, entity detection,
 * and composite lead-to-property matching logic.
 */

import { PropertyRecord, EntityRecord, MatchResult } from '../providers/types';

// ─── ADDRESS NORMALIZATION ──────────────────────────────────

const DIRECTION_MAP: Record<string, string> = {
    'north': 'N', 'south': 'S', 'east': 'E', 'west': 'W',
    'northeast': 'NE', 'northwest': 'NW', 'southeast': 'SE', 'southwest': 'SW',
    'n': 'N', 's': 'S', 'e': 'E', 'w': 'W',
    'ne': 'NE', 'nw': 'NW', 'se': 'SE', 'sw': 'SW',
};

const STREET_TYPE_MAP: Record<string, string> = {
    'street': 'ST', 'st': 'ST', 'str': 'ST',
    'avenue': 'AVE', 'ave': 'AVE', 'av': 'AVE',
    'boulevard': 'BLVD', 'blvd': 'BLVD',
    'drive': 'DR', 'dr': 'DR', 'drv': 'DR',
    'road': 'RD', 'rd': 'RD',
    'lane': 'LN', 'ln': 'LN',
    'court': 'CT', 'ct': 'CT',
    'circle': 'CIR', 'cir': 'CIR',
    'place': 'PL', 'pl': 'PL',
    'terrace': 'TER', 'ter': 'TER', 'terr': 'TER',
    'trail': 'TRL', 'trl': 'TRL',
    'way': 'WAY',
    'highway': 'HWY', 'hwy': 'HWY',
    'parkway': 'PKWY', 'pkwy': 'PKWY',
};

/**
 * Normalize a raw address to a canonical uppercase format.
 * Strips unit/apt info, normalizes directions and street types.
 */
export function normalizeAddress(raw: string): string {
    if (!raw) return '';

    let addr = raw.trim().toUpperCase();

    // Remove unit/apt/suite designations
    addr = addr.replace(/\b(APT|UNIT|STE|SUITE|#)\s*\S+/gi, '');

    // Remove extra whitespace
    addr = addr.replace(/\s+/g, ' ').trim();

    // Normalize directions
    const words = addr.split(' ');
    const normalized = words.map(w => {
        const lower = w.toLowerCase().replace(/[.,]/g, '');
        if (DIRECTION_MAP[lower]) return DIRECTION_MAP[lower];
        if (STREET_TYPE_MAP[lower]) return STREET_TYPE_MAP[lower];
        return w.replace(/[.,]/g, '');
    });

    return normalized.join(' ').trim();
}

// ─── ENTITY DETECTION ───────────────────────────────────────

const ENTITY_PATTERNS = [
    /\bLLC\b/i,
    /\bINC\b/i,
    /\bCORP\b/i,
    /\bCORPORATION\b/i,
    /\bL\.?L\.?C\.?\b/i,
    /\bLTD\b/i,
    /\bLP\b/i,
    /\bL\.?P\.?\b/i,
    /\bTRUST\b/i,
    /\bESTATE\s+OF\b/i,
    /\bFOUNDATION\b/i,
    /\bHOLDINGS\b/i,
    /\bINVESTMENTS?\b/i,
    /\bPROPERTIES\b/i,
    /\bVENTURES?\b/i,
    /\bGROUP\b/i,
    /\bPARTNERSHIP\b/i,
];

/**
 * Detect if a name appears to be a business entity vs an individual.
 */
export function isEntityName(name: string): boolean {
    if (!name) return false;
    return ENTITY_PATTERNS.some(p => p.test(name));
}

// ─── FUZZY NAME MATCHING ────────────────────────────────────

/**
 * Compute Levenshtein distance between two strings.
 */
function levenshteinDistance(a: string, b: string): number {
    const m = a.length;
    const n = b.length;
    const dp: number[][] = Array.from({ length: m + 1 }, () => Array(n + 1).fill(0));

    for (let i = 0; i <= m; i++) dp[i][0] = i;
    for (let j = 0; j <= n; j++) dp[0][j] = j;

    for (let i = 1; i <= m; i++) {
        for (let j = 1; j <= n; j++) {
            dp[i][j] = a[i - 1] === b[j - 1]
                ? dp[i - 1][j - 1]
                : 1 + Math.min(dp[i - 1][j], dp[i][j - 1], dp[i - 1][j - 1]);
        }
    }

    return dp[m][n];
}

/**
 * Extract name tokens, removing common suffixes (JR, SR, III, etc.)
 */
function extractNameTokens(name: string): string[] {
    const cleaned = name
        .toUpperCase()
        .replace(/[,&.]/g, ' ')
        .replace(/\b(JR|SR|II|III|IV|MR|MRS|MS|DR|ESQ)\b/g, '')
        .replace(/\s+/g, ' ')
        .trim();

    return cleaned.split(' ').filter(t => t.length > 1);
}

/**
 * Compute token-set overlap between two name strings.
 * Returns 0–1 (1 = perfect overlap).
 */
function tokenSetOverlap(a: string, b: string): number {
    const tokensA = new Set(extractNameTokens(a));
    const tokensB = new Set(extractNameTokens(b));

    if (tokensA.size === 0 || tokensB.size === 0) return 0;

    let matchCount = 0;
    for (const token of tokensA) {
        for (const tB of tokensB) {
            // Allow slight fuzziness per token (1 char difference)
            if (token === tB || (token.length > 3 && levenshteinDistance(token, tB) <= 1)) {
                matchCount++;
                break;
            }
        }
    }

    const maxTokens = Math.max(tokensA.size, tokensB.size);
    return matchCount / maxTokens;
}

/**
 * Fuzzy match two names. Returns 0–1 confidence score.
 * Combines normalized Levenshtein + token set overlap.
 */
export function fuzzyNameMatch(nameA: string, nameB: string): number {
    if (!nameA || !nameB) return 0;

    const a = nameA.toUpperCase().trim();
    const b = nameB.toUpperCase().trim();

    // Exact match
    if (a === b) return 1.0;

    // Token overlap (weighted 60%)
    const tokenScore = tokenSetOverlap(a, b);

    // Levenshtein similarity (weighted 40%)
    const maxLen = Math.max(a.length, b.length);
    const levDist = levenshteinDistance(a, b);
    const levScore = maxLen > 0 ? 1 - (levDist / maxLen) : 0;

    const combined = (tokenScore * 0.6) + (levScore * 0.4);

    return Math.round(combined * 100) / 100;
}

// ─── ADDRESS MATCHING ───────────────────────────────────────

/**
 * Compare two addresses for similarity.
 * Returns 0–1 confidence.
 */
export function addressMatchConfidence(addrA: string, addrB: string): number {
    if (!addrA || !addrB) return 0;

    const normA = normalizeAddress(addrA);
    const normB = normalizeAddress(addrB);

    if (normA === normB) return 1.0;

    // Extract street number and compare
    const numA = normA.match(/^\d+/)?.[0];
    const numB = normB.match(/^\d+/)?.[0];

    if (!numA || !numB) return 0.1;
    if (numA !== numB) return 0.1;

    // Same number, check rest of address via token overlap
    const restA = normA.replace(/^\d+\s*/, '');
    const restB = normB.replace(/^\d+\s*/, '');

    const tokensA = new Set(restA.split(' ').filter(Boolean));
    const tokensB = new Set(restB.split(' ').filter(Boolean));

    let matches = 0;
    for (const t of tokensA) {
        if (tokensB.has(t)) matches++;
    }

    const overlap = matches / Math.max(tokensA.size, tokensB.size);
    return Math.round((0.3 + overlap * 0.7) * 100) / 100;
}

// ─── COMPOSITE MATCH ────────────────────────────────────────

interface LeadInput {
    name: string;
    address: string;
    type?: string;  // seller, buyer, investor
}

/**
 * Run full match analysis between a lead and a property record.
 */
export function matchLeadToProperty(
    lead: LeadInput,
    record: PropertyRecord | null,
    entity?: EntityRecord | null
): MatchResult {
    // No property record found
    if (!record) {
        return {
            verification_status: 'unverified',
            address_to_parcel_confidence: 0,
            owner_name_match_confidence: 0,
            mailing_address_match: 'unknown',
            owner_type: 'individual',
            flags: ['no_parcel_found'],
        };
    }

    const addrConf = addressMatchConfidence(lead.address, record.property_address);
    const nameConf = fuzzyNameMatch(lead.name, record.owner_name);
    const ownerIsEntity = isEntityName(record.owner_name);

    // Check if mailing address matches subject property
    const mailingMatch = addressMatchConfidence(record.mailing_address, record.property_address);
    const mailingMatchStatus: 'yes' | 'no' | 'unknown' =
        mailingMatch > 0.7 ? 'yes' :
            mailingMatch < 0.3 ? 'no' : 'unknown';

    // Build flags
    const flags: string[] = [];
    if (nameConf < 0.3) flags.push('mismatch_owner_name');
    if (addrConf < 0.3) flags.push('incomplete_address');
    if (ownerIsEntity) flags.push('entity_owned');
    if (mailingMatchStatus === 'no') flags.push('absentee_owner');
    if (!record.parcel_id) flags.push('no_parcel_found');
    if (record.homestead && ownerIsEntity) flags.push('homestead_entity_conflict');

    // Determine verification status
    let verification_status: MatchResult['verification_status'] = 'unverified';
    if (addrConf >= 0.7 && nameConf >= 0.6) {
        verification_status = 'strong_match';
    } else if (addrConf >= 0.4 || nameConf >= 0.4) {
        verification_status = 'partial_match';
    }

    return {
        verification_status,
        address_to_parcel_confidence: addrConf,
        owner_name_match_confidence: nameConf,
        mailing_address_match: mailingMatchStatus,
        owner_type: ownerIsEntity ? 'entity' : 'individual',
        flags,
    };
}
