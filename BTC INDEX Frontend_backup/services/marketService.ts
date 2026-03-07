import { ReportData, Indicator } from '../types';
// [변경] GitHub Raw 데이터 주소
// 사용자가 본인의 레포지토리 주소로 변경해야 함
const API_URL = "https://raw.githubusercontent.com/frozenfrog89/BTC-Index-Dashboard/main/data.json";

export const fetchMarketData = async (): Promise<ReportData> => {
  try {
    // 캐시 방지를 위해 timestamp 추가
    const response = await fetch(`${API_URL}?t=${new Date().getTime()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    const price = data.market.current_price_usd;
    const wma200 = data.market.wma_200_usd;
    const sentiment = data.sentiment.value;
    const onchain = data.onchain;

    // Map backend data to indicators
    const rawIndicators = [
      { name: 'MVRV Z-Score', val: onchain.mvrv_z_score, weight: 27.5 },
      { name: 'Puell Multiple', val: onchain.puell_multiple, weight: 17.5 },
      { name: 'NUPL', val: onchain.nupl, weight: 17.5 },
      { name: '200 Week MA', val: wma200, weight: 17.5 },
      { name: 'Fear & Greed', val: sentiment, weight: 12.5 },
      { name: 'Funding Rate', val: onchain.funding_rate, weight: 7.5 },
    ];

    let totalWeightedScore = 0;

    // Calculate scores
    const indicators: Indicator[] = rawIndicators.map(ind => {
      const value = ind.val !== null && ind.val !== undefined ? ind.val : 0;
      const isMissing = ind.val === null || ind.val === undefined;

      const { score, signal } = calculateScore(ind.name, value, price);

      const finalScore = isMissing ? 5 : score;
      const weightedScore = (finalScore * ind.weight) / 100;

      totalWeightedScore += weightedScore;

      let displayVal = isMissing ? "Loading..." : value.toLocaleString(undefined, { maximumFractionDigits: 2 });
      if (!isMissing && ind.name === '200 Week MA') displayVal = `$${value.toLocaleString()}`;
      if (!isMissing && ind.name === 'Funding Rate') displayVal = `${value.toFixed(3)}%`;
      if (!isMissing && ind.name === 'Fear & Greed') displayVal = `${value}/100`;

      return {
        name: ind.name,
        weight: ind.weight,
        currentValue: displayVal,
        score: finalScore,
        weightedScore,
        signal: isMissing ? 'NEUTRAL' : signal
      };
    });

    const finalScore = Math.min(Math.round(totalWeightedScore * 10), 100);
    const texts = generateKoreanAnalysis(finalScore, price);

    return {
      btcPrice: price,
      timestamp: new Date(data.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      totalScore: finalScore,
      interpretation: texts.interpretation,
      strategyText: texts.strategy,
      risksAndAdvice: texts.risks,
      indicators,
      sources: ["CoinGecko", "Alternative.me", "MacroMicro (via Backend)"]
    };

  } catch (error) {
    console.error("Failed to fetch from backend:", error);
    throw error;
  }
};

function calculateScore(name: string, value: number, price: number): { score: number, signal: 'BUY' | 'NEUTRAL' | 'SELL' } {
  let score = 5;
  let signal: 'BUY' | 'NEUTRAL' | 'SELL' = 'NEUTRAL';

  if (name === 'MVRV Z-Score') {
    if (value <= 0.1) { score = 10; signal = 'BUY'; }
    else if (value <= 1.0) { score = 8; signal = 'BUY'; }
    else if (value >= 7.0) { score = 0; signal = 'SELL'; }
    else if (value >= 3.0) { score = 2; signal = 'SELL'; }
    else score = 5;
  }
  else if (name === 'Puell Multiple') {
    if (value <= 0.5) { score = 10; signal = 'BUY'; }
    else if (value <= 0.8) { score = 7; signal = 'BUY'; }
    else if (value >= 4.0) { score = 0; signal = 'SELL'; }
    else if (value >= 2.5) { score = 3; signal = 'SELL'; }
    else score = 5;
  }
  else if (name === 'NUPL') {
    if (value < 0) { score = 10; signal = 'BUY'; }
    else if (value < 0.25) { score = 8; signal = 'BUY'; }
    else if (value > 0.75) { score = 0; signal = 'SELL'; }
    else if (value > 0.5) { score = 3; signal = 'SELL'; }
    else score = 5;
  }
  else if (name === '200 Week MA') {
    if (value === 0) return { score: 5, signal: 'NEUTRAL' }; // Avoid div by zero
    const ratio = price / value;
    if (ratio <= 1.0) { score = 10; signal = 'BUY'; }
    else if (ratio <= 1.3) { score = 8; signal = 'BUY'; }
    else if (ratio >= 3.0) { score = 0; signal = 'SELL'; }
    else score = 5;
  }
  else if (name === 'Fear & Greed') {
    if (value <= 20) { score = 9; signal = 'BUY'; }
    else if (value >= 80) { score = 1; signal = 'SELL'; }
    else score = 5;
  }
  else if (name === 'Funding Rate') {
    if (value < 0) { score = 8; signal = 'BUY'; } // Negative funding is bullish (shorts paying longs)
    else if (value > 0.05) { score = 2; signal = 'SELL'; } // High positive funding is bearish
    else score = 5;
  }

  return { score, signal };
}

function generateKoreanAnalysis(totalScore: number, price: number): { interpretation: string, strategy: string, risks: string } {
  if (totalScore >= 80) {
    return {
      interpretation: "💎 강력한 매수 신호 (Strong Buy)",
      strategy: "### 🟢 적극 매수 권장\n* 온체인 데이터가 역사적 저점(Bottom)을 가리킵니다.\n* 현금 비중을 최소화하고 비트코인 비중을 늘리세요.",
      risks: "추가 하락시 분할 매수로 대응하세요."
    };
  } else if (totalScore >= 60) {
    return {
      interpretation: "✅ 매수 우위 (Accumulate)",
      strategy: "### 🟡 분할 매수 구간\n* 상승 추세가 유효하거나 저점 확인 중입니다.\n* 정립식 매수(DCA)를 지속하세요.",
      risks: "단기 변동성에 주의하세요."
    };
  } else if (totalScore <= 30) {
    return {
      interpretation: "⚠️ 과열 경보 (Overheated)",
      strategy: "### 🔴 매도/리스크 관리\n* 시장이 과열되었습니다. 부분 매도를 고려하세요.\n* 레버리지 사용을 자제하세요.",
      risks: "급작스러운 조정이 발생할 수 있습니다."
    };
  } else {
    return {
      interpretation: "⚖️ 중립 (Neutral)",
      strategy: "### ⚪ 관망/홀딩\n* 뚜렷한 방향성이 나오지 않았습니다.\n* 무리한 매매보다는 시장을 관찰하세요.",
      risks: "횡보장이 길어질 수 있습니다."
    };
  }
}
