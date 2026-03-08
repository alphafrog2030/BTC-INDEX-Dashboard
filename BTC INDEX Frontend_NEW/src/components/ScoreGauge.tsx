import React from 'react';

interface ScoreGaugeProps {
  score: number;
}

export const ScoreGauge: React.FC<ScoreGaugeProps> = ({ score }) => {
  let ringColorClass = "text-yellow-500";
  let panelBorderClass = "border-yellow-500/30";
  let panelBgClass = "bg-yellow-500/10";
  let textClass = "text-yellow-400";
  let label = "중립 / 관망";
  let description = "현재 시장은 방향성을 탐색 중입니다. 추가적인 데이터 확인이 필요하며 보수적인 접근이 권장됩니다.";

  if (score >= 90) {
    ringColorClass = "text-green-500";
    panelBorderClass = "border-green-500/30";
    panelBgClass = "bg-green-500/10";
    textClass = "text-green-400";
    label = "강력 매수";
    description = "시장이 극도로 저평가된 항복(Capitulation) 구간입니다. 가용 버퍼를 동원한 적극적인 풀매수가 요구됩니다.";
  } else if (score >= 70) {
    ringColorClass = "text-green-400";
    panelBorderClass = "border-green-400/30";
    panelBgClass = "bg-green-400/10";
    textClass = "text-green-300";
    label = "분할 매수 매력";
    description = "현재 시장은 저평가 구간에 위치해 있으며, 장기적인 관점에서 적극적인 분할 매수(Accumulation)가 유리한 시기입니다.";
  } else if (score < 30) {
    ringColorClass = "text-red-500";
    panelBorderClass = "border-red-500/30";
    panelBgClass = "bg-red-500/10";
    textClass = "text-red-400";
    label = "강력 매도";
    description = "시장이 탐욕의 끝자락(Euphoria)에 도달했습니다. 언제 거품이 꺼져도 이상하지 않으므로 전면적인 현금화가 시급합니다.";
  } else if (score < 50) {
    ringColorClass = "text-orange-500";
    panelBorderClass = "border-orange-500/30";
    panelBgClass = "bg-orange-500/10";
    textClass = "text-orange-400";
    label = "리스크 관리";
    description = "시장이 과열 징후를 보이고 있습니다. 신규 진입을 자제하고 보유 물량의 분할 매도를 통한 수익 실현을 시작하십시오.";
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
        <svg className="w-full h-full transform -rotate-90 overflow-visible" viewBox="0 0 192 192" style={{ '--target-offset': offset } as React.CSSProperties}>
          <defs>
            <filter id="neonGlow" x="-20%" y="-20%" width="140%" height="140%">
              <feGaussianBlur stdDeviation="6" result="coloredBlur" />
              <feMerge>
                <feMergeNode in="coloredBlur" />
                <feMergeNode in="SourceGraphic" />
              </feMerge>
            </filter>
          </defs>
          {/* Background Track */}
          <circle
            cx="96"
            cy="96"
            r={radius}
            stroke="rgba(30, 41, 59, 0.5)"
            strokeWidth="10"
            fill="transparent"
          />
          {/* Value Progress with Cross-browser SVG Glow effect */}
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
            style={{ filter: `url(#neonGlow)` }}
          />
        </svg>
        <div className="absolute top-0 left-0 w-full h-full flex flex-col items-center justify-center text-white">
          <span className="text-6xl font-bold tracking-tighter leading-none outfit-font drop-shadow-lg" style={{ color: "white" }}>
            {score.toFixed(1)}
          </span>
          <span className="text-[10px] text-slate-400 uppercase tracking-[0.2em] mt-2 font-semibold">Total Score</span>
        </div>
      </div>
      {/* Details Panel representing Action Status instead of a pill badge */}
      <div className={`mt-6 w-full text-center p-4 rounded-xl border ${panelBorderClass} ${panelBgClass} transition-all duration-500 backdrop-blur-sm shadow-inner relative overflow-hidden group`}>
        <div className="absolute inset-0 bg-white/5 opacity-0 group-hover:opacity-100 transition-opacity duration-300 pointer-events-none"></div>
        <h4 className={`text-sm font-black uppercase tracking-widest mb-2 ${textClass}`}>{label}</h4>
        <p className="text-xs text-slate-300 leading-relaxed break-keep font-medium opacity-90">
          {description}
        </p>
      </div>
    </div>
  );
};
