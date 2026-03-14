import React, { useState, useEffect, useMemo } from 'react';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  AreaChart,
  Area,
  ReferenceLine
} from 'recharts';
import {
  TrendingUp,
  TrendingDown,
  History,
  AlertCircle,
  Info,
  Calendar,
  Layers,
  Sparkles,
  Target
} from 'lucide-react';
import { calculateSimilarity, WeeklyFractalPoint, getDaysSinceHalving } from '../data/historicalData';

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
  historicalData: WeeklyFractalPoint[];
  currentIndicators: {
    z: number;
    ma: number;
    s: number;
    date?: string;
  };
}

export function Simulator({ btcPriceUsd, historicalData, currentIndicators }: SimulatorProps) {
  const [investmentAmount, setInvestmentAmount] = useState<number>(10000000); // Default 10M KRW
  const [investmentPeriod, setInvestmentPeriod] = useState<number>(12); // Default 12 months
  const [similarPeriods, setSimilarPeriods] = useState<Array<{ point: WeeklyFractalPoint, similarity: number }>>([]);

  const HISTORICAL_DATA = historicalData;
  const lastDataPoint = HISTORICAL_DATA.length > 0 ? HISTORICAL_DATA[HISTORICAL_DATA.length - 1] : { d: new Date().toISOString(), p: btcPriceUsd, z: 1.8, ma: 1.0, s: 0 };

  const indicators = {
    z: currentIndicators.z,
    ma: currentIndicators.ma,
    s: currentIndicators.s,
    date: currentIndicators.date || new Date().toISOString()
  };

  useEffect(() => {
    if (HISTORICAL_DATA.length === 0) return;

    // Find top 3 similar historical periods based on indicators
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
      .filter(item => item.similarity > 0);

    const highSim = scoredPoints.filter(item => item.similarity >= 95);
    const lowSim = scoredPoints.filter(item => item.similarity < 95);

    highSim.sort((a, b) => new Date(b.point.d).getTime() - new Date(a.point.d).getTime());
    lowSim.sort((a, b) => b.similarity - a.similarity);

    const combined = [...highSim, ...lowSim];
    const picked: Array<{ point: WeeklyFractalPoint, similarity: number }> = [];
    const TWO_YEARS_MS = 2 * 365 * 24 * 60 * 60 * 1000;

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
  }, [indicators.z, indicators.ma, indicators.s, investmentPeriod, lastDataPoint.d, HISTORICAL_DATA]);

  const formatCurrency = (val: number) => {
    return new Intl.NumberFormat('ko-KR', {
      style: 'currency',
      currency: 'KRW',
      maximumFractionDigits: 0
    }).format(val);
  };

  const calculateProjection = (baseAmount: number, periodMonths: number, scenario: 'bull' | 'bear' | 'avg') => {
    if (similarPeriods.length === 0 || HISTORICAL_DATA.length === 0) return baseAmount;

    const returns = similarPeriods.map(item => {
      const pointTime = new Date(item.point.d).getTime();
      const targetTime = pointTime + (periodMonths * 30 * 24 * 60 * 60 * 1000);

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

      const rawMultiplier = closestFuturePoint.p / item.point.p;
      let dimFactor = 1.0;
      if (lastDataPoint.p > item.point.p && item.point.p > 0) {
        const logHist = Math.log10(item.point.p);
        const logCurr = Math.log10(lastDataPoint.p);
        if (logCurr > logHist) {
          dimFactor = Math.max(0.35, logHist / logCurr);
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
      multiplier = returns.reduce((a, b) => a + b, 0) / returns.length;
    }

    return baseAmount * multiplier;
  };

  const bestCase = calculateProjection(investmentAmount, investmentPeriod, 'bull');
  const worstCase = calculateProjection(investmentAmount, investmentPeriod, 'bear');
  const avgCase = calculateProjection(investmentAmount, investmentPeriod, 'avg');

  const chartData = useMemo(() => {
    if (similarPeriods.length === 0 || HISTORICAL_DATA.length === 0) return [];

    const weeks = Math.round((investmentPeriod * 30) / 7);
    const data = [];
    const currentIdx = HISTORICAL_DATA.findIndex(p => p.d === lastDataPoint.d);

    if (currentIdx === -1) return [];

    const histIndices = similarPeriods.map(sp =>
      HISTORICAL_DATA.findIndex(p => p.d === sp.point.d)
    );

    for (let w = -weeks; w <= weeks; w++) {
      const dataPoint: any = { weekOffset: w };

      if (w <= 0) {
        const idx = currentIdx + w;
        if (idx >= 0 && idx < HISTORICAL_DATA.length) {
          dataPoint.current = ((HISTORICAL_DATA[idx].p / HISTORICAL_DATA[currentIdx].p) - 1) * 100;
        }
      }

      let sumFuture = 0;
      let countFuture = 0;

      histIndices.forEach((hIdx, i) => {
        if (hIdx === -1) return;
        const idx = hIdx + w;
        if (idx >= 0 && idx < HISTORICAL_DATA.length) {
          const rawMultiplier = HISTORICAL_DATA[idx].p / HISTORICAL_DATA[hIdx].p;
          const histPriceObj = HISTORICAL_DATA[hIdx];

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
            normalized = (rawMultiplier > 1)
              ? ((rawMultiplier - 1) * dimFactor) * 100
              : -((1 - rawMultiplier) * dimFactor) * 100;
          } else {
            normalized = (rawMultiplier - 1) * 100;
          }

          dataPoint[`hist${i + 1}`] = normalized;

          if (w >= 0) {
            sumFuture += normalized;
            countFuture++;
          }
        }
      });

      if (w >= 0 && countFuture > 0) {
        dataPoint.avgFuture = sumFuture / countFuture;
      }
      data.push(dataPoint);
    }

    return data;
  }, [similarPeriods, investmentPeriod, lastDataPoint.d, HISTORICAL_DATA]);

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
                if (!isNaN(val)) setInvestmentAmount(val);
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
                <span className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded text-xs">{indicators.z.toFixed(2)}</span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner flex relative">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${indicators.z >= 3.0 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                      indicators.z < 1.0 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-yellow-500 to-orange-400'
                    }`}
                  style={{ width: `${Math.min(Math.max(((indicators.z - (-0.5)) / 7.5) * 100, 0), 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono px-1">
                <span>-0.5 (바닥)</span>
                <span>1.0 (안전)</span>
                <span>3.0 (경계)</span>
                <span>7.0 (광기)</span>
              </div>
            </div>

            <div className="p-4 bg-slate-900/60 rounded-xl border border-white/5 shadow-inner">
              <div className="flex justify-between items-center mb-2">
                <span className="text-slate-400 text-sm font-medium">200주 MA 이격률</span>
                <span className="text-white font-mono bg-slate-800 px-2 py-0.5 rounded text-xs">
                  {indicators.ma >= 1 ? `+${((indicators.ma - 1) * 100).toFixed(0)}%` : `-${((1 - indicators.ma) * 100).toFixed(0)}%`}
                </span>
              </div>
              <div className="w-full bg-slate-800 h-2 rounded-full overflow-hidden shadow-inner flex relative">
                <div
                  className={`h-full rounded-full transition-all duration-1000 ${indicators.ma >= 2.5 ? 'bg-gradient-to-r from-orange-500 to-red-500' :
                      indicators.ma < 1.5 ? 'bg-gradient-to-r from-emerald-500 to-green-400' : 'bg-gradient-to-r from-yellow-500 to-orange-400'
                    }`}
                  style={{ width: `${Math.min(Math.max(((indicators.ma - 0.5) / 4.5) * 100, 0), 100)}%` }}
                />
              </div>
              <div className="flex justify-between text-[9px] text-slate-500 mt-1 font-mono px-1">
                <span>0.5x (바닥)</span>
                <span>1.5x (안전)</span>
                <span>2.5x (경계)</span>
                <span>5.0x (광기)</span>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 shadow-inner flex flex-col justify-center items-center">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">단기 추세(60d)</span>
                <span className={`text-sm font-bold ${indicators.s > 0 ? 'text-green-400' : 'text-red-400'} flex items-center gap-1`}>
                  {indicators.s > 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
                  {indicators.s > 0 ? 'Uptrend' : 'Downtrend'}
                </span>
              </div>
              <div className="p-3 bg-slate-900/60 rounded-xl border border-white/5 shadow-inner flex flex-col justify-center items-center">
                <span className="text-slate-500 text-[10px] font-bold uppercase tracking-wider mb-1">반감기 사이클</span>
                <span className="text-cyan-400 text-sm font-bold font-mono">
                  D+{getDaysSinceHalving(indicators.date || new Date().toISOString())}일
                </span>
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
                  <span className="text-cyan-400 font-mono font-medium">{item.point.d}</span>
                  <span className="text-slate-300 text-xs font-bold bg-slate-800 px-2 py-1 rounded-md">일치율 {Math.round(item.similarity)}%</span>
                </li>
              )) : (
                <li className="text-sm text-slate-500 italic py-2 px-3 text-center bg-white/5 rounded-lg border-dashed border border-white/10">
                  데이터 로딩 중...
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="glass-panel p-6 sm:p-8 space-y-6 max-w-5xl mx-auto rounded-3xl border border-cyan-500/20 shadow-2xl relative overflow-hidden">
        <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-indigo-500 via-cyan-400 to-emerald-500"></div>
        <h2 className="text-2xl sm:text-3xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 tracking-tight text-center mb-6">
          {investmentPeriod >= 12 ? `${investmentPeriod / 12}년` : `${investmentPeriod}개월`} 뒤 예상 자산 가치
        </h2>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-5">
          <div className="glass-panel p-4 md:p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingDown className="w-4 h-4 text-red-400" />
                <span className="text-sm font-bold text-slate-300 uppercase">Worst Case</span>
              </div>
              <div className="text-2xl font-bold text-white mb-2 font-mono">{formatCurrency(worstCase)}</div>
              <div className={`px-2 py-1 rounded text-xs font-bold ${worstCase >= investmentAmount ? 'bg-green-500/10 text-green-400' : 'bg-red-500/10 text-red-400'}`}>
                {((worstCase - investmentAmount) / investmentAmount * 100).toFixed(0)}% ROI
              </div>
            </div>
          </div>

          <div className="glass-panel p-4 md:p-5 rounded-2xl border-cyan-500/30 flex flex-col justify-between transform hover:-translate-y-1 transition-all">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-cyan-400" />
                <span className="text-sm font-bold text-white uppercase">Avg. Scenario</span>
              </div>
              <div className="text-3xl font-bold text-white mb-2 font-mono">{formatCurrency(avgCase)}</div>
              <div className="bg-green-500/20 text-green-400 px-2 py-1 rounded text-sm font-bold inline-block">
                +{((avgCase - investmentAmount) / investmentAmount * 100).toFixed(0)}% ROI
              </div>
            </div>
          </div>

          <div className="glass-panel p-4 md:p-5 rounded-2xl flex flex-col justify-between">
            <div>
              <div className="flex items-center gap-2 mb-3">
                <TrendingUp className="w-4 h-4 text-green-400" />
                <span className="text-sm font-bold text-slate-300 uppercase">Best Case</span>
              </div>
              <div className="text-2xl font-bold text-white mb-2 font-mono">{formatCurrency(bestCase)}</div>
              <div className="bg-green-500/10 text-green-400 px-2 py-1 rounded text-xs font-bold inline-block">
                +{((bestCase - investmentAmount) / investmentAmount * 100).toFixed(0)}% ROI
              </div>
            </div>
          </div>
        </div>
      </div>

      {similarPeriods.length > 0 && (
        <div className="glass-panel p-4 sm:p-6 rounded-2xl">
          <div className="h-[400px] w-full">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={chartData}>
                <CartesianGrid strokeDasharray="3 3" stroke="rgba(255,255,255,0.05)" />
                <XAxis dataKey="weekOffset" stroke="#64748b" tickFormatter={(val) => val === 0 ? 'Today' : `${val}W`} />
                <YAxis stroke="#64748b" tickFormatter={(val) => `${val}%`} />
                <Tooltip content={<CustomTooltip />} />
                <ReferenceLine x={0} stroke="rgba(255,255,255,0.2)" />
                <Line type="monotone" dataKey="current" name="현재 궤적" stroke="#ffffff" strokeWidth={3} dot={false} />
                <Line type="monotone" dataKey="avgFuture" name="미래 예상치" stroke="#06b6d4" strokeWidth={4} dot={false} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        </div>
      )}
    </div>
  );
}
