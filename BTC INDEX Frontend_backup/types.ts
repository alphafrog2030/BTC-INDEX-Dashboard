export interface Indicator {
  name: string;
  weight: number;
  currentValue: string; // String to handle formatting like "2.4" or "$65,000"
  score: number; // 0-10
  weightedScore: number;
  signal: 'BUY' | 'NEUTRAL' | 'SELL';
  description?: string;
}

export interface ReportData {
  timestamp: string;
  btcPrice: number;
  totalScore: number;
  interpretation: string;
  indicators: Indicator[];
  strategyText: string;
  risksAndAdvice: string;
  sources: string[];
}

export interface SimulationConfig {
  totalCapitalKRW: number;
  currentPrice: number;
  exchangeRate: number; // KRW/USD
}

export enum ViewMode {
  DASHBOARD = 'DASHBOARD',
  REPORT = 'REPORT',
  SIMULATION = 'SIMULATION'
}