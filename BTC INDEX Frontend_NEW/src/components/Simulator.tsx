import React, { useState, useEffect, useMemo } from 'react';
import {
  TrendingUp,
  TrendingDown,
  History,
  Info
} from 'lucide-react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  ReferenceLine
} from 'recharts';
import { HISTORICAL_DATA, calculateSimilarity, WeeklyFractalPoint } from '../data/historicalData';

const formatKoreanNumber = (num: number) => {
  if (num === 0) return '';
  const unitWords = ['', '만', '억', '조', '경'];
  let result = '';
  let temp = num;
  let unitIndex = 0;

  while (temp > 0 && unitIndex < unitWords.length) {
    const part = temp % 10000;
    if (part > 0) {
      result = `${part.toLocaleString()}${unitWords[unitIndex]} ` + result;
    }
    temp = Math.floor(temp / 10000);
    unitIndex++;
  }
  return result.trim() + '원';
};

const CustomTooltip = ({ active, payload, label }: any) => {
  if (active && payload && payload.length) {
    const months = Math.round(label / 4.33);
    const timeLabel = label === 0 ? '현재 시점 (Today)' :
      label < 0 ? `${Math.abs(months)}개월 전` : `${months}개월 뒤`;

    return (
      <div className="bg-slate-800 border border-slate-700 p-3 rounded-lg shadow-xl">
        <p className="text-slate-300 text-sm font-medium mb-2">{timeLabel}</p>
        {payload.map((entry: any, index: number) => (
          <div key={index} className="flex items-center gap-2 text-xs mb-1">
            <div className="w-2 h-2 rounded-full" style={{ backgroundColor: entry.color }} />
            <span className="text-slate-400">{entry.name}:</span>
            <span className="text-white font-mono font-medium">
              {entry.value > 0 ? '+' : ''}{entry.value.toFixed(1)}%
            </span>
          </div>
        ))}
      </div>
    );
  }
  return null;
};

interface SimulatorProps {
  btcPriceUsd: number;
  currentIndicators?: {
    z: number;
    ma: number;
    s: number;
    date?: string;
  };
}

export function Simulator({ btcPriceUsd, currentIndicators }: SimulatorProps) {
  const [investmentAmount, setInvestmentAmount] = useState<number>(10000000); // Default 10M KRW
  const [investmentPeriod, setInvestmentPeriod] = useState<number>(12); // Default 12 months
  const [similarPeriods, setSimilarPeriods] = useState<Array<{ point: WeeklyFractalPoint, similarity: number }>>([]);

  // Default indicators if not provided (fallback)
  // We use the last available data point as the "current" state if none is provided
  const lastDataPoint = HISTORICAL_DATA[HISTORICAL_DATA.length - 1];
  const indicators = currentIndicators ? {
    z: currentIndicators.z,
    ma: currentIndicators.ma,
    s: currentIndicators.s,
    date: currentIndicators.date || new Date().toISOString()
  } : {
    z: lastDataPoint.z,
    ma: lastDataPoint.ma,
    s: lastDataPoint.s,
    date: lastDataPoint.d
  };

  useEffect(() => {
    // Find top 3 similar historical periods based on indicators
    // We only look at data points that are at least 'investmentPeriod' months in the past
    // so we can actually calculate the future return
    const monthsInMs = investmentPeriod * 30 * 24 * 60 * 60 * 1000;
    const now = new Date(lastDataPoint.d).getTime();

    const validHistoricalPoints = HISTORICAL_DATA.filter(point => {
      const pointTime = new Date(point.d).getTime();
      return (now - pointTime) >= monthsInMs;
    });

    const scoredPoints = validHistoricalPoints
      .map(point => ({
        point,
        similarity: calculateSimilarity(indicators, point)
      }))
      // Filter out heavily penalized points (different trend)
      .filter(item => item.similarity > 0);

    // 1. Separate points into >= 95% (High Similarity) and < 95% (Others)
    const highSim = scoredPoints.filter(item => item.similarity >= 95);
    const lowSim = scoredPoints.filter(item => item.similarity < 95);

    // 2. Sort High Similarity by Date DESC (Newest first)
    highSim.sort((a, b) => new Date(b.point.d).getTime() - new Date(a.point.d).getTime());

    // 3. Sort Others by Similarity DESC (Highest similarity first) as a fallback
    lowSim.sort((a, b) => b.similarity - a.similarity);

    const combined = [...highSim, ...lowSim];
    const picked: Array<{ point: WeeklyFractalPoint, similarity: number }> = [];
    const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

    // 4. Pick up to 3 points, ensuring each is at least 2 years apart from already picked points
    for (const item of combined) {
      if (picked.length >= 3) break;

      const itemTime = new Date(item.point.d).getTime();
      const isFarEnough = picked.every(p =>
        Math.abs(new Date(p.point.d).getTime() - itemTime) >= TWO_YEARS_MS
      );

      if (isFarEnough) {
        picked.push(item);
      }
    }

    setSimilarPeriods(picked);
  }, [indicators.z, indicators.ma, indicators.s, investmentPeriod, lastDataPoint.d]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0
    }).format(val);
  };

  // Calculate projected returns based on actual historical price action
  const calculateProjection = (baseAmount: number, periodMonths: number, scenario: 'bull' | 'bear' | 'avg') => {
    if (similarPeriods.length === 0) return baseAmount; // Fallback if no similar periods found

    const returns = similarPeriods.map(item => {
      // Find the price N months after the historical point
      const pointTime = new Date(item.point.d).getTime();
      const targetTime = pointTime + (periodMonths * 30 * 24 * 60 * 60 * 1000);

      // Find the closest data point to the target time
      let closestFuturePoint = HISTORICAL_DATA[0];
      let minTimeDiff = Infinity;

      for (const futurePoint of HISTORICAL_DATA) {
        const futureTime = new Date(futurePoint.d).getTime();
        const diff = Math.abs(futureTime - targetTime);
        if (diff < minTimeDiff) {
          minTimeDiff = diff;
          closestFuturePoint = futurePoint;
        }
      }

      // Calculate multiplier (Future Price / Historical Price)
      const rawMultiplier = closestFuturePoint.p / item.point.p;

      // Apply Logarithmic Diminishing Returns based on Price ratio (Proxy for Market Cap ratio assuming relatively stable supply growth compared to price delta)
      // dimFactor = log(Historical Price) / log(Current Price) 
      // This dynamically scales down historical monster runs based on how much larger the market is today
      let dimFactor = 1.0;
      if (lastDataPoint.p > item.point.p && item.point.p > 0) {
        // Normalize to a baseline to prevent extreme aggressive cuts
        // We use Math.log10 for intuitive scaling
        const logHist = Math.log10(item.point.p);
        const logCurr = Math.log10(lastDataPoint.p);

        if (logCurr > logHist) {
          dimFactor = logHist / logCurr;

          // Apply a conservative dampener so we don't scale it down TOO aggressively if it's super old
          // Max penalty is 0.35x (65% reduction)
          dimFactor = Math.max(0.35, dimFactor);
        }
      }

      if (rawMultiplier > 1) {
        return 1 + ((rawMultiplier - 1) * dimFactor);
      } else {
        const downside = 1 - rawMultiplier;
        return 1 - (downside * dimFactor);
      }
    });

    let multiplier = 1;

    if (scenario === 'bull') {
      multiplier = Math.max(...returns);
    } else if (scenario === 'bear') {
      multiplier = Math.min(...returns);
    } else {
      // Average
      multiplier = returns.reduce((a, b) => a + b, 0) / returns.length;
    }

    return baseAmount * multiplier;
  };

  const bestCase = calculateProjection(investmentAmount, investmentPeriod, 'bull');
  const worstCase = calculateProjection(investmentAmount, investmentPeriod, 'bear');
  const avgCase = calculateProjection(investmentAmount, investmentPeriod, 'avg');

  const chartData = useMemo(() => {
    if (similarPeriods.length === 0) return [];

    const weeks = Math.round((investmentPeriod * 30) / 7);
    const data = [];

    // Find indices of the picked historical points
    const currentIdx = HISTORICAL_DATA.findIndex(p => p.d === lastDataPoint.d);
    const histIndices = similarPeriods.map(sp =>
      HISTORICAL_DATA.findIndex(p => p.d === sp.point.d)
    );

    for (let w = -weeks; w <= weeks; w++) {
      const dataPoint: any = { weekOffset: w };

      // Current trajectory (only past and present)
      if (w <= 0) {
        const idx = currentIdx + w;
        if (idx >= 0 && idx < HISTORICAL_DATA.length) {
          dataPoint.current = ((HISTORICAL_DATA[idx].p / HISTORICAL_DATA[currentIdx].p) - 1) * 100;
        }
      }

      // Historical trajectories
      let sumFuture = 0;
      let countFuture = 0;

      histIndices.forEach((hIdx, i) => {
        const idx = hIdx + w;
        if (idx >= 0 && idx < HISTORICAL_DATA.length) {
          const rawMultiplier = HISTORICAL_DATA[idx].p / HISTORICAL_DATA[hIdx].p;
          const histPriceObj = HISTORICAL_DATA[hIdx];

          // Apply same Logarithmic Diminishing Returns to the visual chart lines
          let dimFactor = 1.0;
          if (lastDataPoint.p > histPriceObj.p && histPriceObj.p > 0) {
            const logHist = Math.log10(histPriceObj.p);
            const logCurr = Math.log10(lastDataPoint.p);
            if (logCurr > logHist) {
              dimFactor = Math.max(0.35, logHist / logCurr);
            }
          }

          let normalized = 0;
          if (w >= 0) {
            // Apply factor only to future projection part of the chart
            if (rawMultiplier > 1) {
              normalized = ((rawMultiplier - 1) * dimFactor) * 100;
            } else {
              const downside = 1 - rawMultiplier;
              normalized = -(downside * dimFactor) * 100;
            }
          } else {
            // Past chart portion remains visually actual to show how we got here
            normalized = (rawMultiplier - 1) * 100;
          }

          dataPoint[`hist${i + 1}`] = normalized;

          if (w >= 0) {
            sumFuture += normalized;
            countFuture++;
          }
        }
      });

      // Average future trajectory
      if (w >= 0 && countFuture > 0) {
        dataPoint.avgFuture = sumFuture / countFuture;
      }

      data.push(dataPoint);
    }

    return data;
  }, [similarPeriods, investmentPeriod, lastDataPoint.d]);

  return (
    <div className="space-y-8 animate-fadeIn">

      <div className="mb-8 bg-slate-800/50 p-6 rounded-2xl border border-white/5">
        <h2 className="text-2xl font-bold text-white mb-3 flex items-center gap-3">
          <History className="w-6 h-6 text-cyan-400" />
          비트코인 미래 궤적 예측기
        </h2>
        <p className="text-slate-300 text-sm leading-relaxed max-w-4xl mb-4">
          12년간의 비트코인 빅데이터를 탐색하여 현재 시장과 똑 닮은 과거의 쌍둥이 구간들을 찾아냅니다. 막연한 희망 회로가 아닌 냉정한 데이터에 기반하여, 내 자본의 미래 가치를 3가지 시나리오(최상/평균/최악)로 미리 시뮬레이션해 보세요.
        </p>

        <div className="bg-slate-900/50 rounded-lg p-4 border border-cyan-500/20">
          <div className="flex items-center gap-2 mb-2">
            <Info className="w-4 h-4 text-cyan-400" />
            <span className="text-xs font-bold text-cyan-400 tracking-wider">알고리즘 분석 원리</span>
          </div>
          <p className="text-slate-400 text-xs leading-relaxed">
            BTC 온체인 지표(MVRV, 200W MA)와 반감기 주기를 분석하여 현재와 가장 유사한 역사적 장세를 패턴 매칭합니다. 시가총액 성장에 따른 수익률 둔화(Diminishing) 알고리즘을 적용해, 향후 현실적인 주가 궤적과 기대 수익률을 과학적으로 프로젝션합니다.
          </p>
        </div>
      </div>

      {/* 1. Input Section */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-3 tracking-wide">
            투자 원금 (KRW)
          </label>
          <div className="relative group">
            <div className="absolute inset-y-0 left-0 pl-4 flex items-center pointer-events-none">
              <span className="text-slate-400 font-medium">₩</span>
            </div>
            <input
              type="text"
              value={investmentAmount.toLocaleString()}
              onChange={(e) => {
                const val = Number(e.target.value.replace(/[^0-9]/g, ''));
                if (!isNaN(val)) {
                  setInvestmentAmount(val);
                }
              }}
              className="block w-full pl-10 pr-36 py-3.5 bg-slate-900/50 border border-white/10 rounded-xl text-white font-mono text-lg transition-all focus:ring-2 focus:ring-cyan-500/50 focus:border-cyan-500/50 outline-none hover:border-white/20"
            />
            <div className="absolute inset-y-0 right-0 pr-4 flex items-center pointer-events-none">
              <span className="text-sm text-cyan-400 font-bold whitespace-nowrap bg-cyan-500/10 px-2 py-1 rounded">
                {formatKoreanNumber(investmentAmount)}
              </span>
            </div>
          </div>
          <div className="flex flex-wrap gap-2 mt-3">
            {[10000000, 50000000, 100000000, 500000000].map((amt) => (
              <button
                key={amt}
                onClick={() => setInvestmentAmount(amt)}
                className="text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-transparent hover:border-slate-600 transition-all hover:text-white"
              >
                {amt >= 100000000 ? `${amt / 100000000}억` : `${(amt / 10000).toLocaleString()}만`}
              </button>
            ))}
          </div>
        </div>

        <div>
          <label className="block text-sm font-semibold text-slate-300 mb-3 tracking-wide">
            투자 기간 (보유 기간)
          </label>
          <div className="grid grid-cols-4 gap-3">
            {[6, 12, 24, 36].map((months) => (
              <button
                key={months}
                onClick={() => setInvestmentPeriod(months)}
                className={`py-3.5 rounded-xl text-sm font-bold transition-all border ${investmentPeriod === months
                  ? 'bg-gradient-to-br from-indigo-500 to-cyan-500 text-white border-transparent shadow-[0_0_15px_rgba(6,182,212,0.3)]'
                  : 'bg-slate-900/50 text-slate-400 hover:text-white border-white/5 hover:border-white/20 hover:bg-slate-800'
                  }`}
              >
                {months >= 12 ? `${months / 12}년` : `${months}개월`}
              </button>
            ))}
          </div>
        </div>
      </div>

      {/* 2. Projection Cards */}
      <div className="space-y-4 max-w-5xl mx-auto">
        <h3 className="text-sm font-bold text-slate-400 uppercase tracking-widest pl-1 mb-3">
          {investmentPeriod >= 12 ? `${investmentPeriod / 12}년` : `${investmentPeriod}개월`} 뒤 예상 자산 가치
        </h3>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          {/* Bear Case */}
          <div className="glass-panel p-6 rounded-2xl hover:border-red-500/30 transition-colors group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-red-500/10 transition-colors"></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-2 bg-red-500/10 rounded-lg text-red-400 border border-red-500/20">
                <TrendingDown className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Worst Case</span>
            </div>
            <div className="text-2xl font-bold text-white mb-2 relative z-10 font-mono tracking-tight">
              {formatCurrency(worstCase)}
            </div>
            <div className={`inline-flex items-center px-2 py-1 rounded text-xs font-bold relative z-10 ${worstCase >= investmentAmount ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
              {worstCase >= investmentAmount ? '+' : ''}
              {Math.round(((worstCase - investmentAmount) / investmentAmount) * 100)}% ROI
            </div>
            <p className="text-[11px] text-slate-500 mt-4 leading-relaxed relative z-10">
              가장 유사했던 과거 시점 중 최악의 성과를 보였던 시나리오입니다.
            </p>
          </div>

          {/* Average Case */}
          <div className="glass-panel p-6 rounded-2xl border-cyan-500/30 hover:border-cyan-400/50 transition-all relative overflow-hidden group shadow-[0_0_30px_rgba(6,182,212,0.1)] hover:shadow-[0_0_30px_rgba(6,182,212,0.15)] transform hover:-translate-y-1">
            <div className="absolute top-0 right-0 bg-gradient-to-r from-indigo-500 to-cyan-500 text-white text-[10px] px-3 py-1 rounded-bl-xl font-bold tracking-widest uppercase shadow-md pointer-events-none z-20">
              Most Likely
            </div>
            <div className="absolute top-1/2 left-1/2 -translate-y-1/2 -translate-x-1/2 w-full h-full bg-cyan-500/5 rounded-full blur-[60px] pointer-events-none group-hover:bg-cyan-500/10 transition-colors"></div>

            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-2 bg-cyan-500/10 rounded-lg text-cyan-400 border border-cyan-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-slate-200 uppercase tracking-wider">Avg. Scenario</span>
            </div>
            <div className="text-3xl font-bold text-white mb-2 relative z-10 font-mono tracking-tight">
              {formatCurrency(avgCase)}
            </div>
            <div className={`inline-flex items-center px-2.5 py-1 rounded-md text-sm font-bold relative z-10 ${avgCase >= investmentAmount ? 'bg-green-500/20 text-green-400 border border-green-500/20' : 'bg-red-500/20 text-red-400 border border-red-500/20'}`}>
              {avgCase >= investmentAmount ? '+' : ''}
              {Math.round(((avgCase - investmentAmount) / investmentAmount) * 100)}% ROI
            </div>
            <p className="text-[11px] text-slate-400 mt-4 leading-relaxed relative z-10 font-medium">
              유사했던 과거 시점들의 실제 평균 수익률을 반영한 기준 예상치.
            </p>
          </div>

          {/* Bull Case */}
          <div className="glass-panel p-6 rounded-2xl hover:border-green-500/30 transition-colors group relative overflow-hidden">
            <div className="absolute top-0 right-0 w-32 h-32 bg-green-500/5 rounded-full blur-[40px] -translate-y-1/2 translate-x-1/2 pointer-events-none group-hover:bg-green-500/10 transition-colors"></div>
            <div className="flex items-center gap-3 mb-4 relative z-10">
              <div className="p-2 bg-green-500/10 rounded-lg text-green-400 border border-green-500/20">
                <TrendingUp className="w-5 h-5" />
              </div>
              <span className="text-sm font-bold text-slate-300 uppercase tracking-wider">Best Case</span>
            </div>
            <div className="text-2xl font-bold text-white mb-2 relative z-10 font-mono tracking-tight">
              {formatCurrency(bestCase)}
            </div>
            <div className="inline-flex items-center px-2 py-1 rounded text-xs font-bold relative z-10 bg-green-500/10 text-green-400">
              +{Math.round(((bestCase - investmentAmount) / investmentAmount) * 100)}% ROI
            </div>
            <p className="text-[11px] text-slate-500 mt-4 leading-relaxed relative z-10">
              가장 유사했던 과거 시점 중 최고의 성과를 보였던 시나리오입니다.
            </p>
          </div>
        </div>
      </div>

      {/* 3. Fractal Chart Section */}
      {similarPeriods.length > 0 && (
        <div className="glass-panel p-4 sm:p-6 rounded-2xl relative">
          <div className="mb-6 px-2 sm:px-0">
            <h3 className="text-lg font-bold text-white flex items-center gap-2 tracking-wide">
              <TrendingUp className="w-5 h-5 text-cyan-400 shrink-0" />
              온체인 프랙탈 분석 도표
            </h3>
            <p className="text-xs text-slate-400 mt-2 font-medium">
              현재의 가격 궤적(흰색)이 미래에 어떤 형태(하늘색)로 진행될지, 과거 유사 시점들의 데이터 세트 라인을 기반으로 시각화합니다.
            </p>
          </div>

          <div className="h-[400px] w-full mt-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData} margin={{ top: 20, right: 20, left: 10, bottom: 20 }}>
                <defs>
                  <linearGradient id="colorAvgFuture" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#06b6d4" stopOpacity={0.8} />
                    <stop offset="95%" stopColor="#6366f1" stopOpacity={0.8} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" vertical={false} />
                <XAxis
                  dataKey="weekOffset"
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(val) => {
                    if (val === 0) return 'Today';
                    const m = Math.round(val / 4.33);
                    return m === 0 ? `${val}W` : (m > 0 ? `+${m}M` : `${m}M`);
                  }}
                  minTickGap={20}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <YAxis
                  stroke="#64748b"
                  tick={{ fontSize: 11, fill: '#94a3b8' }}
                  tickFormatter={(val) => `${val > 0 ? '+' : ''}${val}%`}
                  domain={['auto', 'auto']}
                  width={45}
                  axisLine={{ stroke: 'rgba(255,255,255,0.1)' }}
                  tickLine={false}
                />
                <Tooltip content={<CustomTooltip />} cursor={{ stroke: 'rgba(255,255,255,0.1)', strokeWidth: 1 }} />
                <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" strokeWidth={1} strokeDasharray="5 5" />
                <ReferenceLine y={0} stroke="rgba(255,255,255,0.1)" strokeWidth={1} />

                {/* Historical Lines */}
                {similarPeriods[0] && (
                  <Line type="monotone" dataKey="hist1" name={similarPeriods[0].point.d} stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} opacity={0.3} />
                )}
                {similarPeriods[1] && (
                  <Line type="monotone" dataKey="hist2" name={similarPeriods[1].point.d} stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} opacity={0.3} />
                )}
                {similarPeriods[2] && (
                  <Line type="monotone" dataKey="hist3" name={similarPeriods[2].point.d} stroke="#64748b" strokeWidth={1.5} strokeDasharray="4 4" dot={false} opacity={0.3} />
                )}

                {/* Current Trajectory */}
                <Line type="monotone" dataKey="current" name="현재 궤적" stroke="#ffffff" strokeWidth={3} dot={false} style={{ filter: 'drop-shadow(0 0 4px rgba(255,255,255,0.5))' }} />

                {/* Average Future Trajectory */}
                <Line type="monotone" dataKey="avgFuture" name="미래 예상치" stroke="url(#colorAvgFuture)" strokeWidth={4} dot={false} style={{ filter: 'drop-shadow(0 0 6px rgba(6,182,212,0.6))' }} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}

      {/* 4. Similarity Analysis */}
      <div className="glass-panel p-4 md:p-5 rounded-2xl relative overflow-hidden">
        <h3 className="text-sm font-bold text-slate-300 uppercase tracking-widest mb-4 flex items-center gap-2">
          <Info className="w-4 h-4 text-cyan-400" />
          현재 시장 위치 메타데이터
        </h3>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 md:gap-6 relative z-10">
          <div className="space-y-3">
            <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 shadow-inner">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-400 text-sm font-medium">MVRV Z-Score Tracker</span>
                <span className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded">{indicators.z.toFixed(2)}</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${indicators.z > 5 ? 'bg-gradient-to-r from-orange-500 to-red-500 shadow-[0_0_10px_rgba(239,68,68,0.5)]' : indicators.z < 1 ? 'bg-gradient-to-r from-emerald-500 to-green-400 shadow-[0_0_10px_rgba(74,222,128,0.5)]' : 'bg-gradient-to-r from-yellow-500 to-orange-400'}`}
                  style={{ width: `${Math.min(Math.max((indicators.z / 8) * 100, 0), 100)}%` }}
                />
              </div>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 shadow-inner">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-400 text-sm font-medium">200주 MA 이격률</span>
                <span className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded">{(indicators.ma * 100).toFixed(0)}%</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${indicators.ma > 1.5 ? 'bg-gradient-to-r from-orange-500 to-red-500' : indicators.ma < 0.8 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-yellow-500 to-orange-400'}`}
                  style={{ width: `${Math.min(Math.max((indicators.ma / 2.5) * 100, 0), 100)}%` }}
                />
              </div>
            </div>
          </div>

          <div className="bg-slate-900/40 p-4 rounded-xl border border-white/5">
            <p className="text-xs font-bold text-slate-400 uppercase tracking-widest mb-3 border-b border-white/5 pb-2">
              유사 과거 패턴 레퍼런스
            </p>
            <ul className="space-y-2">
              {similarPeriods.length > 0 ? similarPeriods.map((item, idx) => (
                <li key={idx} className="flex items-center justify-between text-sm bg-white/5 hover:bg-white/10 transition-colors py-2 px-3 rounded-lg border border-white/5 group">
                  <span className="text-cyan-400 font-mono font-medium group-hover:text-cyan-300 transition-colors">{item.point.d}</span>
                  <span className="text-slate-300 text-xs font-bold bg-slate-800 px-2 py-1 rounded-md opacity-80 group-hover:opacity-100">일치율 {Math.round(item.similarity)}%</span>
                </li>
              )) : (
                <li className="text-sm text-slate-500 italic py-2 px-3 text-center bg-white/5 rounded-lg border-dashed border border-white/10">
                  해당 기간을 시뮬레이션할 수 있는 데이터 구조가 부족합니다.
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      {/* Disclaimer */}
      <div className="border border-white/5 p-4 rounded-xl flex gap-3 items-start max-w-4xl mx-auto opacity-70 hover:opacity-100 transition-opacity">
        <Info className="w-4 h-4 text-slate-500 shrink-0 mt-0.5" />
        <p className="text-[11px] text-slate-500 leading-relaxed font-medium">
          본 시뮬레이션은 2010년부터 축적된 비트코인 실제 온체인 데이터(MVRV Z-Score, 200MA 이격도, 60일 추세)를 기반으로
          현재와 가장 유사한 과거 시점을 찾아내어, 해당 시점으로부터 N개월 뒤의 실제 백테스팅 수익률을 도출한 수학적 결과입니다.
          과거의 패턴이 미래의 수익을 100% 보장하지는 않습니다.
        </p>
      </div>
    </div>
  );
}
