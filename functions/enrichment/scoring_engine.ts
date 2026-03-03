/**
 * OSINT Lead Scoring Engine
 * Computes a 0–100 lead score with a transparent breakdown.
 */

import { MatchResult, ScoreResult, ScoreBreakdown } from '../providers/types';

// ─── WEIGHT TABLE ───────────────────────────────────────────

const WEIGHTS = {
    ADDRESS_PARCEL_RESOLVED: 15,
    OWNER_NAME_STRONG_MATCH: 25,
    OWNER_NAME_PARTIAL_MATCH: 10,
    MAILING_MATCHES_PROPERTY: 10,
    ENTITY_INVESTOR_BONUS: 10,
    CONTACT_DELIVERABLE: 10,
    NO_PARCEL_PENALTY: -20,
    STRONG_MISMATCH_PENALTY: -25,
    MISSING_FIELDS_PENALTY: -10,
} as const;

// ─── SCORING ────────────────────────────────────────────────

interface ScoringInput {
    matchResult: MatchResult;
    leadType?: string;           // 'seller' | 'buyer' | 'investor'
    contactDeliverable?: boolean; // phone/email verified
    missingFields?: string[];    // list of missing required fields
}

/**
 * Compute a lead quality score from 0–100 with a per-factor breakdown.
 */
export function computeLeadScore(input: ScoringInput): ScoreResult {
    const { matchResult, leadType, contactDeliverable, missingFields } = input;

    const breakdown: ScoreBreakdown = {
        address_parcel_resolved: 0,
        owner_name_match: 0,
        mailing_match: 0,
        entity_investor_bonus: 0,
        contact_deliverable: 0,
        no_parcel_penalty: 0,
        mismatch_penalty: 0,
        missing_fields_penalty: 0,
        raw_total: 0,
    };

    // +15: Address resolves to a parcel/folio
    if (matchResult.address_to_parcel_confidence >= 0.5) {
        breakdown.address_parcel_resolved = WEIGHTS.ADDRESS_PARCEL_RESOLVED;
    }

    // +25 or +10: Owner name match
    if (matchResult.owner_name_match_confidence >= 0.7) {
        breakdown.owner_name_match = WEIGHTS.OWNER_NAME_STRONG_MATCH;
    } else if (matchResult.owner_name_match_confidence >= 0.4) {
        breakdown.owner_name_match = WEIGHTS.OWNER_NAME_PARTIAL_MATCH;
    }

    // +10: Mailing address matches subject property
    if (matchResult.mailing_address_match === 'yes') {
        breakdown.mailing_match = WEIGHTS.MAILING_MATCHES_PROPERTY;
    }

    // +10: Entity-owned + investor lead type
    if (matchResult.owner_type === 'entity' && (leadType === 'investor' || leadType === 'buyer')) {
        breakdown.entity_investor_bonus = WEIGHTS.ENTITY_INVESTOR_BONUS;
    }

    // +10: Contact deliverability confirmed
    if (contactDeliverable) {
        breakdown.contact_deliverable = WEIGHTS.CONTACT_DELIVERABLE;
    }

    // −20: No parcel found
    if (matchResult.flags.includes('no_parcel_found')) {
        breakdown.no_parcel_penalty = WEIGHTS.NO_PARCEL_PENALTY;
    }

    // −25: Strong name mismatch (low confidence + we have a record)
    if (matchResult.flags.includes('mismatch_owner_name') && matchResult.verification_status !== 'unverified') {
        breakdown.mismatch_penalty = WEIGHTS.STRONG_MISMATCH_PENALTY;
    }

    // −10: Missing key fields
    if (missingFields && missingFields.length > 0) {
        breakdown.missing_fields_penalty = WEIGHTS.MISSING_FIELDS_PENALTY;
    }

    // Compute raw total
    breakdown.raw_total =
        breakdown.address_parcel_resolved +
        breakdown.owner_name_match +
        breakdown.mailing_match +
        breakdown.entity_investor_bonus +
        breakdown.contact_deliverable +
        breakdown.no_parcel_penalty +
        breakdown.mismatch_penalty +
        breakdown.missing_fields_penalty;

    // Clamp to 0–100
    // Base score of 20 for any lead that made it through submission
    const score = Math.max(0, Math.min(100, 20 + breakdown.raw_total));

    return { score, breakdown };
}

/**
 * Get a human-readable explanation of the score.
 */
export function explainScore(result: ScoreResult, matchResult: MatchResult): string {
    const parts: string[] = [];

    if (matchResult.verification_status === 'strong_match') {
        parts.push('Lead strongly verified against county property records.');
    } else if (matchResult.verification_status === 'partial_match') {
        parts.push('Lead partially verified — some data matches county records.');
    } else {
        parts.push('Lead could not be verified against county property records.');
    }

    if (result.breakdown.owner_name_match > 0) {
        parts.push(`Owner name match: ${result.breakdown.owner_name_match === 25 ? 'strong' : 'partial'}.`);
    }

    if (matchResult.owner_type === 'entity') {
        parts.push(`Property is owned by a business entity.`);
    }

    if (matchResult.flags.includes('absentee_owner')) {
        parts.push('Mailing address differs from property — possible absentee owner.');
    }

    if (result.breakdown.no_parcel_penalty < 0) {
        parts.push('WARNING: No parcel/folio found for this address.');
    }

    if (result.breakdown.mismatch_penalty < 0) {
        parts.push('WARNING: Owner name does not match property records.');
    }

    return parts.join(' ');
}
