import React, { useState, useEffect, useRef } from 'react';
import { 
  Scale, ShieldAlert, FileText, ArrowRight, CheckCircle2, AlertTriangle, 
  HelpCircle, RefreshCw, Download, MessageSquare, History, User, 
  ChevronRight, Sparkles, Send, Trash2, ExternalLink, Award, FileCode, Check, Lock, ChevronDown
} from 'lucide-react';

const SAMPLE_SCENARIOS = [
  {
    id: 'landlord',
    title: 'Landlord Deposit Dispute',
    category: 'Housing / Tenancy',
    description: 'Landlord withholding 100% of bond for normal wear and tear after a 2-year lease.',
    analysis: 'Under residential tenancy laws, normal wear and tear cannot be deducted from a security deposit. The landlord must provide itemized receipts for actual structural damages within the statutory window.',
    nextSteps: [
      'Demand an itemized statement of deductions in writing via certified mail.',
      'Gather move-in and move-out inspection photographs.',
      'File a formal dispute claim with the local tenancy tribunal if unresponsive within 7 days.'
    ],
    jurisdictionWarning: 'Statutory return windows vary from 14 to 60 days depending on your state or territory.'
  },
  {
    id: 'freelance',
    title: 'Freelance Client Non-Payment',
    category: 'Commercial / Contract',
    description: 'Client accepted final web deliverables 45 days ago but stopped responding to invoices.',
    analysis: 'An accepted delivery under a signed Statement of Work constitutes a binding obligation. Continued non-payment breaches the agreement, entitling you to statutory late fees and recovery costs.',
    nextSteps: [
      'Send a final formal Letter of Demand giving a strict 7-day payment window.',
      'Revoke staging server access or license permissions if contractually permitted.',
      'Prepare documentation for small claims court filing.'
    ],
    jurisdictionWarning: 'Ensure you check your local small claims monetary limit before filing.'
  },
  {
    id: 'university',
    title: 'Unfair University Assignment Grade',
    category: 'Education / Academic',
    description: 'Received a failing grade on a major project despite strictly fulfilling all rubric criteria.',
    analysis: 'Academic regulations require transparent marking aligned strictly with published rubrics. Arbitrary grading or lack of substantive feedback violates institutional appeal procedures.',
    nextSteps: [
      'Request an informal review meeting with the unit coordinator within 3 business days.',
      'Compile a side-by-side matrix mapping your submission directly against each rubric criteria.',
      'Escalate to a formal departmental appeal if the informal review is unresolved.'
    ],
    jurisdictionWarning: 'Strict deadlines apply—most institutions require appeal initiation within 5-10 days of grade release.'
  }
];

export default function App() {
  const [step, setStep] = useState('landing');
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [customInput, setCustomInput] = useState('');
  const [isAnalyzing, setIsAnalyzing] = useState(false);
  const [analysisProgress, setAnalysisProgress] = useState(0);
  const [activeTab, setActiveTab] = useState('overview');
  
  const [assessmentStep, setAssessmentStep] = useState(0);
  const [assessmentAnswers, setAssessmentAnswers] = useState({});

  const [chatOpen, setChatOpen] = useState(false);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your Verlo Legal AI assistant. How can I help you unpack your rights or refine your action plan today?' }
  ]);
  const [chatInput, setChatInput] = useState('');
  const chatBottomRef = useRef(null);

  const [historyOpen, setHistoryOpen] = useState(false);
  const [history, setHistory] = useState([
    { id: 1, title: 'Landlord Bond Dispute', date: 'Oct 12, 2026', status: 'Action Plan Ready' },
    { id: 2, title: 'Freelance Invoice Recovery', date: 'Sep 28, 2026', status: 'Resolved' }
  ]);

  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [dragOver, setDragOver] = useState(false);

  useEffect(() => {
    if (chatBottomRef.current) {
      chatBottomRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  }, [messages, chatOpen]);

  const handleFileUpload = (e) => {
    const files = Array.from(e.target.files || e.dataTransfer.files);
    const validFiles = files.filter(f => f.size <= 15 * 1024 * 1024);
    
    const newFileEntries = validFiles.map(file => ({
      name: file.name,
      size: (file.size / (1024 * 1024)).toFixed(2) + ' MB',
      type: file.type || 'Document'
    }));
    
    setUploadedFiles(prev => [...prev, ...newFileEntries]);
  };

  const removeFile = (index) => {
    setUploadedFiles(prev => prev.filter((_, i) => i !== index));
  };

  const startAnalysis = (scenarioData) => {
    setSelectedScenario(scenarioData);
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    
    const interval = setInterval(() => {
      setAnalysisProgress(prev => {
        if (prev >= 100) {
          clearInterval(interval);
          setIsAnalyzing(false);
          setStep('results');
          return 100;
        }
        return prev + 25;
      });
    }, 400);
  };

  const handleCustomSubmit = (e) => {
    e.preventDefault();
    if (!customInput.trim() && uploadedFiles.length === 0) return;
    
    startAnalysis({
      id: 'custom',
      title: customInput.slice(0, 40) + (customInput.length > 40 ? '...' : ''),
      category: 'User Custom Case',
      description: customInput,
      analysis: 'Synthesizing local statutory frameworks, contractual obligations, and uploaded evidence files to establish clear liability and procedural rights.',
      nextSteps: [
        'Issue a formal written notice detailing exact breaches and requested remedies.',
        'Preserve all communications, receipts, and contract documents in a secure log.',
        'Consult with a specialized legal aid clinic if the opposing party fails to respond within 14 days.'
      ],
      jurisdictionWarning: 'Analysis based on standard domestic civil and contractual codes. Verify local statutory limitations.'
    });
  };

  const handleSendMessage = (e) => {
    e.preventDefault();
    if (!chatInput.trim()) return;

    const userMsg = chatInput;
    setMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatInput('');

    setTimeout(() => {
      let reply = "Based on standard legal procedures, I recommend keeping all correspondence in writing (email or certified mail) to maintain a clear paper trail.";
      if (userMsg.toLowerCase().includes('cost') || userMsg.toLowerCase().includes('fee')) {
        reply = "Many tribunals and small claims courts feature minimal filing fees, often under $100, which can sometimes be recovered if you win the judgment.";
      } else if (userMsg.toLowerCase().includes('time') || userMsg.toLowerCase().includes('deadline')) {
        reply = "Statutory time limits (statutes of limitations) are strictly enforced. It is vital to lodge your claim well before the cutoff date.";
      }
      setMessages(prev => [...prev, { role: 'assistant', content: reply }]);
    }, 800);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-indigo-500 selection:text-white">
      
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur-md sticky top-0 z-40 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setStep('landing')}>
          <div className="bg-gradient-to-tr from-indigo-600 to-violet-500 p-2.5 rounded-xl shadow-lg shadow-indigo-500/20">
            <Scale className="w-6 h-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-bold tracking-tight bg-gradient-to-r from-white via-slate-200 to-indigo-200 bg-clip-text text-transparent">
              VERLO YICTE 2026 Entry
            </h1>
            <p className="text-xs text-slate-400 font-medium">Next-Generation Legal Decision & Rights Engine</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => setHistoryOpen(true)}
            className="flex items-center space-x-2 text-xs font-semibold px-3 py-2 rounded-lg bg-slate-800 hover:bg-slate-700 text-slate-300 transition-colors border border-slate-700"
          >
            <History className="w-4 h-4 text-indigo-400" />
            <span className="hidden sm:inline">Case History</span>
          </button>
          
          <button 
            onClick={() => setChatOpen(true)}
            className="flex items-center space-x-2 text-xs font-semibold px-3.5 py-2 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-white shadow-md shadow-indigo-600/20 transition-all"
          >
            <MessageSquare className="w-4 h-4" />
            <span>AI Legal Assistant</span>
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8 max-w-6xl mx-w-full w-full mx-auto">
        
        {step === 'landing' && (
          <div className="w-full flex flex-col items-center animate-fade-in py-6">
            
            <div className="text-center max-w-3xl mb-12">
              <div className="inline-flex items-center space-x-2 px-3.5 py-1.5 rounded-full bg-indigo-500/10 border border-indigo-500/20 text-indigo-400 text-xs font-semibold mb-6 shadow-inner">
                <Sparkles className="w-3.5 h-3.5" />
                <span>Powered by Advanced Legal Reasoning Engine</span>
              </div>
              <h2 className="text-4xl sm:text-6xl font-extrabold tracking-tight text-white mb-6 leading-tight">
                Stop guessing. <br />
                <span className="bg-gradient-to-r from-indigo-400 via-violet-400 to-pink-400 bg-clip-text text-transparent">
                  Know your exact next step.
                </span>
              </h2>
              <p className="text-base sm:text-lg text-slate-400 mb-8 leading-relaxed">
                Verlo transforms complex legal contracts, housing disputes, and consumer conflicts into actionable, step-by-step resolution pathways in seconds.
              </p>

              <form onSubmit={handleCustomSubmit} className="bg-slate-900 border border-slate-800 rounded-2xl p-4 sm:p-6 shadow-2xl text-left w-full">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Describe Your Situation or Paste Contract Clauses
                </label>
                <textarea 
                  rows={4}
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="e.g., My landlord is keeping my security deposit because of wear and tear that was already present when I moved in..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500 text-sm resize-none"
                />

                <div 
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFileUpload(e); }}
                  className={`mt-4 border-2 border-dashed rounded-xl p-4 text-center transition-all ${
                    dragOver ? 'border-indigo-500 bg-indigo-500/10' : 'border-slate-800 hover:border-slate-700 bg-slate-950/50'
                  }`}
                >
                  <input type="file" id="file-upload" multiple onChange={handleFileUpload} className="hidden" />
                  <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center justify-center space-y-1">
                    <FileText className="w-6 h-6 text-indigo-400 mb-1" />
                    <p className="text-xs text-slate-300 font-medium">
                      Drag & drop contract PDFs, images, or <span className="text-indigo-400 underline">browse files</span>
                    </p>
                    <p className="text-[10px] text-slate-500">Supports PDF, DOCX, PNG (Max 15MB)</p>
                  </label>
                </div>

                {uploadedFiles.length > 0 && (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {uploadedFiles.map((file, idx) => (
                      <div key={idx} className="flex items-center space-x-2 bg-slate-800 border border-slate-700 px-3 py-1.5 rounded-lg text-xs">
                        <FileCode className="w-3.5 h-3.5 text-indigo-400" />
                        <span className="text-slate-200 font-medium truncate max-w-[160px]">{file.name}</span>
                        <span className="text-slate-400 text-[10px]">({file.size})</span>
                        <button type="button" onClick={() => removeFile(idx)} className="text-slate-400 hover:text-red-400">
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="mt-6 flex justify-end">
                  <button 
                    type="submit"
                    className="flex items-center space-x-2 px-6 py-3 rounded-xl bg-gradient-to-r from-indigo-600 to-violet-600 hover:from-indigo-500 hover:to-violet-500 text-white font-semibold text-sm shadow-lg shadow-indigo-600/30 transition-all transform active:scale-95"
                  >
                    <span>Launch Decision Engine</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>

            <div className="w-full max-w-5xl mt-4">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold text-slate-200 flex items-center space-x-2">
                  <Sparkles className="w-4 h-4 text-indigo-400" />
                  <span>Or Try Sample Scenarios</span>
                </h3>
                <span className="text-xs text-slate-500 font-medium">Click any card to load instant analysis</span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {SAMPLE_SCENARIOS.map((scenario) => (
                  <div 
                    key={scenario.id}
                    onClick={() => startAnalysis(scenario)}
                    className="group bg-slate-900 border border-slate-800 hover:border-indigo-500/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-indigo-500/10 flex flex-col justify-between"
                  >
                    <div>
                      <span className="inline-block text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-indigo-500/10 text-indigo-400 border border-indigo-500/20 mb-3">
                        {scenario.category}
                      </span>
                      <h4 className="text-base font-bold text-white group-hover:text-indigo-300 transition-colors mb-2">
                        {scenario.title}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-3 leading-relaxed">
                        {scenario.description}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800 flex items-center justify-between text-xs font-semibold text-indigo-400 group-hover:translate-x-1 transition-transform">
                      <span>Run Decision Engine</span>
                      <ChevronRight className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {isAnalyzing && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800 animate-pulse"></div>
              <div className="absolute inset-0 rounded-full border-4 border-indigo-500 border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center font-bold text-sm text-indigo-300">
                {analysisProgress}%
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Analyzing Legal Frameworks</h3>
            <p className="text-sm text-slate-400 max-w-md">
              Cross-referencing statutory rights, precedents, and contract terms for: <br />
              <span className="text-indigo-300 font-semibold">"{selectedScenario?.title}"</span>
            </p>
          </div>
        )}

        {step === 'results' && !isAnalyzing && selectedScenario && (
          <div className="w-full max-w-5xl animate-fade-in py-4">
            
            <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
              <div>
                <div className="flex items-center space-x-2 mb-2">
                  <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-md bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                    Analysis Complete
                  </span>
                  <span className="text-xs text-slate-400 font-medium">• {selectedScenario.category}</span>
                </div>
                <h2 className="text-2xl font-bold text-white">{selectedScenario.title}</h2>
              </div>
              <div className="flex items-center space-x-3">
                <button 
                  onClick={() => setStep('landing')}
                  className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs font-semibold border border-slate-700 transition-colors"
                >
                  New Query
                </button>
                <button 
                  onClick={() => alert('Summary exported successfully as PDF.')}
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white text-xs font-semibold shadow-md shadow-indigo-600/20 transition-all"
                >
                  <Download className="w-4 h-4" />
                  <span>Export Report</span>
                </button>
              </div>
            </div>

            <div className="flex space-x-2 border-b border-slate-800 mb-6 overflow-x-auto pb-px">
              {[
                { id: 'overview', label: 'Executive Summary', icon: Scale },
                { id: 'steps', label: 'Actionable Steps', icon: CheckCircle2 },
                { id: 'warnings', label: 'Risks & Warnings', icon: AlertTriangle }
              ].map((tab) => {
                const Icon = tab.icon;
                const isActive = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    onClick={() => setActiveTab(tab.id)}
                    className={`flex items-center space-x-2 px-4 py-3 border-b-2 font-semibold text-xs transition-all whitespace-nowrap ${
                      isActive 
                        ? 'border-indigo-500 text-indigo-400 bg-indigo-500/5' 
                        : 'border-transparent text-slate-400 hover:text-slate-200'
                    }`}
                  >
                    <Icon className="w-4 h-4" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>

            {activeTab === 'overview' && (
              <div className="space-y-6">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-3">Case Assessment</h3>
                  <p className="text-slate-200 text-base leading-relaxed mb-6">
                    {selectedScenario.analysis}
                  </p>
                  
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 flex items-start space-x-3">
                    <ShieldAlert className="w-5 h-5 text-amber-400 shrink-0 mt-0.5" />
                    <div>
                      <h4 className="text-xs font-bold uppercase tracking-wider text-amber-400 mb-1">Jurisdictional Notice</h4>
                      <p className="text-xs text-slate-400 leading-relaxed">
                        {selectedScenario.jurisdictionWarning}
                      </p>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'steps' && (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-slate-400 mb-4">Recommended Resolution Roadmap</h3>
                  <div className="space-y-4">
                    {selectedScenario.nextSteps.map((stepText, idx) => (
                      <div key={idx} className="flex items-start space-x-4 bg-slate-950 border border-slate-800 p-4 rounded-xl">
                        <div className="w-7 h-7 rounded-full bg-indigo-600/20 text-indigo-400 border border-indigo-500/30 flex items-center justify-center font-bold text-xs shrink-0">
                          {idx + 1}
                        </div>
                        <div className="flex-1">
                          <p className="text-sm text-slate-200 font-medium leading-relaxed">{stepText}</p>
                        </div>
                        <CheckCircle2 className="w-5 h-5 text-emerald-400 shrink-0 mt-0.5" />
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'warnings' && (
              <div className="space-y-4">
                <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-amber-400 mb-4 flex items-center space-x-2">
                    <AlertTriangle className="w-4 h-4" />
                    <span>Critical Compliance & Risk Factors</span>
                  </h3>
                  <div className="space-y-3">
                    <div className="p-4 rounded-xl bg-amber-500/10 border border-amber-500/20 text-xs text-amber-200/90 leading-relaxed">
                      <strong>Statutory Deadlines:</strong> Failing to act within local limitation periods can permanently forfeit your right to seek remedy or compensation.
                    </div>
                    <div className="p-4 rounded-xl bg-slate-950 border border-slate-800 text-xs text-slate-300 leading-relaxed">
                      <strong>Documentation Integrity:</strong> Always maintain unedited copies of all contracts, invoices, and communication transcripts. Avoid verbal agreements without written follow-ups.
                    </div>
                  </div>
                </div>
              </div>
            )}

          </div>
        )}

      </main>

      {chatOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-md bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="bg-indigo-600 p-2 rounded-lg text-white">
                  <MessageSquare className="w-4 h-4" />
                </div>
                <div>
                  <h3 className="text-sm font-bold text-white">Verlo AI Assistant</h3>
                  <p className="text-[10px] text-indigo-400 font-medium">Always active • Secure session</p>
                </div>
              </div>
              <button 
                onClick={() => setChatOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 transition-colors text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-4">
              {messages.map((m, idx) => (
                <div key={idx} className={`flex ${m.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                  <div className={`max-w-[85%] p-3.5 rounded-2xl text-xs leading-relaxed ${
                    m.role === 'user' 
                      ? 'bg-indigo-600 text-white rounded-br-none' 
                      : 'bg-slate-800 text-slate-200 border border-slate-700 rounded-bl-none'
                  }`}>
                    {m.content}
                  </div>
                </div>
              ))}
              <div ref={chatBottomRef} />
            </div>

            <form onSubmit={handleSendMessage} className="p-4 border-t border-slate-800 bg-slate-900 flex items-center space-x-2">
              <input 
                type="text"
                value={chatInput}
                onChange={(e) => setChatInput(e.target.value)}
                placeholder="Ask a clarifying legal question..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-xs text-slate-200 placeholder-slate-600 focus:outline-none focus:border-indigo-500"
              />
              <button 
                type="submit"
                className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-500 text-white transition-colors shadow-md shadow-indigo-600/20"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>
      )}

      {historyOpen && (
        <div className="fixed inset-0 z-50 flex justify-end bg-black/60 backdrop-blur-sm animate-fade-in">
          <div className="w-full max-w-sm bg-slate-900 border-l border-slate-800 h-full flex flex-col shadow-2xl">
            <div className="p-4 border-b border-slate-800 flex items-center justify-between">
              <h3 className="text-sm font-bold text-white flex items-center space-x-2">
                <History className="w-4 h-4 text-indigo-400" />
                <span>Saved Case History</span>
              </h3>
              <button 
                onClick={() => setHistoryOpen(false)}
                className="text-slate-400 hover:text-white p-2 rounded-lg hover:bg-slate-800 text-xs font-bold"
              >
                ✕
              </button>
            </div>

            <div className="flex-1 p-4 overflow-y-auto space-y-3">
              {history.map((item) => (
                <div key={item.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl hover:border-indigo-500/50 transition-colors cursor-pointer">
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-bold text-white">{item.title}</span>
                    <span className="text-[10px] text-slate-400">{item.date}</span>
                  </div>
                  <span className="inline-block text-[10px] font-semibold text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">
                    {item.status}
                  </span>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <footer className="border-t border-slate-800 bg-slate-900/40 py-4 px-6 text-center text-xs text-slate-400">
        <p>© 2026 Verlo YICTE Entry. Secure Legal Intelligence Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}
