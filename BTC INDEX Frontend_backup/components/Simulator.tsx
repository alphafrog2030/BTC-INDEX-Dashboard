import React, { useState, useEffect } from 'react';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

interface SimulatorProps {
  btcPriceUsd: number;
}

export const Simulator: React.FC<SimulatorProps> = ({ btcPriceUsd }) => {
  const [totalCapitalKRW, setTotalCapitalKRW] = useState<number>(1000000000); // 1 Billion KRW
  const [exchangeRate, setExchangeRate] = useState<number>(1300);
  const [tiers, setTiers] = useState([
    { price: btcPriceUsd * 0.95, percent: 15 },
    { price: btcPriceUsd * 0.90, percent: 25 },
    { price: btcPriceUsd * 0.85, percent: 30 },
  ]);

  const btcPriceKrw = btcPriceUsd * exchangeRate;

  // Format KRW helper
  const formatKRW = (num: number) => {
    return new Intl.NumberFormat('ko-KR', { style: 'currency', currency: 'KRW', maximumFractionDigits: 0 }).format(num);
  };

  const calculateTotalBtcAccumulated = () => {
    let totalBtc = 0;
    tiers.forEach(tier => {
      const amountKRW = totalCapitalKRW * (tier.percent / 100);
      const tierPriceKRW = tier.price * exchangeRate;
      totalBtc += amountKRW / tierPriceKRW;
    });
    return totalBtc;
  };

  const projectedBtc = calculateTotalBtcAccumulated();
  const breakEvenPriceKrw = (totalCapitalKRW * (tiers.reduce((acc, t) => acc + t.percent, 0) / 100)) / projectedBtc;

  // Chart Data: Profit vs Price
  const chartData = [];
  for (let i = 0.5; i <= 3.0; i += 0.5) {
      const targetPrice = breakEvenPriceKrw * i;
      const profit = (targetPrice * projectedBtc) - (totalCapitalKRW * (tiers.reduce((acc, t) => acc + t.percent, 0) / 100));
      chartData.push({
          multiple: `${i}x`,
          price: targetPrice,
          profit: profit
      });
  }

  return (
    <div className="bg-slate-800 rounded-xl shadow-lg border border-slate-700 p-6 space-y-6">
      <div className="flex justify-between items-center border-b border-slate-700 pb-4">
        <h2 className="text-xl font-bold text-white">Investment Simulator (KRW)</h2>
        <div className="text-sm text-slate-400">Assumed USD/KRW: {exchangeRate}</div>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Controls */}
        <div className="space-y-4">
           <div>
            <label className="block text-slate-400 text-sm mb-1">Total Capital (KRW)</label>
            <input 
                type="number" 
                value={totalCapitalKRW}
                onChange={(e) => setTotalCapitalKRW(Number(e.target.value))}
                className="w-full bg-slate-900 border border-slate-600 rounded p-2 text-white font-mono focus:border-cyan-500 outline-none"
            />
           </div>
           
           <div className="space-y-2">
            <h3 className="text-sm font-semibold text-slate-300">DCA Tiers (Below Current Price)</h3>
            {tiers.map((tier, idx) => (
                <div key={idx} className="flex gap-2 items-center">
                    <span className="text-slate-500 w-4">{idx + 1}.</span>
                    <div className="flex-1">
                        <label className="text-xs text-slate-500">Entry Price ($)</label>
                        <input 
                            type="number" 
                            value={Math.round(tier.price)}
                            onChange={(e) => {
                                const newTiers = [...tiers];
                                newTiers[idx].price = Number(e.target.value);
                                setTiers(newTiers);
                            }}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-sm text-white"
                        />
                    </div>
                    <div className="w-20">
                         <label className="text-xs text-slate-500">Alloc (%)</label>
                         <input 
                            type="number" 
                            value={tier.percent}
                            onChange={(e) => {
                                const newTiers = [...tiers];
                                newTiers[idx].percent = Number(e.target.value);
                                setTiers(newTiers);
                            }}
                            className="w-full bg-slate-900 border border-slate-600 rounded p-1 text-sm text-white"
                        />
                    </div>
                </div>
            ))}
           </div>
        </div>

        {/* Results */}
        <div className="bg-slate-900 rounded p-4 space-y-4">
            <div className="flex justify-between">
                <span className="text-slate-400">Total Deployment:</span>
                <span className="text-white font-mono">{formatKRW(totalCapitalKRW * (tiers.reduce((acc, t) => acc + t.percent, 0) / 100))}</span>
            </div>
            <div className="flex justify-between">
                <span className="text-slate-400">Projected BTC:</span>
                <span className="text-orange-400 font-mono font-bold">{projectedBtc.toFixed(4)} BTC</span>
            </div>
             <div className="flex justify-between border-t border-slate-700 pt-2">
                <span className="text-slate-400">Avg. Entry (KRW):</span>
                <span className="text-cyan-400 font-mono">{formatKRW(breakEvenPriceKrw)}</span>
            </div>
            
            <div className="h-40 w-full mt-4">
                 <ResponsiveContainer width="100%" height="100%">
                    <AreaChart data={chartData}>
                    <defs>
                        <linearGradient id="colorProfit" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#10b981" stopOpacity={0.8}/>
                        <stop offset="95%" stopColor="#10b981" stopOpacity={0}/>
                        </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                    <XAxis dataKey="multiple" tick={{fontSize: 10, fill: '#94a3b8'}} />
                    <YAxis hide />
                    <Tooltip 
                        contentStyle={{backgroundColor: '#1e293b', borderColor: '#334155', color: '#fff'}}
                        formatter={(value: number) => formatKRW(value)}
                    />
                    <Area type="monotone" dataKey="profit" stroke="#10b981" fillOpacity={1} fill="url(#colorProfit)" />
                    </AreaChart>
                </ResponsiveContainer>
            </div>
        </div>
      </div>
    </div>
  );
};