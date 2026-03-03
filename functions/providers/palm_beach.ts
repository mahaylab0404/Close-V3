/**
 * Palm Beach County Property Appraiser Provider
 * Source: pbcgov.org/papa — ArcGIS REST API (OpenData MapServer)
 *
 * OSINT MODE:  Live queries against the free Palm Beach County ArcGIS endpoint.
 *              Note: Some owner info may be redacted in the public layer.
 * LICENSED:    TODO — Swap in your licensed data vendor API.
 */

import { PropertyProvider, PropertyRecord } from './types';
import { PROVIDER_CONFIGS } from './provider_configs';

const ARCGIS_BASE = 'https://maps.co.palm-beach.fl.us/arcgis/rest/services/OpenData/OpenData/MapServer/0/query';

const OUT_FIELDS = [
    'GPIN', 'OWNER', 'STNO', 'STNAME', 'CITY', 'ZIP',
    'ASSESSED_VAL', 'MARKET_VAL', 'HOMESTEAD', 'YEAR_BUILT',
    'DEED_DATE', 'DEED_AMT', 'BEDROOMS', 'BATHROOMS', 'BLDGSQFT',
    'LAND_USE', 'MAIL_ADDR', 'MAIL_CITY', 'MAIL_ZIP', 'LEGALDESC',
    'ACREAGE',
].join(',');

function mapPBLandUse(code: string | number): string {
    const c = String(code).padStart(2, '0');
    const types: Record<string, string> = {
        '01': 'SFH', '02': 'Mobile Home', '03': 'Multi-Family',
        '04': 'Condo', '05': 'Condo', '06': 'Multi-Family',
        '07': 'SFH', '08': 'Multi-Family', '09': 'Vacant', '10': 'Vacant',
    };
    return types[c] || 'SFH';
}

function mapPBToPropertyRecord(attrs: any): PropertyRecord {
    const saleDate = attrs.DEED_DATE
        ? new Date(attrs.DEED_DATE).toISOString().split('T')[0]
        : 'Unknown';

    const siteAddr = [attrs.STNO, attrs.STNAME].filter(Boolean).join(' ');

    return {
        parcel_id: attrs.GPIN || '',
        owner_name: attrs.OWNER || 'Redacted / Confidential',
        mailing_address: [attrs.MAIL_ADDR, attrs.MAIL_CITY, attrs.MAIL_ZIP].filter(Boolean).join(', ') || '',
        property_address: [siteAddr, attrs.CITY, 'FL', attrs.ZIP].filter(Boolean).join(', '),
        property_type: mapPBLandUse(attrs.LAND_USE),
        last_sale_date: saleDate,
        last_sale_price: attrs.DEED_AMT || 0,
        assessed_value: attrs.ASSESSED_VAL || 0,
        market_value: attrs.MARKET_VAL || 0,
        homestead: attrs.HOMESTEAD === 'Y' || attrs.HOMESTEAD === 1 || attrs.HOMESTEAD === true,
        year_built: attrs.YEAR_BUILT || 0,
        bedrooms: attrs.BEDROOMS || 0,
        bathrooms: attrs.BATHROOMS || 0,
        sqft: attrs.BLDGSQFT || 0,
        legal_description: attrs.LEGALDESC || '',
        source_url: 'https://www.pbcpao.gov/',
        retrieved_at: new Date().toISOString(),
    };
}

export class PalmBeachProvider implements PropertyProvider {
    county = 'Palm Beach';

    async lookupByAddress(normalizedAddress: string, apiKey?: string): Promise<PropertyRecord | null> {
        const config = PROVIDER_CONFIGS['Palm Beach'];

        if (config.mode === 'licensed' && config.licensedApiUrl) {
            // TODO: Replace with licensed vendor API
        }

        const addr = normalizedAddress.toUpperCase().replace(/'/g, "''");
        // Try searching by street name
        const result = await this.queryArcGIS(`STNAME LIKE '%${addr}%'`);
        if (result) return result;

        // Fallback: wildcard query
        return this.queryArcGISWildcard(`CONCAT(STNO, ' ', STNAME) LIKE '%${addr}%'`);
    }

    async lookupByParcel(parcelId: string): Promise<PropertyRecord | null> {
        return this.queryArcGIS(`GPIN='${parcelId.replace(/'/g, "''")}'`);
    }

    // ─── ArcGIS REST Query ──────────────────────────────────
    private async queryArcGIS(where: string): Promise<PropertyRecord | null> {
        try {
            const url = `${ARCGIS_BASE}?` +
                `where=${encodeURIComponent(where)}` +
                `&outFields=${OUT_FIELDS}` +
                `&returnGeometry=false&f=json&resultRecordCount=1`;

            const response = await fetch(url);
            if (!response.ok) {
                console.error(`Palm Beach ArcGIS HTTP ${response.status}`);
                return null;
            }

            const data = await response.json() as any;

            if (!data.features || data.features.length === 0) {
                return null;
            }

            return mapPBToPropertyRecord(data.features[0].attributes);
        } catch (error) {
            console.error('Palm Beach ArcGIS query failed:', error);
            return null;
        }
    }

    private async queryArcGISWildcard(where: string): Promise<PropertyRecord | null> {
        try {
            const url = `${ARCGIS_BASE}?` +
                `where=${encodeURIComponent(where)}` +
                `&outFields=*` +
                `&returnGeometry=false&f=json&resultRecordCount=1`;

            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json() as any;
            if (!data.features || data.features.length === 0) return null;

            const attrs = data.features[0].attributes;
            return {
                parcel_id: attrs.GPIN || attrs.PARCEL_ID || attrs.PCN || '',
                owner_name: attrs.OWNER || attrs.OWNER_NAME || attrs.OWNER1 || 'Redacted',
                mailing_address: attrs.MAIL_ADDR || '',
                property_address: attrs.STNAME ? `${attrs.STNO || ''} ${attrs.STNAME}`.trim() : '',
                property_type: mapPBLandUse(attrs.LAND_USE || attrs.DOR_UC || '01'),
                last_sale_date: attrs.DEED_DATE ? new Date(attrs.DEED_DATE).toISOString().split('T')[0] : 'Unknown',
                last_sale_price: attrs.DEED_AMT || attrs.SALE_PRC || 0,
                assessed_value: attrs.ASSESSED_VAL || attrs.ASS_VAL || 0,
                market_value: attrs.MARKET_VAL || attrs.MKT_VAL || attrs.JUST_VAL || 0,
                homestead: attrs.HOMESTEAD === 'Y' || attrs.HOMESTEAD === 1,
                year_built: attrs.YEAR_BUILT || attrs.YR_BLT || 0,
                bedrooms: attrs.BEDROOMS || attrs.BEDROOM_CNT || 0,
                bathrooms: attrs.BATHROOMS || attrs.BATH_CNT || 0,
                sqft: attrs.BLDGSQFT || attrs.BLDG_SQFT || 0,
                legal_description: attrs.LEGALDESC || attrs.LEGAL || '',
                source_url: 'https://www.pbcpao.gov/',
                retrieved_at: new Date().toISOString(),
            };
        } catch {
            return null;
        }
    }
}
