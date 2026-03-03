/**
 * Florida Sunbiz Entity Lookup Provider
 * Source: search.sunbiz.org — Division of Corporations
 *
 * OSINT MODE:  Scrapes the Sunbiz search results page for entity details.
 *              No official API exists; this parses the HTML response.
 * LICENSED:    TODO — Swap in a licensed corporate data vendor API (e.g., SunbizDaily.com).
 *
 * Only queried when owner_name appears to be an entity (LLC, INC, CORP, TRUST, LP).
 */

import { EntityProvider, EntityRecord } from './types';
import { PROVIDER_CONFIGS } from './provider_configs';

const SUNBIZ_SEARCH_URL = 'https://search.sunbiz.org/Inquiry/CorporationSearch/SearchByName';

export class SunbizProvider implements EntityProvider {

    async lookupByName(entityName: string): Promise<EntityRecord | null> {
        const config = PROVIDER_CONFIGS['Sunbiz'];

        if (config.mode === 'licensed' && config.licensedApiUrl) {
            // TODO: Replace with licensed corporate data API (e.g. SunbizDaily.com)
        }

        return this.scrapeSunbiz(entityName);
    }

    // ─── Sunbiz HTML Scraper ────────────────────────────────
    private async scrapeSunbiz(entityName: string): Promise<EntityRecord | null> {
        try {
            // Step 1: Search by entity name
            const searchUrl = `${SUNBIZ_SEARCH_URL}?` +
                `searchNameOrder=${encodeURIComponent(entityName)}` +
                `&searchTerm=${encodeURIComponent(entityName)}` +
                `&listNameOrder=${encodeURIComponent(entityName)}`;

            const searchResponse = await fetch(searchUrl, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ClosrBot/1.0; +https://closr.com)',
                    'Accept': 'text/html',
                },
            });

            if (!searchResponse.ok) {
                console.error(`Sunbiz search HTTP ${searchResponse.status}`);
                return null;
            }

            const html = await searchResponse.text();

            // Step 2: Parse the search results page for the first match
            const result = this.parseSearchResults(html, entityName);
            if (!result) return null;

            // Step 3: If we found a detail link, fetch the detail page for more info
            if (result.detailUrl) {
                const detailRecord = await this.fetchDetailPage(result.detailUrl, result);
                if (detailRecord) return detailRecord;
            }

            return result.record;
        } catch (error) {
            console.error('Sunbiz scrape failed:', error);
            return null;
        }
    }

    private parseSearchResults(html: string, searchName: string): { record: EntityRecord; detailUrl: string | null } | null {
        // The Sunbiz search results page contains a table with columns:
        // Entity Name | Document Number | Status | Filing Date | Detail Link

        const tableMatch = html.match(/id="searchResultsTable"[\s\S]*?<tbody>([\s\S]*?)<\/tbody>/i);
        if (!tableMatch) return null;

        const rowMatch = tableMatch[1].match(/<tr[\s\S]*?>([\s\S]*?)<\/tr>/i);
        if (!rowMatch) return null;

        const cells = rowMatch[1].match(/<td[\s\S]*?>([\s\S]*?)<\/td>/gi) || [];
        if (cells.length < 4) return null;

        const stripHtml = (s: string) => s.replace(/<[^>]*>/g, '').trim();

        const entityNameResult = stripHtml(cells[0]);
        const docNumber = stripHtml(cells[1]);
        const status = stripHtml(cells[2]);
        const filingDate = stripHtml(cells[3]);

        // Extract detail URL from the first cell's anchor
        const linkMatch = cells[0].match(/href="([^"]+)"/i);
        const detailUrl = linkMatch ? `https://search.sunbiz.org${linkMatch[1]}` : null;

        const entityType = this.detectEntityType(entityNameResult);

        const record: EntityRecord = {
            entity_name: entityNameResult || searchName,
            entity_type: entityType,
            status: status || 'Unknown',
            filing_number: docNumber || '',
            filing_date: filingDate || '',
            registered_agent: '',
            principal_address: '',
            mailing_address: '',
            source_url: detailUrl || `${SUNBIZ_SEARCH_URL}?searchNameOrder=${encodeURIComponent(searchName)}`,
            retrieved_at: new Date().toISOString(),
        };

        return { record, detailUrl };
    }

    private async fetchDetailPage(url: string, base: { record: EntityRecord }): Promise<EntityRecord | null> {
        try {
            const response = await fetch(url, {
                headers: {
                    'User-Agent': 'Mozilla/5.0 (compatible; ClosrBot/1.0; +https://closr.com)',
                    'Accept': 'text/html',
                },
            });

            if (!response.ok) return null;

            const html = await response.text();
            const record = { ...base.record, source_url: url };

            // Parse registered agent
            const agentMatch = html.match(/Registered Agent.*?<span[^>]*>([\s\S]*?)<\/span>/i);
            if (agentMatch) {
                record.registered_agent = agentMatch[1].replace(/<[^>]*>/g, '').trim();
            }

            // Parse principal address
            const principalMatch = html.match(/Principal Address.*?<div[^>]*>([\s\S]*?)<\/div>/i);
            if (principalMatch) {
                record.principal_address = principalMatch[1].replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]*>/g, '').trim();
            }

            // Parse mailing address
            const mailingMatch = html.match(/Mailing Address.*?<div[^>]*>([\s\S]*?)<\/div>/i);
            if (mailingMatch) {
                record.mailing_address = mailingMatch[1].replace(/<br\s*\/?>/gi, ', ').replace(/<[^>]*>/g, '').trim();
            }

            return record;
        } catch {
            return base.record;
        }
    }

    private detectEntityType(name: string): string {
        const upper = name.toUpperCase();
        if (upper.includes('LLC') || upper.includes('L.L.C.')) return 'LLC';
        if (upper.includes('INC') || upper.includes('INCORPORATED')) return 'CORP';
        if (upper.includes('CORP') || upper.includes('CORPORATION')) return 'CORP';
        if (upper.includes('TRUST')) return 'TRUST';
        if (upper.includes('LP') || upper.includes('LIMITED PARTNERSHIP')) return 'LP';
        if (upper.includes('LTD')) return 'LTD';
        return 'LLC';
    }
}
