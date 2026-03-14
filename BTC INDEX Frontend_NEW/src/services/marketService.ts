import { ReportData, Indicator } from '../types';
// 백엔드 NEW 경로 (BTC INDEX Backend_NEW/data/data.json)
const API_URL = "https://raw.githubusercontent.com/alphafrog2030/BTC-INDEX-Dashboard/main/BTC%20INDEX%20Backend_NEW/data/data.json";

// 백엔드 지표 키 → 프론트엔드 표시명 + 가중치 매핑 (analyzer.py WEIGHTS와 동일)
const INDICATOR_DEFS = [
  { key: 'mvrv_z_score',   name: 'MVRV Z-Score',   weight: 25 },
  { key: 'reserve_risk',   name: 'Reserve Risk',    weight: 20 },
  { key: 'sth_sopr',       name: 'STH-SOPR',        weight: 15 },
  { key: 'puell_multiple', name: 'Puell Multiple',  weight: 15 },
  { key: 'funding_rate',   name: 'Funding Rate',    weight: 15 },
  { key: 'wma_ratio',      name: '200 Week MA',     weight: 10 },
] as const;

function formatIndicatorValue(key: string, value: number): string {
  switch (key) {
    case 'mvrv_z_score':   return value.toFixed(4);
    case 'reserve_risk':   return parseFloat(value.toPrecision(4)).toString();
    case 'sth_sopr':       return value.toFixed(4);
    case 'puell_multiple': return value.toFixed(3);
    case 'funding_rate':   return `${(value * 100).toFixed(5)}%`;
    case 'wma_ratio': {
      const diff = (value - 1) * 100;
      return diff >= 0 ? `+${diff.toFixed(2)}%` : `${diff.toFixed(2)}%`;
    }
    default: return value.toLocaleString(undefined, { maximumFractionDigits: 4 });
  }
}

export const fetchMarketData = async (): Promise<ReportData> => {
  try {
    // 캐시 방지를 위해 timestamp 추가
    const response = await fetch(`${API_URL}?t=${new Date().getTime()}`);
    if (!response.ok) {
      throw new Error(`HTTP error! status: ${response.status}`);
    }
    const data = await response.json();

    const price = data.market.current_price_usd;
    const onchain = data.onchain;

    // 백엔드가 산출한 score/signal을 직접 사용 (프론트엔드 자체 점수 계산 제거)
    const indicators: Indicator[] = INDICATOR_DEFS.map(def => {
      const ind = onchain[def.key];
      const score: number = ind?.score ?? 5;
      const signal: 'BUY' | 'NEUTRAL' | 'SELL' = ind?.signal ?? 'NEUTRAL';
      const val: number | null = ind?.value ?? null;
      const weightedScore = (score * def.weight) / 100;
      const displayVal = val === null ? 'Loading...' : formatIndicatorValue(def.key, val);

      return {
        name: def.name,
        weight: def.weight,
        currentValue: displayVal,
        score,
        weightedScore,
        signal,
      };
    });

    // 백엔드 total_score 직접 사용 (0~100 스케일)
    const totalScore = data.total_score;
    const texts = generateKoreanAnalysis(price, totalScore, indicators);

    return {
      btcPrice: price,
      timestamp: new Date(data.timestamp).toLocaleString('ko-KR', { timeZone: 'Asia/Seoul' }),
      totalScore,
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



  let risksAndAdvice = `# 💡 투자 인사이트 (Insights)\n\n`;

  let insight1 = `- \`1. 과거 사이클 비교\`  \n`;
  if (totalScore >= 70) {
    insight1 += `**패턴**: 2018년 약세장 바닥 / 2020년 코로나 위기 직후와 유사  \n**전망**: 과거 데이터상 이 구간 매수자들은 1~2년 내 큰 수익을 거두었습니다.\n`;
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
