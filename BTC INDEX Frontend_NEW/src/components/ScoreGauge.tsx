import React from 'react';

interface ScoreGaugeProps {
  score: number;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score }) => {
  // Calculate color based on score
  let ringColorClass = "text-yellow-500";
  let badgeClass = "bg-yellow-500 text-slate-900";
  let label = "중립 / 관망";

  if (score >= 90) {
    ringColorClass = "text-green-500";
    badgeClass = "bg-green-600 text-white";
    label = "강력 매수";
  } else if (score >= 70) {
    ringColorClass = "text-green-400";
    badgeClass = "bg-green-500 text-white";
    label = "분할 매수 매력";
  } else if (score < 30) {
    ringColorClass = "text-red-500";
    badgeClass = "bg-red-600 text-white";
    label = "강력 매도";
  } else if (score < 50) {
    ringColorClass = "text-orange-500";
    badgeClass = "bg-orange-500 text-white";
    label = "리스크 관리";
  }

  // Increased radius to 80 (was 60) to push the ring outward and prevent text overlap
  const radius = 80;
  const circumference = 2 * Math.PI * radius;
  const progress = Math.min(Math.max(score, 0), 100);
  const offset = circumference - (progress / 100) * circumference;

  return (
    <div className="flex flex-col items-center justify-center p-6 glass-panel rounded-2xl relative overflow-hidden group">
      {/* Background glow behind gauge */}
      <div className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-32 h-32 rounded-full blur-[80px] opacity-20 ${ringColorClass.replace('text-', 'bg-')} pointer-events-none`}></div>

      {/* Container with viewBox ensures SVG scales correctly */}
      <div className="relative w-56 h-56 transition-transform duration-500 group-hover:scale-105">
        <svg className="w-full h-full transform -rotate-90" viewBox="0 0 192 192" style={{ '--target-offset': offset } as React.CSSProperties}>
          {/* Background Track */}
          <circle
            cx="96"
            cy="96"
            r={radius}
            stroke="rgba(30, 41, 59, 0.5)"
            strokeWidth="10"
            fill="transparent"
          />
          {/* Value Progress with Glow effect */}
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
            className={`${ringColorClass} transition-all duration-[1500ms] ease-out animate-draw`}
            style={{ filter: `drop-shadow(0 0 8px currentColor)` }}
          />
        </svg>
        <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center text-white">
          <span className="text-6xl font-bold tracking-tighter leading-none outfit-font drop-shadow-lg" style={{ color: "white" }}>
            {score.toFixed(1)}
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mt-2 font-semibold">Total Score</span>
        </div>
      </div>
      <div className={`mt-4 text-base font-bold tracking-widest px-8 py-2 rounded-full shadow-xl transition-all ${badgeClass} border border-white/10 relative overflow-hidden`}>
        <div className="absolute inset-0 bg-white/20 opacity-0 hover:opacity-100 transition-opacity"></div>
        {label}
      </div>
    </div>
  );
};
