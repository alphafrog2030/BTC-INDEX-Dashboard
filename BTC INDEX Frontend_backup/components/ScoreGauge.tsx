import React from 'react';

interface ScoreGaugeProps {
  score: number;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score }) => {
  // Calculate color based on score
  let colorClass = "text-yellow-500";
  let label = "HOLD / NEUTRAL";
  
  if (score >= 70) {
    colorClass = "text-green-500";
    label = "STRONG BUY";
  } else if (score < 30) {
    colorClass = "text-red-500";
    label = "SELL / TAKE PROFIT";
  } else if (score < 50) {
    colorClass = "text-orange-400";
    label = "WAIT / CAUTION";
  }

  // Increased radius to 80 (was 60) to push the ring outward and prevent text overlap
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-6 bg-slate-800 rounded-xl shadow-lg border border-slate-700">
      {/* Container with viewBox ensures SVG scales correctly */}
      <div className="relative w-52 h-52">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 192 192">
          {/* Background Track */}
          <circle
            cx="96"
            cy="96"
            r={radius}
            stroke="currentColor"
            strokeWidth="10"
            fill="transparent"
            className="text-slate-700/40"
          />
          {/* Value Progress */}
          <circle
            cx="96"
            cy="96"
            r={radius}
            stroke="currentColor"
            strokeWidth="10"
            fill="transparent"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            strokeLinecap="round"
            className={`${colorClass} transition-all duration-1000 ease-out`}
          />
        </svg>
        <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center text-white">
          <span className="text-5xl font-bold tracking-tighter leading-none">{score.toFixed(1)}</span>
          <span className="text-xs text-slate-400 uppercase tracking-widest mt-2 font-medium">Total Score</span>
        </div>
      </div>
      <div className={`mt-4 text-lg font-bold ${colorClass} tracking-wide border px-4 py-1.5 rounded-full border-current bg-opacity-10 bg-current`}>
        {label}
      </div>
    </div>
  );
};