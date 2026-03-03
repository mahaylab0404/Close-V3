/**
 * Broward County Property Appraiser Provider
 * Source: bcpa.net — Broward County GeoHub ArcGIS REST API
 *
 * OSINT MODE:  Live queries against the free Broward GeoHub ArcGIS endpoint.
 * LICENSED:    TODO — Swap in your licensed data vendor API.
 */

import { PropertyProvider, PropertyRecord } from './types';
import { PROVIDER_CONFIGS } from './provider_configs';

const ARCGIS_BASE = 'https://bcgishub.broward.org/server/rest/services/GeoHubDownloads/Parcels/FeatureServer/0/query';

const OUT_FIELDS = [
    'FOLIO', 'OWNNAME', 'SITEADDR', 'SITECITY', 'SITEZIP',
    'ASSESSED', 'MKT_VAL', 'HOMESTEAD', 'YEARBUILT', 'TOTLIVUNITS',
    'SALEDATE', 'SALEPRICE', 'BEDROOMS', 'BATHROOMS', 'BLDGSQFT',
    'LANDUSE', 'MAILADDR', 'MAILCITY', 'MAILZIP', 'LEGALDESC',
].join(',');

function mapLandUse(code: string | number): string {
    const c = String(code).padStart(2, '0');
    const types: Record<string, string> = {
        '01': 'SFH', '02': 'Mobile Home', '03': 'Multi-Family',
        '04': 'Condo', '05': 'Condo', '06': 'Multi-Family',
        '07': 'SFH', '08': 'Multi-Family', '09': 'Vacant', '10': 'Vacant',
    };
    return types[c] || 'SFH';
}

function mapBrowardToPropertyRecord(attrs: any): PropertyRecord {
    const saleDate = attrs.SALEDATE
        ? new Date(attrs.SALEDATE).toISOString().split('T')[0]
        : 'Unknown';

    return {
        parcel_id: attrs.FOLIO || '',
        owner_name: attrs.OWNNAME || 'Unknown',
        mailing_address: [attrs.MAILADDR, attrs.MAILCITY, attrs.MAILZIP].filter(Boolean).join(', ') || '',
        property_address: [attrs.SITEADDR, attrs.SITECITY, 'FL', attrs.SITEZIP].filter(Boolean).join(', '),
        property_type: mapLandUse(attrs.LANDUSE),
        last_sale_date: saleDate,
        last_sale_price: attrs.SALEPRICE || 0,
        assessed_value: attrs.ASSESSED || 0,
        market_value: attrs.MKT_VAL || 0,
        homestead: attrs.HOMESTEAD === 'Y' || attrs.HOMESTEAD === 1 || attrs.HOMESTEAD === true,
        year_built: attrs.YEARBUILT || 0,
        bedrooms: attrs.BEDROOMS || 0,
        bathrooms: attrs.BATHROOMS || 0,
        sqft: attrs.BLDGSQFT || 0,
        legal_description: attrs.LEGALDESC || '',
        source_url: `https://web.bcpa.net/BcpaClient/#/Record-Search`,
        retrieved_at: new Date().toISOString(),
    };
}

export class BrowardProvider implements PropertyProvider {
    county = 'Broward';

    async lookupByAddress(normalizedAddress: string, apiKey?: string): Promise<PropertyRecord | null> {
        const config = PROVIDER_CONFIGS['Broward'];

        if (config.mode === 'licensed' && config.licensedApiUrl) {
            // TODO: Replace with licensed vendor API
        }

        return this.queryArcGIS(`SITEADDR LIKE '%${normalizedAddress.toUpperCase().replace(/'/g, "''")}%'`);
    }

    async lookupByParcel(parcelId: string): Promise<PropertyRecord | null> {
        return this.queryArcGIS(`FOLIO='${parcelId.replace(/'/g, "''")}'`);
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
                console.error(`Broward GeoHub HTTP ${response.status}`);
                return null;
            }

            const data = await response.json() as any;

            if (!data.features || data.features.length === 0) {
                // Fallback: query with outFields=* in case field names differ
                return this.queryArcGISWildcard(where);
            }

            return mapBrowardToPropertyRecord(data.features[0].attributes);
        } catch (error) {
            console.error('Broward GeoHub query failed:', error);
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
                parcel_id: attrs.FOLIO || attrs.PARCEL_ID || attrs.PCN || '',
                owner_name: attrs.OWNNAME || attrs.OWNER || attrs.OWNER_NAME || attrs.OWNER1 || 'Unknown',
                mailing_address: attrs.MAILADDR || attrs.MAIL_ADDR || '',
                property_address: attrs.SITEADDR || attrs.SITE_ADDR || attrs.ADDRESS || '',
                property_type: mapLandUse(attrs.LANDUSE || attrs.LAND_USE || attrs.DOR_UC || '01'),
                last_sale_date: attrs.SALEDATE ? new Date(attrs.SALEDATE).toISOString().split('T')[0]
                    : attrs.SALE_DATE ? new Date(attrs.SALE_DATE).toISOString().split('T')[0] : 'Unknown',
                last_sale_price: attrs.SALEPRICE || attrs.SALE_PRICE || attrs.SALE_PRC1 || 0,
                assessed_value: attrs.ASSESSED || attrs.ASS_VAL || attrs.ASSESSED_VAL || 0,
                market_value: attrs.MKT_VAL || attrs.MARKET_VAL || attrs.JUST_VAL || 0,
                homestead: attrs.HOMESTEAD === 'Y' || attrs.HOMESTEAD === 1 || attrs.HSEX_YN === 'Y',
                year_built: attrs.YEARBUILT || attrs.YR_BLT || attrs.YEAR_BUILT || 0,
                bedrooms: attrs.BEDROOMS || attrs.BEDROOM_CNT || 0,
                bathrooms: attrs.BATHROOMS || attrs.BATH_CNT || 0,
                sqft: attrs.BLDGSQFT || attrs.BLDG_SQFT || attrs.SQFT || 0,
                legal_description: attrs.LEGALDESC || attrs.LEGAL || '',
                source_url: 'https://web.bcpa.net/BcpaClient/#/Record-Search',
                retrieved_at: new Date().toISOString(),
            };
        } catch {
            return null;
        }
    }
}
