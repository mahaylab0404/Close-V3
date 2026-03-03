# OSINT Enrichment — Example JSON Outputs

Three realistic scenarios showing what the enrichment pipeline returns.

---

## Scenario 1: Strong Match — Individual Seller (Miami-Dade)

A probate lead where the name and address match county records perfectly.

```json
{
  "verification_status": "strong_match",
  "lead_score": 70,
  "lead_score_breakdown": {
    "address_parcel_resolved": 15,
    "owner_name_match": 25,
    "mailing_match": 10,
    "entity_investor_bonus": 0,
    "contact_deliverable": 0,
    "no_parcel_penalty": 0,
    "mismatch_penalty": 0,
    "missing_fields_penalty": -10,
    "raw_total": 40
  },
  "property_profile": {
    "parcel_id": "30-2119-009-0840",
    "owner_name": "MARTINEZ, CARLOS & MARIA",
    "mailing_address": "7401 SW 132ND ST, MIAMI, FL 33156",
    "property_address": "7401 SW 132ND ST, MIAMI, FL 33156",
    "property_type": "SFH",
    "last_sale_date": "1985-06-15",
    "last_sale_price": 125000,
    "assessed_value": 485000,
    "market_value": 557750,
    "homestead": true,
    "year_built": 1978,
    "bedrooms": 3,
    "bathrooms": 2,
    "sqft": 2100,
    "legal_description": "",
    "source_url": "https://www.miamidadepa.gov/propertysearch/#/folio/30-2119-009-0840",
    "retrieved_at": "2026-02-11T15:00:00.000Z"
  },
  "entity_profile": null,
  "matches": {
    "verification_status": "strong_match",
    "address_to_parcel_confidence": 0.95,
    "owner_name_match_confidence": 0.88,
    "mailing_address_match": "yes",
    "owner_type": "individual",
    "flags": []
  },
  "risk_flags": [],
  "explanation": "Lead strongly verified against county property records. Owner name match: strong. Mailing address differs from property — possible absentee owner.",
  "sources": [
    {
      "source_name": "Miami-Dade Property Appraiser",
      "query_params": { "address": "7401 SW 132ND ST MIAMI FL", "county": "Miami-Dade" },
      "retrieved_at": "2026-02-11T15:00:00.000Z"
    }
  ]
}
```

---

## Scenario 2: Entity-Owned Investment Property (Broward)

An LLC-owned multi-family; Sunbiz entity lookup enriches the profile.

```json
{
  "verification_status": "partial_match",
  "lead_score": 45,
  "lead_score_breakdown": {
    "address_parcel_resolved": 15,
    "owner_name_match": 10,
    "mailing_match": 0,
    "entity_investor_bonus": 10,
    "contact_deliverable": 0,
    "no_parcel_penalty": 0,
    "mismatch_penalty": 0,
    "missing_fields_penalty": -10,
    "raw_total": 25
  },
  "property_profile": {
    "parcel_id": "5041-23-0456",
    "owner_name": "SUNSHINE STATE INVESTMENTS INC",
    "mailing_address": "1200 BRICKELL AVE STE 1800, MIAMI, FL 33131",
    "property_address": "3420 NE 12TH AVE, FORT LAUDERDALE, FL 33334",
    "property_type": "Multi-Family",
    "last_sale_date": "2018-09-20",
    "last_sale_price": 420000,
    "assessed_value": 780000,
    "market_value": 873600,
    "homestead": false,
    "year_built": 1985,
    "bedrooms": 6,
    "bathrooms": 4,
    "sqft": 3200,
    "legal_description": "LOT 12 BLK 3 CORAL RIDGE SEC 2",
    "source_url": "https://web.bcpa.net/BcpaClient/#/Record-Search",
    "retrieved_at": "2026-02-11T15:01:00.000Z"
  },
  "entity_profile": {
    "entity_name": "SUNSHINE STATE INVESTMENTS INC",
    "entity_type": "CORP",
    "status": "Active",
    "filing_number": "P18000074523",
    "filing_date": "2018-07-12",
    "registered_agent": "COGENCY GLOBAL INC",
    "principal_address": "1200 Brickell Ave, Suite 1800, Miami, FL 33131",
    "mailing_address": "1200 Brickell Ave, Suite 1800, Miami, FL 33131",
    "source_url": "https://search.sunbiz.org/Inquiry/CorporationSearch/SearchResultDetail?inquirytype=EntityName&directionType=Initial&searchNameOrder=P18000074523",
    "retrieved_at": "2026-02-11T15:01:00.000Z"
  },
  "matches": {
    "verification_status": "partial_match",
    "address_to_parcel_confidence": 0.72,
    "owner_name_match_confidence": 0.45,
    "mailing_address_match": "no",
    "owner_type": "entity",
    "flags": ["entity_owned", "absentee_owner"]
  },
  "risk_flags": ["entity_owned", "absentee_owner"],
  "explanation": "Lead partially verified — some data matches county records. Owner name match: partial. Property is owned by a business entity. Mailing address differs from property — possible absentee owner.",
  "sources": [
    {
      "source_name": "Broward Property Appraiser",
      "query_params": { "address": "3420 NE 12TH AVE FORT LAUDERDALE FL", "county": "Broward" },
      "retrieved_at": "2026-02-11T15:01:00.000Z"
    },
    {
      "source_name": "Florida Sunbiz (Division of Corporations)",
      "query_params": { "entity_name": "SUNSHINE STATE INVESTMENTS INC" },
      "retrieved_at": "2026-02-11T15:01:00.000Z"
    }
  ]
}
```

---

## Scenario 3: No Record Found — Unverified Lead (Palm Beach)

A lead where no property record was found in the county database.

```json
{
  "verification_status": "unverified",
  "lead_score": 0,
  "lead_score_breakdown": {
    "address_parcel_resolved": 0,
    "owner_name_match": 0,
    "mailing_match": 0,
    "entity_investor_bonus": 0,
    "contact_deliverable": 0,
    "no_parcel_penalty": -20,
    "mismatch_penalty": 0,
    "missing_fields_penalty": -10,
    "raw_total": -30
  },
  "property_profile": null,
  "entity_profile": null,
  "matches": {
    "verification_status": "unverified",
    "address_to_parcel_confidence": 0,
    "owner_name_match_confidence": 0,
    "mailing_address_match": "unknown",
    "owner_type": "individual",
    "flags": ["no_parcel_found"]
  },
  "risk_flags": ["no_parcel_found", "low_confidence_lead"],
  "explanation": "Lead could not be verified against county property records. WARNING: No parcel/folio found for this address.",
  "sources": [
    {
      "source_name": "Palm Beach Property Appraiser",
      "query_params": { "address": "999 IMAGINARY BLVD WEST PALM BEACH FL", "county": "Palm Beach" },
      "retrieved_at": "2026-02-11T15:02:00.000Z"
    }
  ]
}
```
