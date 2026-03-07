import { ReportData, Indicator } from '../types';
// [변경] 깃허브 Raw Data 주소 (운영 환경 배포용)
const API_URL = "https://raw.githubusercontent.com/alphafrog2030/BTC-INDEX-Dashboard/main/BTC%20INDEX%20Backend/data.json";

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
      if (!isMissing && ind.name === '200 Week MA') {
        const ratio = price / value;
        const diff = (ratio - 1) * 100;
        displayVal = diff >= 0 ? `+${diff.toFixed(2)}%` : `${diff.toFixed(2)}%`;
      }
      if (!isMissing && ind.name === 'Funding Rate') displayVal = `${(value * 100).toFixed(3)}%`;
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
    const texts = generateKoreanAnalysis(price, finalScore, indicators);

    return {
      btcPrice: price,
      timestamp: new Date(data.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      totalScore: finalScore,
      interpretation: texts.interpretation,
      strategyText: texts.strategyText,
      risksAndAdvice: texts.risksAndAdvice,
      breakdownText: texts.breakdownText,
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

export const generateKoreanAnalysis = (
  btcPrice: number,
  totalScore: number,
  indicators: Indicator[]
): { interpretation: string; strategyText: string; risksAndAdvice: string; breakdownText?: string } => {
  // 1. Interpretation (Current Status Summary)
  let interpretation = "시장 데이터 분석 중...";
  if (totalScore >= 90) interpretation = "💎 강력한 매수 신호 (Strong Buy)";
  else if (totalScore >= 70) interpretation = "✅ 매수 우위 (Accumulate)";
  else if (totalScore <= 30) interpretation = "⚠️ 과열 경보 (Overheated)";
  else interpretation = "⚖️ 중립 (Neutral)";

  // 2. Strategy Text (Detailed Breakdown)
  const mvrv = indicators.find((i) => i.name === "MVRV Z-Score");
  const nupl = indicators.find((i) => i.name === "NUPL");
  const puell = indicators.find((i) => i.name === "Puell Multiple");
  const ma200 = indicators.find((i) => i.name === "200 Week MA");
  const fearGreed = indicators.find((i) => i.name === "Fear & Greed");
  const funding = indicators.find((i) => i.name === "Funding Rate");
  const reserve = indicators.find((i) => i.name === "Reserve Risk");
  const sopr = indicators.find((i) => i.name === "SOPR");

  // Helper to format numbers
  const fmt = (val: number | string) => (typeof val === 'number' ? val.toLocaleString(undefined, { maximumFractionDigits: 2 }) : val);

  let strategyText = `# 📊 종합 점수 및 투자 전략\n\n`;

  if (totalScore >= 70) {
    strategyText += `> **현재 시장은 저평가 구간**에 위치해 있으며, 장기적인 관점에서 **적극적인 매수(Accumulation)**가 유리한 시기입니다.\n>\n> 공포가 시장을 지배하고 있을 가능성이 높으나, 역사적으로 이러한 구간은 최고의 수익률을 기록했습니다.\n\n`;
    strategyText += `- \`💡 자금 배분 전략 (예시)\`  \n**공격적 투자자**: 여유 자금의 40~50%를 현재 가격대에서 분할 진입 고려.  \n**보수적 투자자**: 매주/매월 정해진 날짜에 일정 금액을 적립식으로 매수(DCA) 추천.  \n**🚨 주의**: 바닥을 정확히 예측하려 하기보다, 평균 단가를 낮추는 데 집중하세요.\n\n`;
  } else if (totalScore <= 30) {
    strategyText += `> **현재 시장은 과열 구간**에 진입했습니다. 탐욕이 지배하고 있으며, 가격이 단기적으로 급등했을 가능성이 큽니다.\n>\n> 리스크 관리가 최우선입니다.\n\n`;
    strategyText += `- \`💡 자금 배분 전략 (예시)\`  \n**이익 실현**: 보유 물량의 10~20%씩 분할 매도하여 현금 비중 확대.  \n**🚨 신규 진입 자제**: 지금 매수하는 것은 고점에 물릴 위험이 매우 큽니다. 조정(Correction)을 기다리세요.\n\n`;
  } else {
    strategyText += `> **현재 시장은 중립 구간**입니다. 뚜렷한 방향성보다는 횡보하거나 완만한 상승/하락을 보일 수 있습니다.\n\n`;
    strategyText += `- \`💡 자금 배분 전략 (예시)\`  \n**관망 및 소액 적립**: 무리한 베팅보다는 시장의 방향성이 결정될 때까지 관망하거나, 소액으로 꾸준히 모아가는 전략이 유효합니다.\n\n`;
  }

  let breakdownText = `\n---\n\n`;
  breakdownText += `# 🔍 상세 지표 분석 (Detailed Breakdown)\n\n`;

  // MVRV Analysis
  if (mvrv) {
    let card = `- \`1. MVRV Z-Score - 현재수치: ${fmt(mvrv.currentValue)}\`  \n`;
    if (mvrv.score >= 8) {
      card += `**상태**: 🟢 저평가 (Undervalued)  \n**해석**: 시장 가치가 실현 가치보다 낮거나 비슷합니다. 역사적 바닥권에 근접했습니다.\n`;
    } else if (mvrv.score <= 2) {
      card += `**상태**: 🔴 고평가 (Overvalued)  \n**해석**: 시장 가치가 실현 가치를 훨씬 웃돌고 있습니다. 거품이 끼어있을 가능성이 높습니다.\n`;
    } else {
      card += `**상태**: 🟡 중립 (Neutral)  \n**해석**: 적정 가치 수준에서 거래되고 있습니다.\n`;
    }
    breakdownText += card;
  }

  // NUPL Analysis
  if (nupl) {
    let card = `- \`2. NUPL - 현재수치: ${fmt(nupl.currentValue)}\`  \n`;
    if (nupl.score >= 8) {
      card += `**상태**: 🟢 공포/항복 (Fear/Capitulation)  \n**해석**: 투자자들의 평균 수익률이 낮거나 손실 상태입니다. 매도 압력이 거의 소진되었습니다.\n`;
    } else if (nupl.score <= 2) {
      card += `**상태**: 🔴 환희/탐욕 (Euphoria/Greed)  \n**해석**: 대부분의 투자자가 큰 수익을 보고 있어 차익 실현 욕구가 강해질 수 있습니다.\n`;
    } else {
      card += `**상태**: 🟡 중립 (Neutral)  \n**해석**: 시장 심리가 안정적입니다.\n`;
    }
    breakdownText += card;
  }

  // Puell Multiple Analysis
  if (puell) {
    let card = `- \`3. Puell Multiple - 현재수치: ${fmt(puell.currentValue)}\`  \n`;
    if (puell.score >= 8) {
      card += `**상태**: 🟢 채굴자 항복 (Miner Capitulation)  \n**해석**: 채굴 수익성이 낮아 채굴자들이 코인을 팔지 못하거나 운영을 중단하는 바닥 신호입니다.\n`;
    } else if (puell.score <= 2) {
      card += `**상태**: 🔴 채굴자 수익 극대화  \n**해석**: 채굴 수익이 높아 채굴자들이 시장에 물량을 쏟아낼 수 있습니다.\n`;
    } else {
      card += `**상태**: 🟡 안정적  \n**해석**: 채굴자들의 매도 압력이 평이한 수준입니다.\n`;
    }
    breakdownText += card;
  }

  // 200 Week MA Analysis
  if (ma200) {
    let card = `- \`4. 200 Week MA - 현재수치: ${fmt(ma200.currentValue)}\`  \n`;
    card += `**상태**: ${ma200.score >= 7 ? '🟢 지지선 근접 (Near Support)' : '🟡 추세 지속'}  \n**해석**: 비트코인의 장기적인 바닥 지지선입니다. 현재 가격이 이 선에 가까울수록 강력한 매수 기회입니다.\n`;
    breakdownText += card;
  }

  // Fear & Greed Analysis
  if (fearGreed) {
    let card = `- \`5. Fear & Greed Index - 현재수치: ${fmt(fearGreed.currentValue)}\`  \n`;
    if (fearGreed.score >= 8) {
      card += `**상태**: 🟢 극단적 공포 (Extreme Fear)  \n**해석**: 대중이 공포에 질려 투매하고 있습니다. 역발상 투자로 매수하기 좋은 시점입니다.\n`;
    } else if (fearGreed.score <= 2) {
      card += `**상태**: 🔴 극단적 탐욕 (Extreme Greed)  \n**해석**: 대중이 흥분하여 추격 매수하고 있습니다. 조심해야 할 시점입니다.\n`;
    } else {
      card += `**상태**: 🟡 중립/공포  \n**해석**: 시장 심리가 한쪽으로 쏠리지 않았습니다.\n`;
    }
    breakdownText += card;
  }

  // Funding Rate Analysis
  if (funding) {
    let card = `- \`6. Funding Rate - 현재수치: ${fmt(funding.currentValue)}\`  \n`;
    if (funding.score >= 7) {
      card += `**상태**: 🟢 음수/중립 (Negative/Neutral)  \n**해석**: 숏 포지션이 우세하거나 과열되지 않았습니다. 건전한 상승이 가능한 상태입니다.\n`;
    } else if (funding.score <= 3) {
      card += `**상태**: 🔴 과열 (Overheated)  \n**해석**: 롱 포지션이 과도하게 많아 롱 스퀴즈(급락) 위험이 있습니다.\n`;
    } else {
      card += `**상태**: 🟡 안정적  \n**해석**: 선물 시장의 과열 징후가 없습니다.\n`;
    }
    breakdownText += card;
  }

  // Reserve Risk Analysis
  if (reserve) {
    let card = `- \`7. Reserve Risk - 현재수치: ${fmt(reserve.currentValue)}\`  \n`;
    if (reserve.score >= 8) {
      card += `**상태**: 🟢 매력적 (Attractive)  \n**해석**: 장기 보유자들의 확신은 높은데 가격은 낮은 상태입니다. 매수하기 좋습니다.\n`;
    } else {
      card += `**상태**: 🟡 보통  \n**해석**: 리스크 대비 보상이 평범한 수준입니다.\n`;
    }
    breakdownText += card;
  }

  let risksAndAdvice = `# 💡 투자 인사이트 (Insights)\n\n`;

  let insight1 = `- \`1. 과거 사이클 비교\`  \n`;
  if (totalScore >= 70) {
    insight1 += `**패턴**: 2018년 약세장 바닥 / 2020년 코로나 위기 직후와 유사  \n**전망**: 과거 데이터상 এই 구간 매수자들은 1~2년 내 큰 수익을 거두었습니다.\n`;
  } else if (totalScore <= 30) {
    insight1 += `**패턴**: 2021년 상반기 고점 부근과 유사한 과열 양상  \n**전망**: 과거 데이터상 이후 큰 폭의 가격 조정(-30% 이상)이 발생하곤 했습니다.\n`;
  } else {
    insight1 += `**패턴**: 상승장 중간 단계(Mid-Cycle) 또는 조정기  \n**전망**: 방향성이 명확해질 때까지 인내심을 갖는 것이 중요합니다.\n`;
  }
  risksAndAdvice += insight1 + "\n";

  let insight2 = `- \`2. 단기 vs 장기 전망\`  \n`;
  insight2 += `**단기(1주~1개월)**: ${funding && funding.score <= 4 ? '선물 시장 과열로 변동성 확대 주의' : '안정적인 흐름 예상되나 뉴스에 따른 등락 가능성'}  \n`;
  insight2 += `**장기(6개월~1년)**: ${totalScore >= 60 ? '온체인 지표들이 강력한 상승 여력을 시사함' : '거시 경제 상황에 따라 제한적인 상승 또는 횡보 예상'}\n\n`;
  risksAndAdvice += insight2;

  let insight3 = `- \`3. 투자자 심리 (Sentiment)\`  \n`;
  insight3 += `**현재 심리**: ${fearGreed ? (fearGreed.score >= 7 ? '공포(Fear)' : fearGreed.score <= 3 ? '탐욕(Greed)' : '중립(Neutral)') : '알 수 없음'}  \n`;
  if (fearGreed && fearGreed.score >= 7) {
    insight3 += `**조언**: "남들이 공포에 질려 있을 때 욕심을 부려라"는 격언을 상기할 때입니다.\n`;
  } else if (fearGreed && fearGreed.score <= 3) {
    insight3 += `**조언**: "남들이 욕심을 부릴 때 두려워하라"는 격언을 상기할 때입니다.\n`;
  } else {
    insight3 += `**조언**: 시장의 관심이 식어있거나 눈치보기 장세가 이어지고 있습니다.\n`;
  }
  risksAndAdvice += insight3 + "\n";

  return { interpretation, strategyText, risksAndAdvice, breakdownText };
};
