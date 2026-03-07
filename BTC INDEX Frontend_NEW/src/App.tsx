import React, { useState, useEffect } from 'react';
import { fetchMarketData } from './services/marketService'; // Changed from geminiService
import { ReportData, ViewMode } from './types';
import { ScoreGauge } from './components/ScoreGauge';
import { IndicatorTable } from './components/IndicatorTable';
import { Simulator } from './components/Simulator';
import {
  LineChart,
  Wallet,
  FileText,
  RefreshCw,
  TrendingUp,
  AlertTriangle,
  ExternalLink,
  Info
} from 'lucide-react';
import ReactMarkdown from 'react-markdown';

// Mock initial data to show structure before first load
const MOCK_DATA: ReportData = {
  timestamp: "Click Update to fetch real data",
  btcPrice: 0,
  totalScore: 0,
  interpretation: "분석 대기중...",
  indicators: [
    { name: 'MVRV Z-Score', weight: 27.5, currentValue: '-', score: 0, weightedScore: 0, signal: 'NEUTRAL' },
    { name: 'Puell Multiple', weight: 17.5, currentValue: '-', score: 0, weightedScore: 0, signal: 'NEUTRAL' },
    { name: 'NUPL', weight: 17.5, currentValue: '-', score: 0, weightedScore: 0, signal: 'NEUTRAL' },
    { name: '200 Week MA', weight: 17.5, currentValue: '-', score: 0, weightedScore: 0, signal: 'NEUTRAL' },
    { name: 'Reserve Risk', weight: 12.5, currentValue: '-', score: 0, weightedScore: 0, signal: 'NEUTRAL' },
    { name: 'SOPR', weight: 10, currentValue: '-', score: 0, weightedScore: 0, signal: 'NEUTRAL' },
    { name: 'Funding Rate', weight: 5, currentValue: '-', score: 0, weightedScore: 0, signal: 'NEUTRAL' },
  ],
  strategyText: "데이터 업데이트가 필요합니다.",
  risksAndAdvice: "",
  sources: []
};

export default function App() {
  const [report, setReport] = useState<ReportData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [view, setView] = useState<ViewMode>(ViewMode.DASHBOARD);
  const [lastUpdated, setLastUpdated] = useState<Date | null>(null);
  const [scrollPositions, setScrollPositions] = useState<Record<ViewMode, number>>({
    [ViewMode.DASHBOARD]: 0,
    [ViewMode.REPORT]: 0,
    [ViewMode.SIMULATION]: 0,
  });

  const handleTabChange = (newView: ViewMode) => {
    if (view === newView) return;
    setScrollPositions(prev => ({ ...prev, [view]: window.scrollY }));
    setView(newView);
  };

  useEffect(() => {
    // Need a tiny timeout to ensure React finishes DOM rendering before scrolling
    setTimeout(() => {
      window.scrollTo({ top: scrollPositions[view], behavior: 'instant' });
    }, 0);
  }, [view]);

  const fetchReport = async () => {
    setLoading(true);
    setError(null);
    try {
      // Use the new scraper service
      const data = await fetchMarketData();
      setReport(data);
      setLastUpdated(new Date());
    } catch (err: any) {
      console.error(err);
      setError("데이터를 불러오는데 실패했습니다. 잠시 후 다시 시도해주세요.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchReport();
  }, []);

  const renderContent = () => {
    const currentReport = report || MOCK_DATA;

    if (view === ViewMode.SIMULATION) {
      return (
        <div className="max-w-4xl mx-auto animate-fadeIn">
          <Simulator
            btcPriceUsd={currentReport.btcPrice || 60000}
            currentIndicators={{
              z: currentReport.indicators.find(i => i.name === 'MVRV Z-Score')?.currentValue !== '-' ? Number(currentReport.indicators.find(i => i.name === 'MVRV Z-Score')?.currentValue) : 1.8,
              ma: 1.2, // Default fallback
              s: 0.1 // Default fallback
            }}
          />
        </div>
      );
    }

    if (view === ViewMode.REPORT) {
      // Logic for Top Score Card colors
      let ringColorClass = "text-yellow-500 shadow-yellow-500/20";
      let badgeClass = "bg-yellow-500/10 text-yellow-500 border-yellow-500/20";
      let cardLabel = "중립 / 관망";

      if (currentReport.totalScore >= 90) {
        ringColorClass = "text-green-500 shadow-green-500/20";
        badgeClass = "bg-green-500/10 text-green-400 border-green-500/20";
        cardLabel = "강력 매수";
      } else if (currentReport.totalScore >= 70) {
        ringColorClass = "text-green-400 shadow-green-400/20";
        badgeClass = "bg-green-400/10 text-green-300 border-green-400/20";
        cardLabel = "분할 매수 매력";
      } else if (currentReport.totalScore < 30) {
        ringColorClass = "text-red-500 shadow-red-500/20";
        badgeClass = "bg-red-500/10 text-red-400 border-red-500/20";
        cardLabel = "강력 매도";
      } else if (currentReport.totalScore < 50) {
        ringColorClass = "text-orange-500 shadow-orange-500/20";
        badgeClass = "bg-orange-500/10 text-orange-400 border-orange-500/20";
        cardLabel = "리스크 관리";
      }

      return (
        <div className="max-w-4xl mx-auto animate-fadeIn space-y-8">

          {/* Infographic Top Score Card */}
          <div className="flex flex-col md:flex-row items-center justify-between p-6 sm:p-8 bg-slate-800/80 glass-panel rounded-2xl border border-slate-700/80 relative overflow-hidden group shadow-2xl">
            <div className={`absolute top-0 right-0 w-64 h-64 bg-current opacity-10 blur-[80px] pointer-events-none transition-transform duration-1000 group-hover:scale-150 ${ringColorClass.split(' ')[0]}`} />

            <div className="space-y-2 z-10 w-full md:w-auto text-center md:text-left mb-6 md:mb-0">
              <h2 className="text-slate-400 text-xs sm:text-sm font-bold uppercase tracking-widest mb-4">현재 시장 종합 진단</h2>
              <div className="flex flex-col sm:flex-row items-center justify-center md:justify-start gap-4">
                <span className={`text-6xl sm:text-7xl font-bold outfit-font drop-shadow-lg ${ringColorClass.split(' ')[0]}`}>
                  {currentReport.totalScore.toFixed(0)}
                </span>
                <span className={`px-4 py-2 rounded-full text-sm sm:text-base font-bold tracking-wide border shadow-lg ${badgeClass}`}>
                  {cardLabel}
                </span>
              </div>
              <p className="text-slate-500 text-[10px] uppercase font-mono mt-4 tracking-widest">Data Updated: {currentReport.timestamp}</p>
            </div>

            <div className="z-10 bg-slate-900/60 p-5 sm:p-6 rounded-xl border border-slate-700 w-full md:w-[45%] shadow-inner backdrop-blur-md">
              <h4 className="text-cyan-400 text-[11px] font-bold uppercase tracking-widest mb-2 flex items-center gap-1.5 border-b border-cyan-500/20 pb-2">
                <Info className="w-3.5 h-3.5" /> AI Interpretation
              </h4>
              <p className="text-sm font-medium text-slate-300 leading-relaxed break-keep">
                {currentReport.interpretation}
              </p>
            </div>
          </div>

          {/* 1. Strategy Card */}
          <div className="bg-slate-800/40 p-4 sm:p-8 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm">
            <div className="prose prose-invert prose-cyan max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 mb-8 mt-4 pb-4 border-b border-slate-700/50 tracking-tight flex items-center gap-3" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-white mb-6 mt-10 flex items-center gap-2" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-sm font-bold bg-slate-900/60 inline-flex items-center px-4 py-2 rounded-lg text-cyan-300 mb-4 mt-8 border border-white/5 shadow-inner" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-4 text-sm sm:text-base leading-relaxed text-slate-300 break-keep" {...props} />,
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-cyan-400 bg-gradient-to-r from-cyan-500/10 to-transparent p-4 sm:p-5 rounded-r-xl my-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" {...props} />
                  ),
                  ul: ({ node, ...props }) => <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 mb-6" {...props} />,
                  li: ({ node, ...props }) => (
                    <li className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 text-sm text-slate-300 shadow-lg hover:bg-slate-800/50 hover:border-cyan-500/30 transition-all block break-keep leading-relaxed" {...props} />
                  ),
                  strong: ({ node, ...props }) => <strong className="font-bold text-cyan-300" {...props} />,
                  code: ({ node, className, children, ...props }: any) => <span className="text-base font-bold text-cyan-400 block mb-2 tracking-wide" {...props}>{children}</span>,
                }}
              >
                {currentReport.strategyText}
              </ReactMarkdown>
            </div>
          </div>

          {/* 2. Insights Card */}
          <div className="bg-slate-800/40 p-4 sm:p-8 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm">
            <div className="prose prose-invert prose-indigo max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-indigo-400 to-purple-400 mb-8 mt-4 pb-4 border-b border-slate-700/50 tracking-tight flex items-center gap-3" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-white mb-6 mt-10 flex items-center gap-2" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-sm font-bold bg-slate-900/60 inline-flex items-center px-4 py-2 rounded-lg text-indigo-300 mb-4 mt-8 border border-white/5 shadow-inner" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-4 text-sm sm:text-base leading-relaxed text-slate-300 break-keep" {...props} />,
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-indigo-400 bg-gradient-to-r from-indigo-500/10 to-transparent p-4 sm:p-5 rounded-r-xl my-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" {...props} />
                  ),
                  ul: ({ node, ...props }) => <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 mb-6" {...props} />,
                  li: ({ node, ...props }) => (
                    <li className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 text-sm text-slate-300 shadow-lg hover:bg-slate-800/50 hover:border-indigo-500/30 transition-all block break-keep leading-relaxed" {...props} />
                  ),
                  strong: ({ node, ...props }) => <strong className="font-bold text-indigo-300" {...props} />,
                  code: ({ node, className, children, ...props }: any) => <span className="text-base font-bold text-cyan-400 block mb-2 tracking-wide" {...props}>{children}</span>,
                }}
              >
                {currentReport.risksAndAdvice}
              </ReactMarkdown>
            </div>
          </div>

          {/* 3. Breakdown Card */}
          <div className="bg-slate-800/40 p-4 sm:p-8 rounded-2xl border border-slate-800 shadow-xl backdrop-blur-sm">
            <div className="prose prose-invert prose-teal max-w-none">
              <ReactMarkdown
                components={{
                  h1: ({ node, ...props }) => <h1 className="text-xl sm:text-2xl font-black text-transparent bg-clip-text bg-gradient-to-r from-teal-400 to-emerald-400 mb-8 mt-4 pb-4 border-b border-slate-700/50 tracking-tight flex items-center gap-3" {...props} />,
                  h2: ({ node, ...props }) => <h2 className="text-lg font-bold text-white mb-6 mt-10 flex items-center gap-2" {...props} />,
                  h3: ({ node, ...props }) => <h3 className="text-sm font-bold bg-slate-900/60 inline-flex items-center px-4 py-2 rounded-lg text-teal-300 mb-4 mt-8 border border-white/5 shadow-inner" {...props} />,
                  p: ({ node, ...props }) => <p className="mb-4 text-sm sm:text-base leading-relaxed text-slate-300 break-keep" {...props} />,
                  blockquote: ({ node, ...props }) => (
                    <blockquote className="border-l-4 border-teal-400 bg-gradient-to-r from-teal-500/10 to-transparent p-4 sm:p-5 rounded-r-xl my-4 shadow-[inset_0_1px_1px_rgba(255,255,255,0.05)]" {...props} />
                  ),
                  ul: ({ node, ...props }) => <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-2 mb-6" {...props} />,
                  li: ({ node, ...props }) => (
                    <li className="bg-slate-900/40 p-4 rounded-xl border border-slate-700/50 text-sm text-slate-300 shadow-lg hover:bg-slate-800/50 hover:border-teal-500/30 transition-all block break-keep leading-relaxed" {...props} />
                  ),
                  strong: ({ node, ...props }) => <strong className="font-bold text-teal-300" {...props} />,
                  code: ({ node, className, children, ...props }: any) => <span className="text-base font-bold text-cyan-400 block mb-2 tracking-wide" {...props}>{children}</span>,
                }}
              >
                {currentReport.breakdownText || ""}
              </ReactMarkdown>
            </div>
          </div>
        </div>
      );
    }

    // Default Dashboard View
    return (
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 animate-fadeIn">
        {/* Left Column: Score & Summary */}
        <div className="lg:col-span-1 space-y-6">
          {/* Current Status Block (Moved Up) */}
          <div className="bg-slate-800 p-4 rounded-xl border border-slate-700">
            <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider mb-2">Current Status</h3>
            <div className="text-2xl font-bold text-white mb-1">
              {currentReport.btcPrice ? `$${currentReport.btcPrice.toLocaleString()}` : "Price: N/A"}
            </div>
            <div className="flex items-center justify-between mt-1">
              <div className="text-sm text-slate-500">
                {currentReport.timestamp}
              </div>
              <button
                onClick={fetchReport}
                disabled={loading}
                className="text-slate-500 hover:text-cyan-400 transition-colors p-1 rounded-md hover:bg-slate-700/50"
                title="Update Data"
              >
                <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin' : ''}`} />
              </button>
            </div>
          </div>

          {/* Score Gauge */}
          <ScoreGauge score={currentReport.totalScore} />

          {/* Scoring Guide (Replaced Key Weights) */}
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <div className="flex items-center gap-2 text-cyan-400 mb-4">
              <Info className="w-5 h-5" />
              <span className="font-bold">Scoring Guide (매매 기준)</span>
            </div>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between">
                <span className="text-slate-400">90점 이상</span>
                <span className="text-green-400 font-bold bg-green-900/30 px-2 py-0.5 rounded">강력 매수</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">70점 ~ 90점</span>
                <span className="text-green-300 font-medium bg-green-900/20 px-2 py-0.5 rounded">분할 매수 매력</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">50점 ~ 70점</span>
                <span className="text-yellow-400 font-medium bg-yellow-900/20 px-2 py-0.5 rounded">중립 / 관망</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">30점 ~ 50점</span>
                <span className="text-orange-400 font-medium bg-orange-900/20 px-2 py-0.5 rounded">리스크 관리</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-slate-400">30점 이하</span>
                <span className="text-red-400 font-bold bg-red-900/30 px-2 py-0.5 rounded">강력 매도</span>
              </div>
            </div>
          </div>
        </div>

        {/* Right Column: Indicators Table */}
        <div className="lg:col-span-2 space-y-6">
          <div className="bg-slate-800 rounded-xl border border-slate-700 overflow-hidden">
            <div className="p-4 border-b border-slate-700 bg-slate-800/50 flex justify-between items-center">
              <h2 className="font-bold text-white flex items-center gap-2">
                <TrendingUp className="w-5 h-5 text-cyan-400" />
                Live Indicator Analysis
              </h2>
              {lastUpdated && <span className="text-xs text-green-400">Live</span>}
            </div>
            <IndicatorTable indicators={currentReport.indicators} />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
              <h4 className="text-slate-400 text-sm font-bold mb-2">Buy Zones</h4>
              <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
                <li>MVRV Z-Score ≤ 0.1</li>
                <li>Puell Multiple ≤ 0.5</li>
                <li>NUPL &lt; 0</li>
                <li>Price touch 200WMA</li>
              </ul>
            </div>
            <div className="bg-slate-800 p-5 rounded-xl border border-slate-700">
              <h4 className="text-slate-400 text-sm font-bold mb-2">Sell Zones</h4>
              <ul className="text-sm text-slate-300 space-y-1 list-disc list-inside">
                <li>Total Score &lt; 30</li>
                <li>MVRV Z-Score &gt; 7</li>
                <li>NUPL &gt; 0.75</li>
                <li>Greed Extreme</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500 selection:text-white relative overflow-hidden">
      {/* Background ambient light effects */}
      <div className="absolute top-0 -left-1/4 w-1/2 h-1/2 bg-indigo-500/10 rounded-full blur-[120px] pointer-events-none"></div>
      <div className="absolute bottom-0 -right-1/4 w-1/2 h-1/2 bg-cyan-500/10 rounded-full blur-[120px] pointer-events-none"></div>

      {/* Header */}
      <header className="sticky top-0 z-50 glass-panel border-b border-white/5">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-20 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative group cursor-pointer">
              <div className="absolute inset-0 bg-cyan-400 blur-md opacity-20 group-hover:opacity-40 transition-opacity rounded-xl"></div>
              <div className="relative bg-gradient-to-br from-cyan-400 to-indigo-500 p-2.5 rounded-xl shadow-lg border border-white/10 group-hover:scale-105 transition-transform duration-300">
                <LineChart className="w-6 h-6 text-white group-hover:animate-float" />
              </div>
            </div>
            <div>
              <h1 className="text-2xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-white to-slate-400 outfit-font tracking-tight">
                Bitcoin Index Dashboard
              </h1>
              <p className="text-xs text-cyan-400/80 font-medium tracking-wider uppercase mt-0.5 flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-cyan-400 animate-pulse"></span>
                Onchain Dashboard
              </p>
            </div>
          </div>

          <div className="flex items-center gap-4">
            {/* Action buttons could go here */}
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8 pb-24 md:pb-12 relative z-10">

        {/* Desktop Navigation Tabs (Hidden on Mobile) */}
        <div className="hidden md:flex gap-2 mb-10 p-1.5 bg-slate-900/50 backdrop-blur-md border border-white/5 rounded-2xl w-fit mx-auto shadow-2xl">
          <button
            onClick={() => handleTabChange(ViewMode.DASHBOARD)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${view === ViewMode.DASHBOARD ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
          >
            <TrendingUp className="w-4 h-4" /> Dashboard
          </button>
          <button
            onClick={() => handleTabChange(ViewMode.REPORT)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${view === ViewMode.REPORT ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
          >
            <FileText className="w-4 h-4" /> Deep Report
          </button>
          <button
            onClick={() => handleTabChange(ViewMode.SIMULATION)}
            className={`flex items-center gap-2 px-6 py-2.5 rounded-xl text-sm font-semibold transition-all duration-300 ${view === ViewMode.SIMULATION ? 'bg-gradient-to-r from-cyan-500/20 to-indigo-500/20 text-cyan-300 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)] border border-white/10' : 'text-slate-400 hover:text-white hover:bg-white/5 border border-transparent'}`}
          >
            <Wallet className="w-4 h-4" /> Simulation
          </button>
        </div>

        {/* Error Display */}
        {error && (
          <div className="mb-6 p-4 bg-red-900/50 border border-red-700 text-red-200 rounded-lg flex items-center gap-3">
            <AlertTriangle className="w-5 h-5 shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* Dynamic Content */}
        {loading && !report ? (
          <div className="flex flex-col items-center justify-center py-20 text-slate-500 space-y-4">
            <RefreshCw className="w-12 h-12 animate-spin text-cyan-500" />
            <p>Fetching on-chain data directly...</p>
          </div>
        ) : (
          renderContent()
        )}
      </main>

      {/* Mobile Bottom Navigation */}
      <div className="md:hidden fixed bottom-0 left-0 right-0 bg-slate-900 border-t border-slate-800 z-50 pb-safe">
        <div className="flex justify-around items-center h-16">
          <button
            onClick={() => handleTabChange(ViewMode.DASHBOARD)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === ViewMode.DASHBOARD ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <TrendingUp className="w-5 h-5" />
            <span className="text-[10px] font-medium">Dashboard</span>
          </button>
          <button
            onClick={() => handleTabChange(ViewMode.REPORT)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === ViewMode.REPORT ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <FileText className="w-5 h-5" />
            <span className="text-[10px] font-medium">Report</span>
          </button>
          <button
            onClick={() => handleTabChange(ViewMode.SIMULATION)}
            className={`flex flex-col items-center justify-center w-full h-full space-y-1 ${view === ViewMode.SIMULATION ? 'text-cyan-400' : 'text-slate-500 hover:text-slate-300'}`}
          >
            <Wallet className="w-5 h-5" />
            <span className="text-[10px] font-medium">Simulator</span>
          </button>
        </div>
      </div>

    </div>
  );
}
