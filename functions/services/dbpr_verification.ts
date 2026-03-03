/**
 * DBPR License Verification
 * Verifies Florida real estate licenses against the DBPR public portal.
 *
 * Source: Florida Department of Business and Professional Regulation
 * URL: https://www.myfloridalicense.com/wl11.asp
 *
 * The DBPR does not provide an official JSON API. This service scrapes
 * the public license verification page for license status and details.
 * If scraping fails, falls back to a "pending" status.
 */

import { Env } from '../env';

export interface LicenseVerification {
    license_number: string;
    status: 'active' | 'inactive' | 'expired' | 'not_found' | 'pending';
    licensee_name: string | null;
    license_type: string | null;      // Sales Associate, Broker, Broker Associate
    expiration_date: string | null;
    county: string | null;
    verified_at: string;
    source: string;
}

const DBPR_SEARCH_URL = 'https://www.myfloridalicense.com/wl11.asp';

/**
 * Verify a Florida real estate license number against DBPR portal.
 */
export async function verifyLicense(licenseNumber: string): Promise<LicenseVerification> {
    const baseResult: LicenseVerification = {
        license_number: licenseNumber,
        status: 'pending',
        licensee_name: null,
        license_type: null,
        expiration_date: null,
        county: null,
        verified_at: new Date().toISOString(),
        source: 'DBPR (myfloridalicense.com)',
    };

    try {
        // Clean the license number (remove spaces, dashes)
        const cleanLicense = licenseNumber.replace(/[\s-]/g, '').toUpperCase();

        // DBPR uses a form POST for license search
        const formData = new URLSearchParams();
        formData.append('SID', '');
        formData.append('LicId', cleanLicense);
        formData.append('brd', '2501'); // 2501 = Real Estate Commission
        formData.append('typ', '');
        formData.append('div', '');
        formData.append('dteg', '');
        formData.append('dtefrom', '');
        formData.append('dteto', '');

        const response = await fetch('https://www.myfloridalicense.com/wl11.asp?mode=2&SID=&brd=2501&typ=&div=&dteg=&dtefrom=&dteto=&LicId=' + encodeURIComponent(cleanLicense), {
            method: 'GET',
            headers: {
                'User-Agent': 'Mozilla/5.0 (compatible; ClosrBot/1.0; +https://closr.com)',
                'Accept': 'text/html',
            },
        });

        if (!response.ok) {
            console.error(`DBPR HTTP ${response.status}`);
            return baseResult;
        }

        const html = await response.text();
        return parseDBPRResult(html, cleanLicense, baseResult);
    } catch (error) {
        console.error('DBPR license verification failed:', error);
        return baseResult;
    }
}

/**
 * Parse the DBPR search results page.
 */
function parseDBPRResult(html: string, licenseNumber: string, base: LicenseVerification): LicenseVerification {
    const result = { ...base };

    // Check if no results found
    if (html.includes('No Records Found') || html.includes('0 records found')) {
        result.status = 'not_found';
        return result;
    }

    // Try to extract licensee name
    const nameMatch = html.match(/licensee\s*name[^<]*<[^>]*>([^<]+)/i) ||
        html.match(/<td[^>]*class="[^"]*name[^"]*"[^>]*>([^<]+)/i);
    if (nameMatch) {
        result.licensee_name = nameMatch[1].trim();
    }

    // Extract license status
    const statusMatch = html.match(/(?:status|current\s+status)[^<]*<[^>]*>([^<]+)/i);
    if (statusMatch) {
        const statusText = statusMatch[1].trim().toLowerCase();
        if (statusText.includes('active') || statusText.includes('current')) {
            result.status = 'active';
        } else if (statusText.includes('inactive') || statusText.includes('null')) {
            result.status = 'inactive';
        } else if (statusText.includes('expired')) {
            result.status = 'expired';
        }
    }

    // Extract license type
    const typeMatch = html.match(/(?:license\s+type|profession)[^<]*<[^>]*>([^<]+)/i);
    if (typeMatch) {
        result.license_type = typeMatch[1].trim();
    }

    // Extract expiration date
    const expiryMatch = html.match(/(?:expir|valid\s+through)[^<]*<[^>]*>(\d{1,2}\/\d{1,2}\/\d{2,4})/i);
    if (expiryMatch) {
        result.expiration_date = expiryMatch[1];
    }

    // Extract county
    const countyMatch = html.match(/(?:county)[^<]*<[^>]*>([^<]+)/i);
    if (countyMatch) {
        result.county = countyMatch[1].trim();
    }

    // If we found a name but no explicit status, assume active
    if (result.licensee_name && result.status === 'pending') {
        result.status = 'active';
    }

    return result;
}

/**
 * Verify license and update agent record in D1.
 */
export async function verifyAndUpdateAgent(agentId: string, licenseNumber: string, db: D1Database): Promise<LicenseVerification> {
    const verification = await verifyLicense(licenseNumber);

    // Map license status to agent verification status
    let agentVerificationStatus: string;
    switch (verification.status) {
        case 'active':
            agentVerificationStatus = 'verified';
            break;
        case 'inactive':
        case 'expired':
            agentVerificationStatus = 'rejected';
            break;
        case 'not_found':
            agentVerificationStatus = 'rejected';
            break;
        default:
            agentVerificationStatus = 'pending';
    }

    const notes = verification.status === 'not_found'
        ? `License ${licenseNumber} not found in DBPR records.`
        : verification.status === 'active'
            ? `License verified: ${verification.licensee_name || 'Name on file'}, ${verification.license_type || 'RE License'}, expires ${verification.expiration_date || 'N/A'}`
            : `License status: ${verification.status}`;

    await db.prepare(
        'UPDATE agents SET verification_status = ?, verification_notes = ?, updated_at = ? WHERE id = ?'
    ).bind(agentVerificationStatus, notes, Date.now(), agentId).run();

    return verification;
}
