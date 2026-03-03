
export interface UserData {
  name?: string;
  location?: string;
  propertyType?: string;
  estimatedValue?: number;
  budget?: number;
  urgency?: 'low' | 'medium' | 'high';
  condition?: 'excellent' | 'good' | 'fair' | 'poor';
  reason?: 'downsizing' | 'health' | 'estate' | 'financial' | 'lifestyle' | 'relocation';
  emotionalReadiness?: 'ready' | 'hesitant' | 'overwhelmed';
  intent?: 'buy' | 'sell' | 'both';
}

export interface PersonalizedAdvice {
  pillar: 'Financial Safeguards' | 'Emotional & Physical Prep' | 'Market Strategy' | 'Lifestyle Readiness' | 'Purchase Strategy';
  title: string;
  content: string;
  source: string;
  priority: 'high' | 'medium' | 'low';
}

export interface LeadFactor {
  label: string;
  impact: 'high' | 'medium' | 'low';
  description: string;
}

export interface Lead {
  id: string;
  name: string;
  address: string;
  score: number;
  status: 'cold' | 'warm' | 'hot';
  type: 'seller' | 'buyer' | 'both';
  reason: string;
  lastUpdated: string;
  phone?: string;
  email?: string;
  verificationLevel: 'verified_record' | 'high_probability' | 'signal_only';
  scoringFactors: LeadFactor[];
  estimatedEquity?: string;
  budgetRange?: string;
  fourPointRisk?: 'high' | 'medium' | 'low';
  motivationTrigger?: string;
}

export interface AgentSettings {
  showAiBrief: boolean;
  showMarketPulse: boolean;
  showEthicsCheck: boolean;
  showNetSheet: boolean;
  highDensityMode: boolean;
  autoRefreshLeads: boolean;
}

export interface ClosingCostBreakdown {
  docStamps: number;
  miamiDadeSurtax: number;
  titleInsurance: number;
  settlementFee: number;
  commissions: number;
  lienSearch: number;
  recordingFees: number;
  taxProration: number;
  hoaProration: number;
  estoppelFee: number;
  paceLoanPayoff: number;
  specialAssessments: number;
  firptaWithholding: number;
  capitalGainsEst: number;
  prepAndStaging: number;
  homeWarranty: number;
  totalExpenses: number;
  netProceeds: number;
}

export enum UserRole {
  SELLER = 'SELLER',
  BUYER = 'BUYER',
  AGENT = 'AGENT',
  GUEST = 'GUEST'
}
