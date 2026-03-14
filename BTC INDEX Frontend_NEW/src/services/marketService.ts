import { ReportData, Indicator } from '../types';

// 깃허브 Raw Data 주소 (신규 백엔드 경로)
// GitHub Raw URL for the data.json file
// Note: Space in "BTC INDEX Backend_NEW" must be encoded as "%20"
const BASE_URL = "https://raw.githubusercontent.com/alphafrog2030/BTC-INDEX-Dashboard/main/BTC%20INDEX%20Backend_NEW/data";
const API_URL = `${BASE_URL}/data.json`;
const HISTORICAL_API_URL = `${BASE_URL}/historical_onchain.json`;

interface IndicatorBackendData {
  value: number | null;
  score: number;
  weight: number;
  signal: 'BUY' | 'NEUTRAL' | 'SELL';
}

export interface MarketData {
  total_score: number;
  overall_signal: string;
  market: {
    current_price_usd: number;
    wma_200_usd: number;
    wma_ratio: number;
  };
  sentiment: {
    value: number;
    classification: string;
  };
  onchain: {
    [key: string]: {
      value: number | null;
      score: number;
      weight: number;
      signal: string;
    };
  };
  timestamp: string;
}

/**
 * Maps backend data structure to frontend ReportData structure.
 * This function encapsulates the transformation logic.
 */
const mapBackendToFrontend = (data: MarketData): ReportData => {
  const market = data.market;
  const onchain = data.onchain;
  const sentiment = data.sentiment;

  // 백엔드에서 전송된 0-100점 척도 점수와 신호
  const bScore = data.total_score || 50;
  const bSignal = data.overall_signal || 'NEUTRAL';

  // 지표 매핑 최적화
  const indicatorKeys: { [key: string]: string } = {
    'mvrv_z_score': 'MVRV Z-Score',
    'reserve_risk': 'Reserve Risk',
    'sth_sopr': 'STH-SOPR',
    'puell_multiple': 'Puell Multiple',
    'funding_rate': 'Funding Rate',
    'wma_ratio': '200 Week MA'
  };

  const indicators: Indicator[] = Object.keys(indicatorKeys).map(key => {
    let item = onchain[key] as IndicatorBackendData | undefined;

    // wma_ratio가 onchain에 없는 구버전 data.json 대응: market 섹션에서 폴백
    if (!item && key === 'wma_ratio' && market.wma_ratio != null) {
      item = {
        value: market.wma_ratio,
        score: 5,
        weight: 0.10,
        signal: market.wma_ratio > 2.5 ? 'SELL' : (market.wma_ratio < 1.1 ? 'BUY' : 'NEUTRAL')
      };
    }

    // item이 없거나 indicator 형태가 아닌 경우(realized_cap 등) 방어 처리
    if (!item || typeof item !== 'object' || !('score' in item)) {
      return {
        name: indicatorKeys[key],
        weight: 0,
        currentValue: 'N/A',
        score: 5,
        weightedScore: 0,
        signal: 'NEUTRAL' as 'BUY' | 'NEUTRAL' | 'SELL'
      };
    }

    const isMissing = item.value === null || item.value === undefined;
    let displayVal = isMissing ? "Loading..." : item.value!.toLocaleString(undefined, {
      maximumFractionDigits: (key === 'reserve_risk' ? 6 : (key === 'funding_rate' ? 4 : 2))
    });

    if (key === 'funding_rate' && !isMissing) displayVal = `${(item.value! * 100).toFixed(4)}%`;
    if (key === 'wma_ratio' && !isMissing) {
      const diff = (item.value! - 1) * 100;
      displayVal = `${diff >= 0 ? '+' : ''}${diff.toFixed(2)}%`;
    }

    const weightPct = (item.weight ?? 0) * 100; // 0.25 → 25 (퍼센트 변환)

    return {
      name: indicatorKeys[key],
      weight: weightPct,
      currentValue: displayVal,
      score: item.score,
      weightedScore: (item.score * weightPct) / 100,
      signal: (item.signal ?? 'NEUTRAL') as 'BUY' | 'NEUTRAL' | 'SELL'
    };
  });

  // Fear & Greed 추가 (점수엔 미포함이나 시각화용)
  indicators.push({
    name: 'Fear & Greed',
    weight: 0,
    currentValue: sentiment.value.toString(),
    score: Math.round(sentiment.value / 10),
    weightedScore: 0,
    signal: sentiment.value >= 70 ? 'SELL' : (sentiment.value <= 30 ? 'BUY' : 'NEUTRAL')
  });

  return {
    totalScore: bScore,
    btcPrice: market.current_price_usd,
    timestamp: new Date(data.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
    interpretation: generateKoreanAnalysis(bScore, bSignal, indicators),
    strategyText: "", // interpretation 필드에 통합됨
    risksAndAdvice: "",
    breakdownText: "",
    indicators: indicators,
    sources: ["BGeometrics", "Alternative.me", "Onchain Analyzer v2.0"]
  };
};

/**
 * Fetches the latest market report data from the backend
 */
export const fetchMarketData = async (): Promise<ReportData> => {
  try {
    const response = await fetch(`${API_URL}?t=${new Date().getTime()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data: MarketData = await response.json();
    return mapBackendToFrontend(data);
  } catch (error) {
    console.error('Error fetching market data:', error);
    throw error;
  }
};

/**
 * Fetches the full historical on-chain data for the simulator
 */
export const fetchHistoricalData = async (): Promise<any[]> => {
  try {
    const response = await fetch(`${HISTORICAL_API_URL}?t=${new Date().getTime()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    return await response.json();
  } catch (error) {
    console.error('Error fetching historical data:', error);
    return []; // Return empty array on failure to prevent crash
  }
};

function generateKoreanAnalysis(score: number, signal: string, indicators: Indicator[]): string {
  let text = `# 📊 종합 진단: ${signal}\n\n`;
  text += `현재 비트코인 온체인 종합 점수는 **${score}점**으로, **${signal === 'BUY' ? '적극적 가치 매수' : (signal === 'SELL' ? '과열 리스크 관리' : '중립적 관망')}**이 필요한 시점입니다.\n\n`;

  const topBuys = indicators.filter(i => i.signal === 'BUY' && i.weight > 0);
  const topSells = indicators.filter(i => i.signal === 'SELL' && i.weight > 0);

  if (signal === 'BUY') {
    text += `### 💡 투자 전략\n시장의 변동성 수축과 성숙도를 반영한 분석 결과, 현재 가격대는 역사적 저점 영역에 해당합니다. 분할 매수(DCA)를 통해 물량을 확보하기 좋은 구간입니다. \n\n`;
  } else if (signal === 'SELL') {
    text += `### 💡 투자 전략\n지표들이 단기적/중장기적 과열 권역에 도달했습니다. 신규 진입보다는 보유 물량의 일부를 현금화하여 리스크를 관리하는 전략이 유효합니다. \n\n`;
  } else {
    text += `### 💡 투자 전략\n추세의 방향성을 확인하며 조급하지 않게 시장에 대응하는 지혜가 필요합니다. 주요 매물대 돌파 여부를 주시하세요. \n\n`;
  }

  if (topBuys.length > 0) text += `**🟢 매수 강세 지표:** ${topBuys.map(i => i.name).join(', ')}\n`;
  if (topSells.length > 0) text += `**🔴 주의 심화 지표:** ${topSells.map(i => i.name).join(', ')}\n`;

  return text;
}
