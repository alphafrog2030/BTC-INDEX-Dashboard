import historicalDataJson from './historicalData.json';

export interface WeeklyFractalPoint {
  d: string;  // Date
  p: number;  // Price
  z: number;  // MVRV Z-Score
  ma: number; // Price to 200MA Ratio
  s: number;  // MVRV 60d Slope
}

const HALVING_DATES = [
  "2012-11-28",
  "2016-07-09",
  "2020-05-11",
  "2024-04-19"
];

// Helper to compute days since last halving
export const getDaysSinceHalving = (dateString: string): number => {
  const d = new Date(dateString).getTime();
  let lastHalving = new Date("2009-01-03").getTime(); // Genesis block

  for (const h of HALVING_DATES) {
    const hTime = new Date(h).getTime();
    if (d >= hTime) {
      lastHalving = hTime;
    }
  }
  return Math.floor((d - lastHalving) / (1000 * 60 * 60 * 24));
};

export const calculateSimilarity = (
  current: { z: number; ma: number; s: number; date: string },
  historical: WeeklyFractalPoint
): number => {
  // 1. Trend Filter (Phase 2)
  // If the current 60d slope is positive (uptrend), penalize historical points that were in a downtrend
  // If the current 60d slope is negative (downtrend), penalize historical points that were in an uptrend
  const isCurrentUptrend = current.s > 0;
  const isHistoricalUptrend = historical.s > 0;

  // If trends don't match, return 0 similarity immediately
  if (isCurrentUptrend !== isHistoricalUptrend) {
    return 0;
  }

  // 2. State Matching (Phase 1) - Percentage Difference
  // Calculate the absolute percentage difference for each metric
  // Avoid division by zero by adding a small epsilon if current value is 0

  const epsilon = 0.0001;
  const currentZ = Math.abs(current.z) < epsilon ? epsilon : current.z;
  const currentMA = Math.abs(current.ma) < epsilon ? epsilon : current.ma;

  const zPercentDiff = Math.abs(currentZ - historical.z) / Math.abs(currentZ) * 100;
  const maPercentDiff = Math.abs(currentMA - historical.ma) / Math.abs(currentMA) * 100;

  // 3. Halving Cycle Phase Filter
  const currentDays = getDaysSinceHalving(current.date || new Date().toISOString());
  const historicalDays = getDaysSinceHalving(historical.d);

  const daysDiff = Math.abs(currentDays - historicalDays);
  // Add penalty if cycle phase differs significantly (e.g. > 180 days out of sync)
  // Max penalization is about 30 points if it's 2 years out of sync
  const halvingPenalty = Math.min(30, (daysDiff / 365) * 15);

  // Weight: Z-Score (70%), 200MA Ratio (30%)
  const weightedAvgPercentDiff = (zPercentDiff * 0.7) + (maPercentDiff * 0.3);

  // Convert percentage difference to similarity score (100 - % difference), then apply halving season penalty
  return Math.max(0, 100 - weightedAvgPercentDiff - halvingPenalty);
};

export const HISTORICAL_DATA: WeeklyFractalPoint[] = historicalDataJson as WeeklyFractalPoint[];
