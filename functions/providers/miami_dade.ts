/**
 * Miami-Dade County Property Appraiser Provider
 * Source: miamidade.gov/pa — ArcGIS REST API (Property_Boundary_View FeatureServer)
 *
 * OSINT MODE:  Live queries against the free public ArcGIS REST endpoint.
 * LICENSED:    TODO — Swap in your licensed data vendor API.
 */

import { PropertyProvider, PropertyRecord } from './types';
import { PROVIDER_CONFIGS } from './provider_configs';

const ARCGIS_BASE = 'https://services.arcgis.com/8Pc9XBTAsYuxx47m/arcgis/rest/services/Property_Boundary_View/FeatureServer/0/query';

const OUT_FIELDS = [
    'FOLIO', 'OWNER1', 'SITUS_ADDR', 'SITUS_CITY', 'SITUS_ZIP',
    'ASS_VAL', 'MKT_VAL', 'HSEX_YN', 'YR_BLT', 'BLDG_SQFT',
    'SALE_DATE1', 'SALE_PRC1', 'BEDROOM_CNT', 'BATH_CNT', 'DOR_UC',
    'MAIL_ADDR', 'MAIL_CITY', 'MAIL_ZIP',
].join(',');

function mapPropertyType(dorCode: string | number): string {
    const code = String(dorCode).padStart(2, '0');
    const types: Record<string, string> = {
        '01': 'SFH', '02': 'Mobile Home', '03': 'Multi-Family',
        '04': 'Condo', '05': 'Condo', '06': 'Multi-Family',
        '07': 'SFH', '08': 'Multi-Family', '09': 'Vacant',
    };
    return types[code] || 'SFH';
}

function mapArcGISToPropertyRecord(attrs: any): PropertyRecord {
    const saleDate = attrs.SALE_DATE1
        ? new Date(attrs.SALE_DATE1).toISOString().split('T')[0]
        : 'Unknown';

    return {
        parcel_id: attrs.FOLIO || '',
        owner_name: attrs.OWNER1 || 'Unknown',
        mailing_address: [attrs.MAIL_ADDR, attrs.MAIL_CITY, attrs.MAIL_ZIP].filter(Boolean).join(', ') || '',
        property_address: [attrs.SITUS_ADDR, attrs.SITUS_CITY, 'FL', attrs.SITUS_ZIP].filter(Boolean).join(', '),
        property_type: mapPropertyType(attrs.DOR_UC),
        last_sale_date: saleDate,
        last_sale_price: attrs.SALE_PRC1 || 0,
        assessed_value: attrs.ASS_VAL || 0,
        market_value: attrs.MKT_VAL || 0,
        homestead: attrs.HSEX_YN === 'Y',
        year_built: attrs.YR_BLT || 0,
        bedrooms: attrs.BEDROOM_CNT || 0,
        bathrooms: attrs.BATH_CNT || 0,
        sqft: attrs.BLDG_SQFT || 0,
        legal_description: '',
        source_url: `https://www.miamidadepa.gov/propertysearch/#/folio/${attrs.FOLIO || ''}`,
        retrieved_at: new Date().toISOString(),
    };
}

export class MiamiDadeProvider implements PropertyProvider {
    county = 'Miami-Dade';

    async lookupByAddress(normalizedAddress: string, apiKey?: string): Promise<PropertyRecord | null> {
        // 1. Try ArcGIS first (if working)
        const arcGisRecord = await this.queryArcGIS(`SITUS_ADDR LIKE '%${normalizedAddress.toUpperCase().replace(/'/g, "''")}%'`);
        if (arcGisRecord) return arcGisRecord;

        // 2. Fallback to Gemini Grounding (if API key provided)
        if (apiKey) {
            console.log(`[MiamiDadeProvider] ArcGIS failed, falling back to Gemini for: ${normalizedAddress}`);
            return this.lookupViaGemini(normalizedAddress, apiKey);
        }

        return null;
    }

    async lookupByParcel(parcelId: string): Promise<PropertyRecord | null> {
        return this.queryArcGIS(`FOLIO='${parcelId.replace(/'/g, "''")}'`);
    }

    // ─── Gemini Fallback ────────────────────────────────────
    private async lookupViaGemini(address: string, apiKey: string): Promise<PropertyRecord | null> {
        try {
            const prompt = `
            Act as a Miami-Dade Property Appraiser verified data extractor.
            TASK: Search specifically for the official property record for address: "${address}" in Miami-Dade County, FL.
            
            REQUIRED: Identify the current OWNER NAME, Assessed Value, and Year Built.
            
            Return JSON ONLY:
            {
              "owner_name": "Full Name or Entity",
              "parcel_id": "Folio Number",
              "assessed_value": 0,
              "market_value": 0,
              "year_built": 0,
              "sqft": 0,
              "homestead": boolean,
              "last_sale_date": "YYYY-MM-DD"
            }
            `;

            const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/gemini-1.5-flash:generateContent?key=${apiKey}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    contents: [{ parts: [{ text: prompt }] }],
                    tools: [{ google_search: {} }]
                })
            });

            if (!response.ok) {
                console.error(`Gemini Lookup Failed: ${response.status}`);
                return null;
            }

            const data = await response.json() as any;
            const text = data.candidates?.[0]?.content?.parts?.[0]?.text;
            if (!text) return null;

            // Extract JSON
            const jsonMatch = text.match(/\{[\s\S]*\}/);
            if (!jsonMatch) return null;

            const result = JSON.parse(jsonMatch[0]);

            return {
                parcel_id: result.parcel_id || '',
                owner_name: result.owner_name || 'Unknown',
                mailing_address: 'Unknown', // Gemini usually struggles to distinct this from situs without deep scraping
                property_address: address,
                property_type: 'Unknown',
                last_sale_date: result.last_sale_date || '',
                last_sale_price: 0,
                assessed_value: result.assessed_value || 0,
                market_value: result.market_value || 0,
                homestead: result.homestead || false,
                year_built: result.year_built || 0,
                bedrooms: 0,
                bathrooms: 0,
                sqft: result.sqft || 0,
                legal_description: 'Gemini-sourced',
                source_url: 'https://www.miamidadepa.gov/propertysearch/',
                retrieved_at: new Date().toISOString(),
            };

        } catch (error) {
            console.error('Gemini fallback failed:', error);
            return null;
        }
    }

    // ─── ArcGIS REST Query ──────────────────────────────────
    private async queryArcGIS(where: string): Promise<PropertyRecord | null> {
        try {
            const url = `${ARCGIS_BASE}?` +
                `where=${encodeURIComponent(where)}` +
                `&outFields=${OUT_FIELDS}` +
                `&returnGeometry=false&f=json&resultRecordCount=1`;

            const response = await fetch(url);
            if (!response.ok) return null;

            const data = await response.json() as any;
            if (!data.features || data.features.length === 0) return null;

            return mapArcGISToPropertyRecord(data.features[0].attributes);
        } catch (error) {
            return null;
        }
    }
}
