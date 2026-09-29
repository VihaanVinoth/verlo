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
    description: 'My landlord is withholding $1,500 of my security deposit claiming minor carpet stains that were already there when I moved in 12 months ago. They stopped responding to my emails.',
    analysis: 'Under residential tenancy laws, normal wear and tear or pre-existing conditions cannot be deducted from a security deposit. The landlord must provide itemized receipts for actual structural damages within the statutory window.',
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
    description: 'I completed a web development project worth $3,200 two months ago. The client approved the final deployment but is ignoring invoices and payment reminders.',
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
    description: 'Received a failing grade on a critical group project component despite submitting all peer review logs proving our individual contributions and complete completion.',
    analysis: 'Academic regulations require transparent marking aligned strictly with published rubrics. Arbitrary grading or lack of substantive feedback violates institutional appeal procedures.',
    nextSteps: [
      'Request an informal review meeting with the unit coordinator within 3 business days.',
      'Compile a side-by-side matrix mapping your submission directly against each rubric criteria.',
      'Escalate to a formal departmental appeal if the informal review is unresolved.'
    ],
    jurisdictionWarning: 'Strict deadlines apply—most institutions require appeal initiation within 5-10 days of grade release.'
  }
];

const ADAPTIVE_QUESTIONS = [
  {
    id: 1,
    question: 'Is there a signed written contract or formal agreement governing this situation?',
    options: ['Yes, fully signed written contract', 'Verbal agreement with email records', 'No formal agreement / informal understanding']
  },
  {
    id: 2,
    question: 'Have you received any formal written notice, rejection, or response from the opposing party?',
    options: ['Yes, received formal rejection/notice', 'Attempted contact but received no response', 'No prior communication attempted yet']
  },
  {
    id: 3,
    question: 'What is your primary desired outcome or immediate remedy?',
    options: ['Full financial refund or debt recovery', 'Contract fulfillment or deposit return', 'Formal dispute escalation or official appeal']
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

  const initiateAssessment = (scenarioData) => {
    setSelectedScenario(scenarioData);
    setAssessmentStep(0);
    setAssessmentAnswers({});
    setStep('assessment');
  };

  const handleAnswerSelect = (option) => {
    const currentQ = ADAPTIVE_QUESTIONS[assessmentStep];
    const updatedAnswers = { ...assessmentAnswers, [currentQ.id]: option };
    setAssessmentAnswers(updatedAnswers);

    if (assessmentStep < ADAPTIVE_QUESTIONS.length - 1) {
      setAssessmentStep(prev => prev + 1);
    } else {
      startAnalysis(selectedScenario, updatedAnswers);
    }
  };

  const startAnalysis = (scenarioData, answers) => {
    setIsAnalyzing(true);
    setAnalysisProgress(0);
    setStep('analyzing');
    
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
    
    initiateAssessment({
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
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      
      {/* Top Header matching screenshot */}
      <header className="border-b border-slate-900 bg-slate-950 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center space-x-3 cursor-pointer" onClick={() => setStep('landing')}>
          <div className="bg-emerald-400 p-2 rounded-lg shadow-md shadow-emerald-400/20 text-slate-950 flex items-center justify-center font-black">
            <Scale className="w-5 h-5 text-slate-950" />
          </div>
          <div>
            <h1 className="text-lg font-black tracking-widest text-white uppercase">
              VERLO
            </h1>
            <p className="text-[10px] text-emerald-400 font-bold tracking-wider">YICTE 2026 Entry</p>
          </div>
        </div>

        <div className="flex items-center space-x-3">
          <button 
            onClick={() => alert('Login / Signup modal toggled')}
            className="text-xs font-bold px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 shadow-lg shadow-emerald-400/20 transition-all"
          >
            Login / Signup
          </button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-start p-4 sm:p-8 max-w-7xl w-full mx-auto">
        
        {step === 'landing' && (
          <div className="w-full flex flex-col items-center animate-fade-in py-8">
            
            <div className="text-center max-w-3xl mb-12">
              <div className="inline-flex items-center space-x-2 p-2 rounded-xl bg-emerald-400/10 mb-6 text-emerald-400">
                <Scale className="w-5 h-5 text-emerald-400" />
                <span className="text-xs font-bold uppercase tracking-wider">VERLO</span>
              </div>
              <h2 className="text-4xl sm:text-6xl font-black tracking-tight text-white mb-6 leading-tight">
                Stop guessing. Know your exact next step.
              </h2>
              <p className="text-sm sm:text-base text-slate-400 mb-8 leading-relaxed max-w-2xl mx-auto font-medium">
                Transform complex dilemmas into rigorous, risk-scored action pathways via adaptive intelligence profiling.
              </p>

              <button 
                onClick={() => {
                  const inputSection = document.getElementById('custom-input-box');
                  if (inputSection) inputSection.scrollIntoView({ behavior: 'smooth' });
                }}
                className="inline-flex items-center space-x-2 px-6 py-3.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-sm shadow-xl shadow-emerald-400/20 transition-all transform active:scale-95"
              >
                <span>Launch Decision Engine</span>
                <ArrowRight className="w-4 h-4" />
              </button>
            </div>

            {/* Custom Input Box for completeness */}
            <div id="custom-input-box" className="w-full max-w-4xl mb-12">
              <form onSubmit={handleCustomSubmit} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 shadow-2xl text-left">
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-2">
                  Describe Your Situation or Paste Contract Clauses
                </label>
                <textarea 
                  rows={3}
                  value={customInput}
                  onChange={(e) => setCustomInput(e.target.value)}
                  placeholder="e.g., My landlord is withholding $1,500 of my security deposit..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-4 text-slate-200 placeholder-slate-600 focus:outline-none focus:border-emerald-400 text-sm resize-none"
                />

                <div className="mt-4 flex justify-end">
                  <button 
                    type="submit"
                    className="flex items-center space-x-2 px-5 py-2.5 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 font-bold text-xs transition-all"
                  >
                    <span>Run Custom Analysis</span>
                    <ArrowRight className="w-4 h-4" />
                  </button>
                </div>
              </form>
            </div>

            <div className="w-full max-w-5xl">
              <div className="text-center mb-6">
                <span className="text-[11px] font-bold uppercase tracking-widest text-slate-500">
                  Or select a sample dilemma to test instantly:
                </span>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                {SAMPLE_SCENARIOS.map((scenario) => (
                  <div 
                    key={scenario.id}
                    onClick={() => initiateAssessment(scenario)}
                    className="group bg-slate-900/40 border border-slate-800/80 hover:border-emerald-400/50 rounded-2xl p-6 cursor-pointer transition-all duration-300 hover:shadow-xl hover:shadow-emerald-400/5 flex flex-col justify-between"
                  >
                    <div>
                      <h4 className="text-base font-bold text-white group-hover:text-emerald-300 transition-colors mb-3">
                        {scenario.title}
                      </h4>
                      <p className="text-xs text-slate-400 line-clamp-4 leading-relaxed font-normal">
                        {scenario.description}
                      </p>
                    </div>

                    <div className="mt-6 pt-4 border-t border-slate-800/60 flex items-center justify-between text-xs font-bold text-emerald-400 group-hover:translate-x-1 transition-transform">
                      <span>Try this scenario</span>
                      <ArrowRight className="w-4 h-4" />
                    </div>
                  </div>
                ))}
              </div>
            </div>

          </div>
        )}

        {step === 'assessment' && selectedScenario && (
          <div className="w-full max-w-2xl bg-slate-900 border border-slate-800 rounded-2xl p-8 my-10 animate-fade-in shadow-2xl">
            <div className="flex items-center justify-between mb-6 pb-4 border-b border-slate-800">
              <div>
                <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-400">Adaptive Questionnaire</span>
                <h3 className="text-lg font-bold text-white">{selectedScenario.title}</h3>
              </div>
              <span className="text-xs font-semibold px-3 py-1 rounded-full bg-emerald-400/10 text-emerald-300 border border-emerald-400/20">
                Question {assessmentStep + 1} of {ADAPTIVE_QUESTIONS.length}
              </span>
            </div>

            <div className="mb-8">
              <h4 className="text-base font-semibold text-slate-100 mb-4">
                {ADAPTIVE_QUESTIONS[assessmentStep].question}
              </h4>
              <div className="space-y-3">
                {ADAPTIVE_QUESTIONS[assessmentStep].options.map((option, idx) => (
                  <button
                    key={idx}
                    onClick={() => handleAnswerSelect(option)}
                    className="w-full text-left p-4 rounded-xl bg-slate-950 border border-slate-800 hover:border-emerald-400 hover:bg-emerald-400/5 text-slate-200 text-sm font-medium transition-all flex items-center justify-between group"
                  >
                    <span>{option}</span>
                    <ChevronRight className="w-4 h-4 text-slate-500 group-hover:text-emerald-400 group-hover:translate-x-1 transition-all" />
                  </button>
                ))}
              </div>
            </div>

            <div className="flex justify-between items-center text-xs text-slate-500">
              <button 
                onClick={() => setStep('landing')}
                className="hover:text-slate-300 transition-colors"
              >
                ← Cancel & Return
              </button>
              <span>Verlo Adaptive Engine v2.4</span>
            </div>
          </div>
        )}

        {step === 'analyzing' && (
          <div className="flex-1 flex flex-col items-center justify-center py-20 text-center animate-fade-in">
            <div className="relative w-24 h-24 mb-6">
              <div className="absolute inset-0 rounded-full border-4 border-slate-800 animate-pulse"></div>
              <div className="absolute inset-0 rounded-full border-4 border-emerald-400 border-t-transparent animate-spin"></div>
              <div className="absolute inset-0 flex items-center justify-center font-bold text-sm text-emerald-300">
                {analysisProgress}%
              </div>
            </div>
            <h3 className="text-xl font-bold text-white mb-2">Analyzing Legal Frameworks</h3>
            <p className="text-sm text-slate-400 max-w-md">
              Synthesizing adaptive questionnaire inputs and statutory rights for: <br />
              <span className="text-emerald-300 font-semibold">"{selectedScenario?.title}"</span>
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
                  className="flex items-center space-x-2 px-4 py-2 rounded-xl bg-emerald-400 hover:bg-emerald-300 text-slate-950 text-xs font-bold shadow-md shadow-emerald-400/20 transition-all"
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
                        ? 'border-emerald-400 text-emerald-400 bg-emerald-400/5' 
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
                        <div className="w-7 h-7 rounded-full bg-emerald-400/20 text-emerald-400 border border-emerald-400/30 flex items-center justify-center font-bold text-xs shrink-0">
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

      <footer className="border-t border-slate-900 bg-slate-950 py-4 px-6 text-center text-xs text-slate-500">
        <p>© 2026 Verlo YICTE Entry. Secure Legal Intelligence Platform. All rights reserved.</p>
      </footer>
    </div>
  );
}