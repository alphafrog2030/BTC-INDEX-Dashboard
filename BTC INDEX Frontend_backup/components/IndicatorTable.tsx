import React from 'react';
import { Indicator } from '../types';
import { ExternalLink, HelpCircle } from 'lucide-react';

interface IndicatorTableProps {
  indicators: Indicator[];
}

// Map indicators to reliable external chart URLs for user verification
const SOURCE_URLS: Record<string, string> = {
  'MVRV Z-Score': 'https://en.macromicro.me/series/8365/bitcoin-mvrv-zscore',
  'Puell Multiple': 'https://en.macromicro.me/series/8112/bitcoin-puell-multiple',
  'NUPL': 'https://en.macromicro.me/series/45910/bitcoin-nupl',
  '200 Week MA': 'https://www.lookintobitcoin.com/charts/200-week-moving-average-heatmap/', // Fallback as no specific MacroMicro link provided
  'Reserve Risk': 'https://www.lookintobitcoin.com/charts/reserve-risk/', // Fallback as no specific MacroMicro link provided
  'SOPR': 'https://en.macromicro.me/series/35106/bitcoin-sopr',
  'Funding Rate': 'https://en.macromicro.me/series/21739/bitcoin-perpetual-futures-funding-rate',
};

export const IndicatorTable: React.FC<IndicatorTableProps> = ({ indicators }) => {
  return (
    <div className="overflow-x-auto bg-slate-800 rounded-xl shadow-lg border border-slate-700">
      <table className="w-full text-left border-collapse">
        <thead>
          <tr className="text-slate-400 text-sm uppercase border-b border-slate-700">
            <th className="p-4 font-semibold">Indicator (Verify)</th>
            <th className="p-4 font-semibold">Weight</th>
            <th className="p-4 font-semibold">Current Value</th>
            <th className="p-4 font-semibold text-center">Raw Score (0-10)</th>
            <th className="p-4 font-semibold text-center">W. Score</th>
            <th className="p-4 font-semibold text-right">Signal</th>
          </tr>
        </thead>
        <tbody className="text-slate-200 divide-y divide-slate-700">
          {indicators.map((ind, idx) => (
            <tr key={idx} className="hover:bg-slate-700/50 transition-colors">
              <td className="p-4 font-medium flex items-center gap-2">
                {ind.name}
                {SOURCE_URLS[ind.name] && (
                  <a 
                    href={SOURCE_URLS[ind.name]} 
                    target="_blank" 
                    rel="noopener noreferrer"
                    className="text-slate-500 hover:text-cyan-400 transition-colors"
                    title={`Verify ${ind.name} on external chart`}
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                  </a>
                )}
              </td>
              <td className="p-4 text-slate-400">{ind.weight}%</td>
              <td className="p-4 font-mono text-cyan-400">{ind.currentValue}</td>
              <td className="p-4 text-center">
                <span className={`inline-block w-8 py-1 rounded ${
                  ind.score >= 7 ? 'bg-green-900 text-green-300' : 
                  ind.score <= 3 ? 'bg-red-900 text-red-300' : 
                  'bg-yellow-900 text-yellow-300'
                }`}>
                  {ind.score}
                </span>
              </td>
              <td className="p-4 text-center font-mono">{ind.weightedScore.toFixed(2)}</td>
              <td className="p-4 text-right">
                <span className={`text-xs font-bold px-2 py-1 rounded-full ${
                   ind.signal === 'BUY' ? 'bg-green-500/20 text-green-400' :
                   ind.signal === 'SELL' ? 'bg-red-500/20 text-red-400' :
                   'bg-yellow-500/20 text-yellow-400'
                }`}>
                  {ind.signal}
                </span>
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};