// Florida Public Data Service - Improved with Strict Filtering

// =============================================================================
// MIAMI-DADE PROPERTY APPRAISER (Free ArcGIS REST API)
// =============================================================================

export interface PropertyRecord {
    folio: string;
    ownerName: string;
    address: string;
    city: string;
    zip: string;
    assessedValue: number;
    marketValue: number;
    homestead: boolean;
    yearBuilt: number;
    sqft: number;
    lastSaleDate: string;
    lastSalePrice: number;
    bedrooms: number;
    bathrooms: number;
    propertyType: string;
    tenure: number; // years of ownership
}

export interface BuildingPermit {
    permitNumber: string;
    type: string; // roof, hvac, electrical, plumbing
    issueDate: string;
    status: string;
    contractor: string;
    jobValue: number;
    address: string;
}

export interface LeadSignal {
    type: 'high_tenure' | 'recent_permit' | 'probate' | 'foreclosure' | 'estate';
    description: string;
    strength: 'strong' | 'moderate' | 'weak';
    source: string;
    sourceUrl: string;
    date?: string;
    caseNumber?: string;
}

export interface DiscoveredLead {
    id: string;
    name: string;
    address: string;
    county: string;
    folio?: string;
    score: number;
    verificationLevel: 'verified_record' | 'high_probability' | 'signal_only';
    signals: LeadSignal[];
    property?: PropertyRecord;
    estimatedEquity?: string;
    motivationTrigger: string;
}

// ArcGIS API base URLs for each county
const MD_ARCGIS_BASE = 'https://services.arcgis.com/8Pc9XBTAsYuxx47m/arcgis/rest/services';
const BROWARD_ARCGIS_BASE = 'https://services.arcgis.com/aJ16ENn1AaqdFlqx/arcgis/rest/services';
const PBC_ARCGIS_BASE = 'https://opendata2-pbcgov.opendata.arcgis.com/arcgis/rest/services';

// =============================================================================
// MIAMI-DADE PROPERTY APPRAISER (Free ArcGIS REST API)
// =============================================================================

/**
 * Search Miami-Dade Property Appraiser by address
 */
export const searchMiamiDadeProperty = async (address: string): Promise<PropertyRecord[]> => {
    try {
        const encoded = encodeURIComponent(address.toUpperCase());
        const url = `${MD_ARCGIS_BASE}/Property_Boundary_View/FeatureServer/0/query?` +
            `where=SITUS_ADDR LIKE '%${encoded}%'` +
            `&outFields=FOLIO,OWNER1,SITUS_ADDR,SITUS_CITY,SITUS_ZIP,ASS_VAL,MKT_VAL,HSEX_YN,YR_BLT,BLDG_SQFT,SALE_DATE1,SALE_PRC1,BEDROOM_CNT,BATH_CNT,DOR_UC` +
            `&returnGeometry=false&f=json&resultRecordCount=25`;

        const response = await fetch(url);
        const data = await response.json() as any;

        if (!data.features) return [];

        const currentYear = new Date().getFullYear();

        return data.features.map((f: any) => {
            const a = f.attributes;
            const saleYear = a.SALE_DATE1 ? new Date(a.SALE_DATE1).getFullYear() : currentYear;
            return {
                folio: a.FOLIO || '',
                ownerName: a.OWNER1 || 'Unknown',
                address: a.SITUS_ADDR || '',
                city: a.SITUS_CITY || '',
                zip: a.SITUS_ZIP || '',
                assessedValue: a.ASS_VAL || 0,
                marketValue: a.MKT_VAL || 0,
                homestead: a.HSEX_YN === 'Y',
                yearBuilt: a.YR_BLT || 0,
                sqft: a.BLDG_SQFT || 0,
                lastSaleDate: a.SALE_DATE1 ? new Date(a.SALE_DATE1).toISOString().split('T')[0] : 'Unknown',
                lastSalePrice: a.SALE_PRC1 || 0,
                bedrooms: a.BEDROOM_CNT || 0,
                bathrooms: a.BATH_CNT || 0,
                propertyType: mapPropertyType(a.DOR_UC),
                tenure: currentYear - saleYear,
            };
        });
    } catch (error) {
        console.error('Miami-Dade API error:', error);
        return [];
    }
};

/**
 * Find "Verified" High-Tenure Homeowners — Miami-Dade
 * Ideally 20+ years, Homestead Exempted, Single Family/Condo only.
 */
export const findHighTenureOwners = async (zipCode: string, minTenure: number = 20): Promise<PropertyRecord[]> => {
    try {
        const cutoffYear = new Date().getFullYear() - minTenure;
        const cutoffDate = new Date(cutoffYear, 0, 1).getTime();

        // DOR Codes: 01 (Single Family), 02 (Mobile Home), 04 (Condo), 05 (Co-Op)
        // We exclude Multi-Family (03, 08) and Vacant Land (00, 10, etc.)
        const dorFilter = `(DOR_UC='01' OR DOR_UC='02' OR DOR_UC='04' OR DOR_UC='05')`;

        const url = `${MD_ARCGIS_BASE}/Property_Boundary_View/FeatureServer/0/query?` +
            `where=SITUS_ZIP='${zipCode}' AND SALE_DATE1<${cutoffDate} AND HSEX_YN='Y' AND ${dorFilter}` +
            `&outFields=FOLIO,OWNER1,SITUS_ADDR,SITUS_CITY,SITUS_ZIP,ASS_VAL,MKT_VAL,HSEX_YN,YR_BLT,BLDG_SQFT,SALE_DATE1,SALE_PRC1,BEDROOM_CNT,BATH_CNT,DOR_UC` +
            `&returnGeometry=false&f=json&resultRecordCount=50&orderByFields=SALE_DATE1 ASC`;

        const response = await fetch(url);
        const data = await response.json() as any;

        if (!data.features) return [];

        const currentYear = new Date().getFullYear();

        return data.features.map((f: any) => {
            const a = f.attributes;
            const saleYear = a.SALE_DATE1 ? new Date(a.SALE_DATE1).getFullYear() : currentYear;
            return {
                folio: a.FOLIO || '',
                ownerName: a.OWNER1 || 'Unknown',
                address: a.SITUS_ADDR || '',
                city: a.SITUS_CITY || '',
                zip: a.SITUS_ZIP || '',
                assessedValue: a.ASS_VAL || 0,
                marketValue: a.MKT_VAL || 0,
                homestead: a.HSEX_YN === 'Y',
                yearBuilt: a.YR_BLT || 0,
                sqft: a.BLDG_SQFT || 0,
                lastSaleDate: a.SALE_DATE1 ? new Date(a.SALE_DATE1).toISOString().split('T')[0] : 'Unknown',
                lastSalePrice: a.SALE_PRC1 || 0,
                bedrooms: a.BEDROOM_CNT || 0,
                bathrooms: a.BATH_CNT || 0,
                propertyType: mapPropertyType(a.DOR_UC),
                tenure: currentYear - saleYear,
            };
        });
    } catch (error) {
        console.error('High-tenure search error:', error);
        return [];
    }
};

/**
 * Search Miami-Dade building permits for recent renovations
 */
export const searchBuildingPermits = async (address: string): Promise<BuildingPermit[]> => {
    try {
        const encoded = encodeURIComponent(address.toUpperCase());
        const url = `https://gisweb.miamidade.gov/arcgis/rest/services/Building/BuildingPermitsLast3Years/MapServer/0/query?` +
            `where=BLDG_ADDR LIKE '%${encoded}%'` +
            `&outFields=PERMIT_NUM,SCOPE_OF_WORK,ISSUE_DATE,PERMIT_STATUS,CONTRACTOR_NAME,JOB_VALUE,BLDG_ADDR` +
            `&returnGeometry=false&f=json&resultRecordCount=20`;

        const response = await fetch(url);
        const data = await response.json() as any;

        if (!data.features) return [];

        return data.features.map((f: any) => {
            const a = f.attributes;
            return {
                permitNumber: a.PERMIT_NUM || '',
                type: categorizePermit(a.SCOPE_OF_WORK || ''),
                issueDate: a.ISSUE_DATE ? new Date(a.ISSUE_DATE).toISOString().split('T')[0] : 'Unknown',
                status: a.PERMIT_STATUS || 'Unknown',
                contractor: a.CONTRACTOR_NAME || 'Not Listed',
                jobValue: a.JOB_VALUE || 0,
                address: a.BLDG_ADDR || '',
            };
        });
    } catch (error) {
        console.error('Permit search error:', error);
        return [];
    }
};

// =============================================================================
// BROWARD COUNTY PROPERTY APPRAISER (BCPA ArcGIS)
// =============================================================================

/**
 * Search Broward County property records by address
 */
export const searchBrowardProperty = async (address: string): Promise<PropertyRecord[]> => {
    try {
        const encoded = encodeURIComponent(address.toUpperCase());
        const url = `${BROWARD_ARCGIS_BASE}/Broward_County/FeatureServer/0/query?` +
            `where=SITUS LIKE '%${encoded}%'` +
            `&outFields=FOLIO,OWNER1,SITUS,SITUS_CITY,SITUS_ZIP,ASSESSED,MARKET,HMSTD,YEAR_BUILT,TOTAL_SQFT,SALE_DATE,SALE_PRICE,BEDS,BATHS,USE_CODE` +
            `&returnGeometry=false&f=json&resultRecordCount=25`;

        const response = await fetch(url);
        const data = await response.json() as any;

        if (!data.features) return [];
        const currentYear = new Date().getFullYear();

        return data.features.map((f: any) => {
            const a = f.attributes;
            const saleYear = a.SALE_DATE ? new Date(a.SALE_DATE).getFullYear() : currentYear;
            return {
                folio: a.FOLIO || '',
                ownerName: a.OWNER1 || 'Unknown',
                address: a.SITUS || '',
                city: a.SITUS_CITY || '',
                zip: a.SITUS_ZIP || '',
                assessedValue: a.ASSESSED || 0,
                marketValue: a.MARKET || 0,
                homestead: a.HMSTD === 'Y' || a.HMSTD === 1 || a.HMSTD === true,
                yearBuilt: a.YEAR_BUILT || 0,
                sqft: a.TOTAL_SQFT || 0,
                lastSaleDate: a.SALE_DATE ? new Date(a.SALE_DATE).toISOString().split('T')[0] : 'Unknown',
                lastSalePrice: a.SALE_PRICE || 0,
                bedrooms: a.BEDS || 0,
                bathrooms: a.BATHS || 0,
                propertyType: mapPropertyType(a.USE_CODE),
                tenure: currentYear - saleYear,
            };
        });
    } catch (error) {
        console.error('Broward API error:', error);
        return [];
    }
};

/**
 * Find high-tenure homeowners in Broward County
 */
export const findBrowardHighTenureOwners = async (zipCode: string, minTenure: number = 20): Promise<PropertyRecord[]> => {
    try {
        const cutoffYear = new Date().getFullYear() - minTenure;
        const cutoffDate = new Date(cutoffYear, 0, 1).getTime();
        const useFilter = `(USE_CODE='0100' OR USE_CODE='0200' OR USE_CODE='0400' OR USE_CODE='0500' OR USE_CODE='01' OR USE_CODE='02' OR USE_CODE='04' OR USE_CODE='05')`;

        const url = `${BROWARD_ARCGIS_BASE}/Broward_County/FeatureServer/0/query?` +
            `where=SITUS_ZIP='${zipCode}' AND SALE_DATE<${cutoffDate} AND HMSTD='Y' AND ${useFilter}` +
            `&outFields=FOLIO,OWNER1,SITUS,SITUS_CITY,SITUS_ZIP,ASSESSED,MARKET,HMSTD,YEAR_BUILT,TOTAL_SQFT,SALE_DATE,SALE_PRICE,BEDS,BATHS,USE_CODE` +
            `&returnGeometry=false&f=json&resultRecordCount=50&orderByFields=SALE_DATE ASC`;

        const response = await fetch(url);
        const data = await response.json() as any;

        if (!data.features) return [];
        const currentYear = new Date().getFullYear();

        return data.features.map((f: any) => {
            const a = f.attributes;
            const saleYear = a.SALE_DATE ? new Date(a.SALE_DATE).getFullYear() : currentYear;
            return {
                folio: a.FOLIO || '',
                ownerName: a.OWNER1 || 'Unknown',
                address: a.SITUS || '',
                city: a.SITUS_CITY || '',
                zip: a.SITUS_ZIP || '',
                assessedValue: a.ASSESSED || 0,
                marketValue: a.MARKET || 0,
                homestead: true,
                yearBuilt: a.YEAR_BUILT || 0,
                sqft: a.TOTAL_SQFT || 0,
                lastSaleDate: a.SALE_DATE ? new Date(a.SALE_DATE).toISOString().split('T')[0] : 'Unknown',
                lastSalePrice: a.SALE_PRICE || 0,
                bedrooms: a.BEDS || 0,
                bathrooms: a.BATHS || 0,
                propertyType: mapPropertyType(a.USE_CODE),
                tenure: currentYear - saleYear,
            };
        });
    } catch (error) {
        console.error('Broward high-tenure search error:', error);
        return [];
    }
};

// =============================================================================
// PALM BEACH COUNTY PROPERTY APPRAISER (PBC Open Data ArcGIS)
// =============================================================================

/**
 * Search Palm Beach County property records by address
 */
export const searchPalmBeachProperty = async (address: string): Promise<PropertyRecord[]> => {
    try {
        const encoded = encodeURIComponent(address.toUpperCase());
        const url = `${PBC_ARCGIS_BASE}/Parcels/Parcels/MapServer/0/query?` +
            `where=ADDR LIKE '%${encoded}%'` +
            `&outFields=PARCEL,OWNER,ADDR,CITY,ZIP,ASS_VAL,MKT_VAL,HMSTD,YR_BLT,BLDG_SQFT,SALE_DT,SALE_PRC,BEDS,BATHS,DOR_UC` +
            `&returnGeometry=false&f=json&resultRecordCount=25`;

        const response = await fetch(url);
        const data = await response.json() as any;

        if (!data.features) return [];
        const currentYear = new Date().getFullYear();

        return data.features.map((f: any) => {
            const a = f.attributes;
            const saleYear = a.SALE_DT ? new Date(a.SALE_DT).getFullYear() : currentYear;
            return {
                folio: a.PARCEL || '',
                ownerName: a.OWNER || 'Unknown',
                address: a.ADDR || '',
                city: a.CITY || '',
                zip: a.ZIP || '',
                assessedValue: a.ASS_VAL || 0,
                marketValue: a.MKT_VAL || 0,
                homestead: a.HMSTD === 'Y' || a.HMSTD === 1 || a.HMSTD === true,
                yearBuilt: a.YR_BLT || 0,
                sqft: a.BLDG_SQFT || 0,
                lastSaleDate: a.SALE_DT ? new Date(a.SALE_DT).toISOString().split('T')[0] : 'Unknown',
                lastSalePrice: a.SALE_PRC || 0,
                bedrooms: a.BEDS || 0,
                bathrooms: a.BATHS || 0,
                propertyType: mapPropertyType(a.DOR_UC),
                tenure: currentYear - saleYear,
            };
        });
    } catch (error) {
        console.error('Palm Beach API error:', error);
        return [];
    }
};

/**
 * Find high-tenure homeowners in Palm Beach County
 */
export const findPalmBeachHighTenureOwners = async (zipCode: string, minTenure: number = 20): Promise<PropertyRecord[]> => {
    try {
        const cutoffYear = new Date().getFullYear() - minTenure;
        const cutoffDate = new Date(cutoffYear, 0, 1).getTime();
        const dorFilter = `(DOR_UC='01' OR DOR_UC='02' OR DOR_UC='04' OR DOR_UC='05')`;

        const url = `${PBC_ARCGIS_BASE}/Parcels/Parcels/MapServer/0/query?` +
            `where=ZIP='${zipCode}' AND SALE_DT<${cutoffDate} AND HMSTD='Y' AND ${dorFilter}` +
            `&outFields=PARCEL,OWNER,ADDR,CITY,ZIP,ASS_VAL,MKT_VAL,HMSTD,YR_BLT,BLDG_SQFT,SALE_DT,SALE_PRC,BEDS,BATHS,DOR_UC` +
            `&returnGeometry=false&f=json&resultRecordCount=50&orderByFields=SALE_DT ASC`;

        const response = await fetch(url);
        const data = await response.json() as any;

        if (!data.features) return [];
        const currentYear = new Date().getFullYear();

        return data.features.map((f: any) => {
            const a = f.attributes;
            const saleYear = a.SALE_DT ? new Date(a.SALE_DT).getFullYear() : currentYear;
            return {
                folio: a.PARCEL || '',
                ownerName: a.OWNER || 'Unknown',
                address: a.ADDR || '',
                city: a.CITY || '',
                zip: a.ZIP || '',
                assessedValue: a.ASS_VAL || 0,
                marketValue: a.MKT_VAL || 0,
                homestead: true,
                yearBuilt: a.YR_BLT || 0,
                sqft: a.BLDG_SQFT || 0,
                lastSaleDate: a.SALE_DT ? new Date(a.SALE_DT).toISOString().split('T')[0] : 'Unknown',
                lastSalePrice: a.SALE_PRC || 0,
                bedrooms: a.BEDS || 0,
                bathrooms: a.BATHS || 0,
                propertyType: mapPropertyType(a.DOR_UC),
                tenure: currentYear - saleYear,
            };
        });
    } catch (error) {
        console.error('Palm Beach high-tenure search error:', error);
        return [];
    }
};

// =============================================================================
// MULTI-COUNTY SEARCH DISPATCHER
// =============================================================================

/**
 * Search property records by address across any supported county
 */
export const searchPropertyByCounty = async (address: string, county: string): Promise<PropertyRecord[]> => {
    switch (county) {
        case 'Miami-Dade': return searchMiamiDadeProperty(address);
        case 'Broward': return searchBrowardProperty(address);
        case 'Palm Beach': return searchPalmBeachProperty(address);
        default: return [];
    }
};

/**
 * Find high-tenure homeowners across any supported county
 */
export const findHighTenureByCounty = async (zipCode: string, county: string, minTenure: number = 20): Promise<PropertyRecord[]> => {
    switch (county) {
        case 'Miami-Dade': return findHighTenureOwners(zipCode, minTenure);
        case 'Broward': return findBrowardHighTenureOwners(zipCode, minTenure);
        case 'Palm Beach': return findPalmBeachHighTenureOwners(zipCode, minTenure);
        default: return [];
    }
};

/**
 * Get the county-specific property appraiser source info
 */
const getCountySourceInfo = (county: string, folio: string) => {
    switch (county) {
        case 'Miami-Dade':
            return {
                name: 'Miami-Dade Property Appraiser',
                url: `https://www.miamidadepa.gov/propertysearch/#/folio/${folio}`,
            };
        case 'Broward':
            return {
                name: 'Broward County Property Appraiser',
                url: `https://web.bcpa.net/BcpaClient/#/Record-Search`,
            };
        case 'Palm Beach':
            return {
                name: 'Palm Beach County Property Appraiser',
                url: `https://www.pbcgov.org/papa/Asps/PropertyDetail/PropertyDetail.aspx?parcel=${folio}`,
            };
        default:
            return { name: `${county} Property Appraiser`, url: '' };
    }
};

// =============================================================================
// LEAD SCORING ENGINE
// =============================================================================

/**
 * Calculate a lead score based on public record signals
 */
export const calculateLeadScore = (property: PropertyRecord, permits: BuildingPermit[], signals: LeadSignal[]): number => {
    let score = 0;

    // Tenure scoring (max 30 points)
    if (property.tenure >= 35) score += 30;
    else if (property.tenure >= 30) score += 25;
    else if (property.tenure >= 25) score += 20;
    else if (property.tenure >= 20) score += 15;
    else if (property.tenure >= 15) score += 10;

    // Equity scoring (max 25 points)
    const equityRatio = property.marketValue > 0 ?
        (property.marketValue - property.lastSalePrice) / property.marketValue : 0;
    if (equityRatio > 0.8) score += 25;
    else if (equityRatio > 0.6) score += 20;
    else if (equityRatio > 0.4) score += 15;
    else if (equityRatio > 0.2) score += 10;

    // Homestead "bonus" (actually critical for verifying it's a primary residence)
    if (property.homestead) score += 10;

    // Building age risk (max 10 points - older = higher signal)
    const age = new Date().getFullYear() - property.yearBuilt;
    if (age >= 50) score += 10;
    else if (age >= 40) score += 7;
    else if (age >= 30) score += 4;

    // Recent permits (max 15 points - recent major work = transition signal)
    const recentPermits = permits.filter(p => {
        const permitDate = new Date(p.issueDate);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return permitDate >= oneYearAgo;
    });

    if (recentPermits.length > 0) {
        const hasRoof = recentPermits.some(p => p.type === 'roof');
        const hasHVAC = recentPermits.some(p => p.type === 'hvac');
        if (hasRoof) score += 10;
        if (hasHVAC) score += 5;
        if (!hasRoof && !hasHVAC) score += recentPermits.length * 3;
    }

    // Signal bonuses (max 15 points)
    for (const signal of signals) {
        if (signal.type === 'probate') score += 15;
        else if (signal.type === 'foreclosure') score += 12;
        else if (signal.type === 'estate') score += 10;
    }

    return Math.min(score, 100);
};

/**
 * Estimate equity from property records
 */
export const estimateEquity = (property: PropertyRecord): string => {
    const equity = property.marketValue - property.lastSalePrice;
    if (equity <= 0) return 'Unknown';
    if (equity > 500000) return '$500K+';
    if (equity > 300000) return '$300K-$500K';
    if (equity > 200000) return '$200K-$300K';
    if (equity > 100000) return '$100K-$200K';
    return 'Under $100K';
};

/**
 * Generate verification deep-link URLs for county records
 */
/**
 * Generate verification deep-link URLs for county records
 * Now includes "Smart Links" to specific court search portals
 */
export const getVerificationUrls = (county: string, folio?: string, ownerName?: string) => {
    const urls: { label: string; url: string; type: 'property' | 'court' | 'tax'; note?: string }[] = [];
    const encodedName = ownerName ? encodeURIComponent(ownerName.replace(/ ESTATE| TRUST| LLC/gi, '')) : '';

    switch (county) {
        case 'Miami-Dade':
            if (folio) {
                urls.push({
                    label: 'Property Appraiser',
                    url: `https://www.miamidadepa.gov/propertysearch/#/folio/${folio}`,
                    type: 'property'
                });
                urls.push({
                    label: 'Tax Collector',
                    url: `https://miamidade.county-taxes.com/public/search/property_tax?search_query=${folio}`,
                    type: 'tax'
                });
            }
            // Standard Court Links
            urls.push({
                label: 'Civil/Probate Search',
                url: `https://www2.miamidadeclerk.gov/ocr/Search.aspx?party_name=${encodedName}`,
                type: 'court',
                note: 'Search for "Probate" or "Family"'
            });
            // Advanced / Grey Area Links
            urls.push({
                label: 'Foreclosure Master Calendar',
                url: 'https://www.jud11.flcourts.org/Judicial-Section/Foreclosure-Master-Calendar',
                type: 'court',
                note: 'View upcoming trials & motions'
            });
            urls.push({
                label: 'Auction Calendar',
                url: 'https://miamidade.realforeclose.com/index.cfm?zaction=USER&zmethod=CALENDAR',
                type: 'court',
                note: 'Properties scheduled for sale'
            });
            urls.push({
                label: 'Legal Notices (Newspaper)',
                url: 'https://communitynewspapers.com/category/legal-notices/',
                type: 'court',
                note: 'Official Legal Advertisements'
            });
            break;

        case 'Broward':
            if (folio) {
                urls.push({
                    label: 'Property Appraiser',
                    url: `https://web.bcpa.net/BcpaClient/#/Record-Search`,
                    type: 'property',
                    note: `Copy Folio: ${folio}`
                });
            }
            urls.push({
                label: 'Case Search',
                url: 'https://www.browardclerk.org/Web2/CaseSearch/',
                type: 'court',
                note: 'Requires Solving Captcha first'
            });
            urls.push({
                label: 'Auction Calendar',
                url: 'https://broward.realforeclose.com/index.cfm?zaction=USER&zmethod=CALENDAR',
                type: 'court',
                note: 'Scheduled foreclosure sales'
            });
            break;

        case 'Palm Beach':
            if (folio) {
                urls.push({
                    label: 'PAPA Property Search',
                    url: `https://www.pbcgov.org/papa/Asps/PropertyDetail/PropertyDetail.aspx?parcel=${folio}`,
                    type: 'property'
                });
            }
            urls.push({
                label: 'eCaseView',
                url: 'https://applications.mypalmbeachclerk.com/eCaseView/',
                type: 'court',
                note: 'Guest login required. Search by Party Name.'
            });
            urls.push({
                label: 'Foreclosure Sales',
                url: 'https://palmbeach.realforeclose.com/index.cfm?zaction=USER&zmethod=CALENDAR',
                type: 'court',
                note: 'Scheduled auctions'
            });
            break;
    }

    return urls;
};

// =============================================================================
// HELPER FUNCTIONS
// =============================================================================

function mapPropertyType(dorCode: string | number): string {
    const code = String(dorCode).padStart(2, '0');
    const types: Record<string, string> = {
        '01': 'Single Family', '02': 'Mobile Home', '03': 'Multi-Family (2-9)',
        '04': 'Condo', '05': 'Cooperative', '06': 'Multi-Family (10+)',
        '07': 'Misc. Residential', '08': 'Multi-Family (10+)', '09': 'Non-Marketable',
    };
    return types[code] || 'Residential';
}

function categorizePermit(scope: string): string {
    const lower = scope.toLowerCase();
    if (lower.includes('roof')) return 'roof';
    if (lower.includes('hvac') || lower.includes('a/c') || lower.includes('air condition')) return 'hvac';
    if (lower.includes('electric')) return 'electrical';
    if (lower.includes('plumb')) return 'plumbing';
    if (lower.includes('window')) return 'windows';
    if (lower.includes('kitchen') || lower.includes('bath')) return 'renovation';
    return 'general';
}

/**
 * Generate a unique lead ID
 */
export function generateLeadId(): string {
    return 'lead_' + Date.now().toString(36) + Math.random().toString(36).substr(2, 9);
}

/**
 * Full discovery pipeline - combines multiple data sources for ALL counties
 */
export const discoverLeads = async (county: string, zipCode: string): Promise<DiscoveredLead[]> => {
    const leads: DiscoveredLead[] = [];

    // Step 1: Find high-tenure homeowners from the county's property appraiser
    const allProperties = await findHighTenureByCounty(zipCode, county);

    // Filter out Entity Owners (LLC, Inc, Corp, Trust)
    const entityPattern = /\b(LLC|INC|CORP|CORPORATION|L\.?L\.?C|LTD|LP|TRUST|ESTATE|FOUNDATION|HOLDINGS|INVESTMENTS|PROPERTIES|GROUP|PARTNERSHIP)\b/i;
    const validProperties = allProperties.filter(p => !entityPattern.test(p.ownerName));

    // Step 2: For each property, check building permits (Miami-Dade only has permit API)
    // and build lead profile
    for (const property of validProperties.slice(0, 30)) {
        // Only Miami-Dade has the building permits ArcGIS endpoint
        const permits = county === 'Miami-Dade' ? await searchBuildingPermits(property.address) : [];
        const signals: LeadSignal[] = [];
        const sourceInfo = getCountySourceInfo(county, property.folio);

        // Generate signals
        if (property.tenure >= 20) {
            signals.push({
                type: 'high_tenure',
                description: `${property.tenure} years ownership${property.homestead ? ' with homestead exemption' : ''}`,
                strength: property.tenure >= 30 ? 'strong' : 'moderate',
                source: sourceInfo.name,
                sourceUrl: sourceInfo.url,
            });
        }

        if (permits.length > 0) {
            const recentPermits = permits.filter(p => {
                const pDate = new Date(p.issueDate);
                const oneYearAgo = new Date();
                oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
                return pDate >= oneYearAgo;
            });

            for (const permit of recentPermits) {
                signals.push({
                    type: 'recent_permit',
                    description: `${permit.type.toUpperCase()} permit - Job value: $${permit.jobValue.toLocaleString()}`,
                    strength: permit.type === 'roof' ? 'strong' : 'moderate',
                    source: `${county} Building Department`,
                    sourceUrl: county === 'Miami-Dade' ? 'https://www.miamidade.gov/permits/' : '',
                    date: permit.issueDate,
                });
            }
        }

        const score = calculateLeadScore(property, permits, signals);

        if (score >= 40) {
            leads.push({
                id: generateLeadId(),
                name: property.ownerName,
                address: `${property.address}, ${property.city}, FL ${property.zip}`,
                county,
                folio: property.folio,
                score,
                verificationLevel: signals.length >= 2 ? 'verified_record' : signals.length >= 1 ? 'high_probability' : 'signal_only',
                signals,
                property,
                estimatedEquity: estimateEquity(property),
                motivationTrigger: generateMotivationSummary(property, permits, signals),
            });
        }
    }

    // Sort by score (highest first)
    return leads.sort((a, b) => b.score - a.score);
};

function generateMotivationSummary(property: PropertyRecord, permits: BuildingPermit[], signals: LeadSignal[]): string {
    const parts: string[] = [];

    if (property.tenure >= 30) parts.push(`${property.tenure}-year homeowner`);
    else if (property.tenure >= 20) parts.push(`${property.tenure} years in home`);

    if (property.homestead) parts.push('homestead exempted');

    const recentPermits = permits.filter(p => {
        const pDate = new Date(p.issueDate);
        const oneYearAgo = new Date();
        oneYearAgo.setFullYear(oneYearAgo.getFullYear() - 1);
        return pDate >= oneYearAgo;
    });

    if (recentPermits.some(p => p.type === 'roof')) parts.push('new roof');
    if (recentPermits.some(p => p.type === 'hvac')) parts.push('new HVAC');

    const age = new Date().getFullYear() - property.yearBuilt;
    if (age >= 40) parts.push(`${age}-year-old home`);

    if (signals.some(s => s.type === 'probate')) parts.push('probate filing');

    return parts.join(' • ') || 'Long-term homeowner';
}
