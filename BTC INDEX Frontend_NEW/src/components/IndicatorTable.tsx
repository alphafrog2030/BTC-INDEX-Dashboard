import React, { useState } from 'react';
import { Indicator } from '../types';
import { ExternalLink, ChevronDown, ChevronUp, Info } from 'lucide-react';
import ReactMarkdown from 'react-markdown';

interface IndicatorTableProps {
  indicators: Indicator[];
}

// Map indicators to reliable external chart URLs for user verification
const SOURCE_URLS: Record<string, string> = {
  'MVRV Z-Score': 'https://en.macromicro.me/series/8365/bitcoin-mvrv-zscore',
  'Puell Multiple': 'https://en.macromicro.me/series/8112/bitcoin-puell-multiple',
  'NUPL': 'https://en.macromicro.me/series/45910/bitcoin-nupl',
  '200 Week MA': 'https://www.lookintobitcoin.com/charts/200-week-moving-average-heatmap/',
  'Funding Rate': 'https://en.macromicro.me/series/21739/bitcoin-perpetual-futures-funding-rate',
  'Fear & Greed': 'https://alternative.me/crypto/fear-and-greed-index/',
};

// Detailed explanations for each indicator
const INDICATOR_DETAILS: Record<string, { meaning: string; interpretation: string }> = {
  'MVRV Z-Score': {
    meaning: '**시장 가치 대 실현 가치 비율 (Market Value to Realized Value)**\n\n비트코인의 "현재 가격(시장 가치)"이 "사람들이 구매한 평균 가격(실현 가치)" 대비 얼마나 고평가/저평가되었는지를 보여줍니다. 역사적으로 비트코인의 고점과 저점을 가장 정확하게 맞춘 지표 중 하나입니다.',
    interpretation: '- **0.1 이하 (초록색 구간)**: **"바닥(Bottom)"**. 시장이 극도로 저평가된 상태입니다. 역사적으로 최고의 매수 기회였습니다.\n- **1.0 이하**: **"저평가"**. 여전히 매수하기 좋은 구간입니다.\n- **3.0 ~ 7.0**: **"과열 진입"**. 가격이 급등하여 실현 가치를 크게 앞지른 상태입니다. 분할 매도를 고려해야 합니다.\n- **7.0 이상 (빨간색 구간)**: **"고점(Top)"**. 시장이 극도로 과열되었습니다. 역사적 사이클의 고점 부근입니다.'
  },
  'Puell Multiple': {
    meaning: '**푸엘 멀티플 (Puell Multiple)**\n\n**채굴자들의 수익성**을 나타냅니다. 채굴자들이 비트코인을 팔아서 얻는 수익이 지난 1년 평균 대비 얼마나 되는지를 봅니다. 채굴자가 항복(Capitulation)하는 시점이 보통 바닥입니다.',
    interpretation: '- **0.5 이하 (초록색 구간)**: **"채굴자 항복"**. 채굴자들이 손해를 보며 운영하거나 문을 닫는 시기입니다. 역사적으로 강력한 매수 신호입니다.\n- **0.5 ~ 1.0**: **"저점 다지기"**. 채굴 수익성이 낮아 매도 압력이 줄어드는 시기입니다.\n- **4.0 이상 (빨간색 구간)**: **"채굴자 수익 극대화"**. 채굴자들이 막대한 수익을 올리며 시장에 물량을 쏟아낼 수 있는 고점 신호입니다.'
  },
  'NUPL': {
    meaning: '**미실현 순손익 (Net Unrealized Profit/Loss)**\n\n현재 비트코인을 보유한 **모든 사람들의 계좌가 평균적으로 수익 중인지, 손실 중인지**를 보여줍니다. 시장 심리(공포 vs 탐욕)를 파악하는 데 유용합니다.',
    interpretation: '- **0 미만 (초록색 구간)**: **"항복(Capitulation)"**. 시장 참여자 전체가 평균적으로 손실을 보고 있는 상태입니다. 공포가 극에 달했을 때가 매수 적기입니다.\n- **0 ~ 0.25**: **"희망/공포"**. 손실에서 벗어나거나 약수익 구간입니다.\n- **0.5 ~ 0.75**: **"믿음/부정"**. 상승장 중반부입니다.\n- **0.75 이상 (빨간색 구간)**: **"환희(Euphoria)"**. 모두가 수익을 보고 있어 탐욕이 지배하는 상태입니다. 고점일 확률이 높습니다.'
  },
  '200 Week MA': {
    meaning: '**200주 이동평균선 (200 Week Moving Average)**\n\n비트코인의 **장기적인 성장 추세선**이자 **최후의 지지선**입니다. 비트코인 역사상 가격이 이 선 아래로 내려가 머문 적은 거의 없습니다.',
    interpretation: '- **가격이 200MA 근처 또는 아래**: **"세대적 매수 기회"**. 몇 년에 한 번 올까 말까 한 저점입니다.\n- **가격이 200MA보다 3배 이상 높음**: **"고평가"**. 장기 추세선에서 너무 멀어졌으므로 회귀하려는 성질이 생깁니다.'
  },
  'Fear & Greed': {
    meaning: '**공포 탐욕 지수 (Fear & Greed Index)**\n\n변동성, 거래량, SNS 언급량 등을 종합하여 **시장 참여자들의 심리 상태**를 0~100으로 수치화한 것입니다.',
    interpretation: '- **20 이하 (Extreme Fear)**: **"극단적 공포"**. 남들이 공포에 질려 던질 때가 매수 기회입니다.\n- **80 이상 (Extreme Greed)**: **"극단적 탐욕"**. 남들이 흥분해서 살 때가 매도 기회입니다.'
  },
  'Funding Rate': {
    meaning: '**펀딩비 (Funding Rate)**\n\n선물 시장에서 **롱(매수) 포지션과 숏(매도) 포지션 중 어느 쪽이 더 많은지**를 보여줍니다. 양수(+)면 롱이 많고, 음수(-)면 숏이 많습니다.',
    interpretation: '- **음수 (-) 유지**: **"숏 우세"**. 시장이 하락을 예상하고 베팅 중입니다. 오히려 숏 스퀴즈(급반등)가 일어날 수 있어 매수 관점에서 긍정적일 수 있습니다.\n- **0.01% (기본값)**: 평범한 상태입니다.\n- **0.05% 이상 지속**: **"롱 과열"**. 너도나도 빚내서 매수하고 있다는 뜻입니다. 롱 스퀴즈(급락) 위험이 큽니다.'
  }
};

const renderProgressBar = (name: string, valueStr: string | number) => {
  let value = 0;
  if (typeof valueStr === 'string') {
    if (name === 'Fear & Greed') {
      value = parseFloat(valueStr.split('/')[0]);
    } else if (name === '200 Week MA') {
      const diffStr = valueStr.replace(/[^0-9.-]/g, '');
      value = (parseFloat(diffStr) / 100) + 1;
    } else if (name === 'Funding Rate') {
      const diffStr = valueStr.replace(/[^0-9.-]/g, '');
      value = parseFloat(diffStr);
    } else {
      value = parseFloat(valueStr.replace(/[^0-9.-]/g, ''));
    }
  } else {
    value = valueStr as number;
  }

  if (isNaN(value)) return null;

  let min = 0, max = 100, safe = 0, danger = 100;

  switch (name) {
    case 'MVRV Z-Score':
      min = -0.5; max = 7.0; safe = 1.0; danger = 3.0;
      break;
    case 'Puell Multiple':
      min = 0.3; max = 4.0; safe = 1.0; danger = 2.5;
      break;
    case 'NUPL':
      min = -0.2; max = 0.8; safe = 0.25; danger = 0.6;
      break;
    case '200 Week MA':
      min = 0.5; max = 5.0; safe = 1.5; danger = 2.5;
      break;
    case 'Funding Rate':
      min = -0.05; max = 0.15; safe = 0.01; danger = 0.05;
      break;
    case 'Fear & Greed':
      min = 0; max = 100; safe = 40; danger = 75;
      break;
    default:
      return null;
  }

  let percent = ((value - min) / (max - min)) * 100;
  percent = Math.min(Math.max(percent, 0), 100);

  let colorClass = 'from-emerald-500 to-green-400 shadow-[0_0_8px_rgba(74,222,128,0.4)]';
  if (value >= danger) {
    colorClass = 'from-orange-500 to-red-500 shadow-[0_0_8px_rgba(239,68,68,0.4)]';
  } else if (value >= safe) {
    colorClass = 'from-yellow-500 to-orange-400';
  }

  return (
    <div className="w-full mt-1.5 opacity-80 group-hover:opacity-100 transition-opacity">
      <div className="w-full bg-slate-800/80 h-1.5 rounded-full overflow-hidden flex shadow-inner">
        <div
          className={`h-full rounded-full transition-all duration-1000 bg-gradient-to-r ${colorClass}`}
          style={{ width: `${percent}%` }}
        />
      </div>
      <div className="flex justify-between text-[9px] sm:text-[10px] text-slate-500 mt-1 font-bold px-0.5">
        <span className="text-green-500/80">매수 구간</span>
        <span className="text-red-500/80">매도 구간</span>
      </div>
    </div>
  );
};

export const IndicatorTable: React.FC<IndicatorTableProps> = ({ indicators }) => {
  const [expandedRow, setExpandedRow] = useState<number | null>(null);

  const toggleRow = (idx: number) => {
    if (expandedRow === idx) {
      setExpandedRow(null);
    } else {
      setExpandedRow(idx);
    }
  };

  return (
    <div className="overflow-hidden glass-panel rounded-2xl">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-slate-400 text-[10px] sm:text-xs tracking-wider border-b border-slate-800 bg-slate-900/40">
            <th className="p-3 sm:p-4 font-bold border-r border-slate-800/50">지표명 <span className="text-[10px] sm:text-[11px] font-normal text-slate-500 normal-case ml-1 hidden sm:inline">(클릭 시 가이드)</span></th>
            <th className="p-3 sm:p-4 font-bold hidden sm:table-cell text-right border-r border-slate-800/50">가중치</th>
            <th className="p-3 sm:p-4 font-bold whitespace-nowrap text-right border-r border-slate-800/50">값</th>
            <th className="p-3 sm:p-4 font-bold text-center hidden sm:table-cell border-r border-slate-800/50">개별점수(0~10)</th>
            <th className="p-3 sm:p-4 font-bold text-center hidden md:table-cell border-r border-slate-800/50">가중점수</th>
            <th className="p-3 sm:p-4 font-bold text-right">시그널</th>
          </tr>
        </thead>
        <tbody className="text-slate-200 divide-y divide-slate-800/50">
          {indicators.map((ind, idx) => (
            <React.Fragment key={idx}>
              <tr
                onClick={() => toggleRow(idx)}
                className={`cursor-pointer transition-all duration-200 ${expandedRow === idx ? 'bg-indigo-500/5 border-l-2 border-l-cyan-400' : 'hover:bg-white/5 border-l-2 border-l-transparent'}`}
              >
                <td className="p-2 sm:p-4 font-medium max-w-[130px] sm:max-w-none break-words">
                  <div className="flex items-center gap-1.5 sm:gap-3">
                    <div className={`p-1.5 sm:p-2 rounded-md transition-colors shrink-0 ${expandedRow === idx ? 'bg-cyan-500/20 text-cyan-400' : 'bg-slate-800 text-slate-400 group-hover:bg-slate-700'}`}>
                      {expandedRow === idx ? <ChevronUp className="w-3.5 h-3.5 sm:w-5 sm:h-5" /> : <ChevronDown className="w-3.5 h-3.5 sm:w-5 sm:h-5" />}
                    </div>
                    <span className={`font-bold tracking-wide text-[13px] sm:text-lg leading-tight ${expandedRow === idx ? 'text-cyan-400' : 'text-slate-200'}`}>{ind.name}</span>
                    {SOURCE_URLS[ind.name] && (
                      <a
                        href={SOURCE_URLS[ind.name]}
                        target="_blank"
                        rel="noopener noreferrer"
                        onClick={(e) => e.stopPropagation()}
                        className="text-slate-500 hover:text-cyan-400 transition-colors shrink-0 ml-0.5 sm:ml-1 p-0.5 sm:p-1 hover:bg-cyan-500/10 rounded"
                        title={`Verify ${ind.name} on external chart`}
                      >
                        <ExternalLink className="w-3 h-3 sm:w-3.5 sm:h-3.5" />
                      </a>
                    )}
                  </div>
                </td>
                <td className="p-2 sm:p-4 text-slate-400 hidden sm:table-cell text-right font-mono text-sm">{ind.weight}%</td>
                <td className="p-2 sm:p-4 whitespace-nowrap text-right">
                  <div className="flex flex-col items-end w-full">
                    <span className="font-mono text-cyan-400 text-sm sm:text-lg font-bold">{ind.currentValue}</span>
                    <div className="w-24 sm:w-32">
                      {renderProgressBar(ind.name, ind.currentValue)}
                    </div>
                  </div>
                </td>
                <td className="p-2 sm:p-4 text-center hidden sm:table-cell">
                  <span className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-xs font-bold border ${ind.score >= 7 ? 'bg-green-500/10 text-green-400 border-green-500/30 shadow-[0_0_10px_rgba(74,222,128,0.1)]' :
                    ind.score <= 3 ? 'bg-red-500/10 text-red-400 border-red-500/30 shadow-[0_0_10px_rgba(248,113,113,0.1)]' :
                      'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                    }`}>
                    {ind.score}
                  </span>
                </td>
                <td className="p-2 sm:p-4 text-center font-mono text-slate-400 hidden md:table-cell text-sm">{ind.weightedScore.toFixed(2)}</td>
                <td className="p-2 sm:p-4 text-right">
                  <span className={`inline-flex items-center text-[9px] sm:text-xs font-bold px-1.5 py-1 sm:px-3 sm:py-1.5 rounded sm:rounded-md uppercase tracking-wider border ${ind.signal === 'BUY' ? 'bg-green-500/10 text-green-400 border-green-500/30 shadow-none sm:shadow-[0_0_10px_rgba(74,222,128,0.1)]' :
                    ind.signal === 'SELL' ? 'bg-red-500/10 text-red-400 border-red-500/30 shadow-none sm:shadow-[0_0_10px_rgba(248,113,113,0.1)]' :
                      'bg-yellow-500/10 text-yellow-500 border-yellow-500/30'
                    }`}>
                    {ind.signal}
                  </span>
                </td>
              </tr>

              {/* Expanded Content */}
              {expandedRow === idx && INDICATOR_DETAILS[ind.name] && (
                <tr className="bg-indigo-950/20">
                  <td colSpan={6} className="p-0 border-b border-indigo-500/20 max-w-[100vw] sm:max-w-none">
                    <div className="p-4 sm:p-8 animate-fadeIn w-full overflow-hidden">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 sm:gap-8">
                        <div className="space-y-4">
                          <h4 className="flex items-center gap-2 text-sm font-bold text-indigo-400 uppercase tracking-widest border-b border-indigo-500/20 pb-2">
                            <Info className="w-4 h-4 shrink-0" />
                            지표 설명 (What is it?)
                          </h4>
                          <div className="prose prose-invert prose-sm text-slate-300 leading-relaxed break-keep break-words whitespace-normal w-full max-w-none">
                            <ReactMarkdown
                              components={{
                                strong: ({ node, ...props }) => <strong className="font-bold text-indigo-300" {...props} />,
                                p: ({ node, ...props }) => <p className="mb-2" {...props} />
                              }}
                            >{INDICATOR_DETAILS[ind.name].meaning}</ReactMarkdown>
                          </div>
                        </div>
                        <div className="space-y-4">
                          <h4 className="flex items-center gap-2 text-sm font-bold text-cyan-400 uppercase tracking-widest border-b border-cyan-500/20 pb-2">
                            시그널 해석 (How to Interpret)
                          </h4>
                          <div className="prose prose-invert prose-sm text-slate-300 bg-slate-900/60 p-4 sm:p-5 rounded-xl border border-white/5 shadow-inner break-keep break-words whitespace-normal w-full max-w-none">
                            <ReactMarkdown
                              components={{
                                strong: ({ node, ...props }) => <strong className="font-bold text-cyan-300" {...props} />,
                                li: ({ node, ...props }) => <li className="mb-2 last:mb-0" {...props} />
                              }}
                            >{INDICATOR_DETAILS[ind.name].interpretation}</ReactMarkdown>
                          </div>
                        </div>
                      </div>
                    </div>
                  </td>
                </tr>
              )}
            </React.Fragment>
          ))}
        </tbody>
      </table>
    </div>
  );
};
