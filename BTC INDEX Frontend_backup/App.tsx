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
    // Initial fetch optional, let's wait for user to click for better UX control
  }, []);

  const renderContent = () => {
    const currentReport = report || MOCK_DATA;

    if (view === ViewMode.SIMULATION) {
      return (
        <div className="max-w-4xl mx-auto animate-fadeIn">
           <div className="mb-6">
              <h2 className="text-2xl font-bold text-white mb-2">Strategy Simulation</h2>
              <p className="text-slate-400">Simulate your 1B KRW allocation based on current levels.</p>
           </div>
           <Simulator btcPriceUsd={currentReport.btcPrice || 60000} />
        </div>
      );
    }

    if (view === ViewMode.REPORT) {
      return (
        <div className="max-w-4xl mx-auto animate-fadeIn space-y-8">
           <div className="bg-slate-800 p-8 rounded-xl border border-slate-700 shadow-lg">
              <h2 className="text-2xl font-bold text-cyan-400 mb-6 flex items-center gap-2">
                <FileText className="w-6 h-6" /> 
                Strategy & Execution
              </h2>
              <div className="prose prose-invert prose-cyan max-w-none">
                <h3 className="text-lg font-semibold text-white mt-4">Entry & Exit Strategy</h3>
                <ReactMarkdown>{currentReport.strategyText}</ReactMarkdown>
                
                <h3 className="text-lg font-semibold text-white mt-8 border-t border-slate-700 pt-4">Macro Risks & Tips</h3>
                <ReactMarkdown>{currentReport.risksAndAdvice}</ReactMarkdown>
              </div>
           </div>

           <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
              <h3 className="text-lg font-semibold text-white mb-4">Data Sources</h3>
              <ul className="space-y-2">
                {currentReport.sources.map((src, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm text-slate-400 break-all">
                    <ExternalLink className="w-4 h-4 mt-0.5 shrink-0" />
                    <a href={src} target="_blank" rel="noopener noreferrer" className="hover:text-cyan-400 transition-colors">
                      {src}
                    </a>
                  </li>
                ))}
              </ul>
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
          <div className="bg-slate-800 p-6 rounded-xl border border-slate-700">
            <h3 className="text-slate-400 uppercase text-xs font-bold tracking-wider mb-2">Current Status</h3>
            <div className="text-2xl font-bold text-white mb-1">
              {currentReport.btcPrice ? `$${currentReport.btcPrice.toLocaleString()}` : "Price: N/A"}
            </div>
            <div className="text-sm text-slate-500 mb-4">
               {currentReport.timestamp}
            </div>
            <div className="p-4 bg-slate-900 rounded-lg border border-slate-700 text-sm text-slate-300 italic">
               {currentReport.interpretation}
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
    <div className="min-h-screen bg-slate-950 text-slate-200 font-sans selection:bg-cyan-500 selection:text-white">
      {/* Header */}
      <header className="sticky top-0 z-50 bg-slate-900/80 backdrop-blur-md border-b border-slate-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="bg-cyan-500 p-2 rounded-lg">
              <LineChart className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-lg font-bold text-white leading-tight">BTC Quant Analyst</h1>
              <p className="text-xs text-slate-400">Direct Chain Intelligence</p>
            </div>
          </div>

          <div className="flex items-center gap-4">
             <button 
                onClick={fetchReport} 
                disabled={loading}
                className="hidden sm:flex items-center gap-2 bg-indigo-600 hover:bg-indigo-500 disabled:bg-slate-700 text-white px-4 py-2 rounded-lg font-medium transition-all shadow-lg shadow-indigo-900/20"
             >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                {loading ? 'Scanning Markets...' : 'Update Report'}
             </button>
          </div>
        </div>
      </header>

      {/* Main Container */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        
        {/* Navigation Tabs */}
        <div className="flex gap-4 mb-8 border-b border-slate-800 pb-1 overflow-x-auto">
          <button 
            onClick={() => setView(ViewMode.DASHBOARD)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${view === ViewMode.DASHBOARD ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <TrendingUp className="w-4 h-4" /> Dashboard
          </button>
          <button 
            onClick={() => setView(ViewMode.REPORT)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${view === ViewMode.REPORT ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <FileText className="w-4 h-4" /> Full Report
          </button>
          <button 
            onClick={() => setView(ViewMode.SIMULATION)}
            className={`flex items-center gap-2 px-4 py-3 border-b-2 transition-colors whitespace-nowrap ${view === ViewMode.SIMULATION ? 'border-cyan-500 text-cyan-400' : 'border-transparent text-slate-400 hover:text-white'}`}
          >
            <Wallet className="w-4 h-4" /> Simulator (1B KRW)
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

      {/* Mobile Floating Action Button */}
      <div className="fixed bottom-6 right-6 sm:hidden">
        <button 
           onClick={fetchReport}
           disabled={loading} 
           className="bg-indigo-600 hover:bg-indigo-500 text-white p-4 rounded-full shadow-xl shadow-indigo-900/40"
        >
          <RefreshCw className={`w-6 h-6 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

    </div>
  );
}