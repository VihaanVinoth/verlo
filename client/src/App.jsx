import React, { useState, useEffect, useRef } from 'react';
import './App.css';

export default function App() {
  const [currentView, setCurrentView] = useState('landing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState('form');
  const [questions, setQuestions] = useState([]);
  const [mcqList, setMcqList] = useState([]);
  const [userAnswers, setUserAnswers] = useState({});
  const [mcqAnswers, setMcqAnswers] = useState({});
  const [report, setReport] = useState(null);
  const [error, setError] = useState(null);
  const [activeTab, setActiveTab] = useState('pathway');
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState('');
  const [chatLoading, setChatLoading] = useState(false);
  const [authMode, setAuthMode] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fullName, setFullName] = useState('');
  const [currentUser, setCurrentUser] = useState(null);
  const [history, setHistory] = useState([]);
  const [showHistory, setShowHistory] = useState(false);
  const [kbQuery, setKbQuery] = useState('');
  const [kbResults, setKbResults] = useState([]);
  const [newKbTopic, setNewKbTopic] = useState('');
  const [newKbContent, setNewKbContent] = useState('');
  const [systemHealth, setSystemHealth] = useState(null);
  const chatBottomRef = useRef(null);

  useEffect(() => {
    fetch('http://localhost:5001/api/health')
      .then(res => res.json())
      .then(data => setSystemHealth(data))
      .catch(() => setSystemHealth({ status: 'offline' }));
  }, []);

  useEffect(() => {
    if (currentUser) {
      fetchHistory(currentUser.id);
    }
  }, [currentUser]);

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [chatMessages]);

  const fetchHistory = async (userId) => {
    try {
      const res = await fetch(`http://localhost:5001/api/history/${userId}`);
      const data = await res.json();
      if (data.success) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('History fetch error:', err);
    }
  };

  const saveReportToHistory = async (reportData) => {
    if (!currentUser) return;
    try {
      const res = await fetch('http://localhost:5001/api/history/save', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, report: { ...reportData, title, description } })
      });
      const data = await res.json();
      if (data.success) {
        setHistory(data.history);
      }
    } catch (err) {
      console.error('Save history error:', err);
    }
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    const endpoint = isLogin ? '/api/auth/login' : '/api/auth/signup';
    try {
      const res = await fetch(`http://localhost:5001${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password, fullName })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Authentication failure.');
      setCurrentUser(data.user);
      setAuthMode(false);
      setEmail('');
      setPassword('');
      setFullName('');
    } catch (err) {
      setError(err.message);
    }
  };

  const handleInitialSubmit = async (e) => {
    e.preventDefault();
    if (!description.trim()) return;

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('http://localhost:5001/api/assess', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Assessment computation failed.');

      if (data.data.needsClarification && (data.data.adaptiveQuestions?.length > 0 || data.data.mcqAssessment?.length > 0)) {
        setQuestions(data.data.adaptiveQuestions || []);
        setMcqList(data.data.mcqAssessment || []);
        setStep('wizard');
      } else {
        await fetchFinalPathway({}, {});
      }
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleWizardSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    await fetchFinalPathway(userAnswers, mcqAnswers);
  };

  const fetchFinalPathway = async (answers, mcqs) => {
    try {
      const res = await fetch('http://localhost:5001/api/diagnose', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, context, userAnswers: answers, mcqAnswers: mcqs })
      });
      const data = await res.json();

      if (!res.ok) throw new Error(data.error || 'Pathway synthesis failed.');

      setReport(data.data);
      setStep('result');
      setCurrentView('app');
      setChatMessages([
        { role: 'assistant', content: `VERLO Neural Core online. Situation analyzed: "${title || 'Untitled Scenario'}". How may I assist your tactical execution further?` }
      ]);
      await saveReportToHistory(data.data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatInput.trim() || chatLoading) return;

    const userMsg = chatInput.trim();
    setChatInput('');
    setChatMessages(prev => [...prev, { role: 'user', content: userMsg }]);
    setChatLoading(true);

    try {
      const res = await fetch('http://localhost:5001/api/chat', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ question: userMsg, currentSituation: JSON.stringify(report) })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Neural chat failed.');

      setChatMessages(prev => [...prev, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setChatMessages(prev => [...prev, { role: 'assistant', content: `Neural Error: ${err.message}` }]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleKbSearch = async () => {
    try {
      const res = await fetch(`http://localhost:5001/api/kb/search?q=${encodeURIComponent(kbQuery)}`);
      const data = await res.json();
      if (data.success) setKbResults(data.results);
    } catch (err) {
      console.error('KB search error:', err);
    }
  };

  const handleKbContribute = async (e) => {
    e.preventDefault();
    if (!newKbTopic || !newKbContent) return;
    try {
      const res = await fetch('http://localhost:5001/api/kb/contribute', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ topic: newKbTopic, content: newKbContent, author: currentUser?.email || 'Expert' })
      });
      const data = await res.json();
      if (data.success) {
        setNewKbTopic('');
        setNewKbContent('');
        handleKbSearch();
        alert('Knowledge entry contributed successfully.');
      }
    } catch (err) {
      console.error('KB contribute error:', err);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col font-sans selection:bg-emerald-500 selection:text-slate-950">
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex justify-between items-center shadow-xl">
        <div className="flex items-center gap-3 cursor-pointer" onClick={() => setCurrentView('landing')}>
          <div className="w-9 h-9 rounded-xl bg-gradient-to-br from-emerald-500 to-teal-700 flex items-center justify-center text-slate-950 font-extrabold shadow-lg shadow-emerald-500/20">V</div>
          <div>
            <h1 className="text-lg font-black tracking-tight text-emerald-400 leading-none">VERLO ENTERPRISE</h1>
            <span className="text-[9px] text-slate-400 uppercase tracking-widest font-bold">Decision Intelligence & Neural Simulation</span>
          </div>
        </div>

        <nav className="hidden md:flex items-center gap-6">
          <button onClick={() => setCurrentView('landing')} className={`text-xs font-semibold tracking-wider uppercase transition-colors ${currentView === 'landing' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}>Overview</button>
          <button onClick={() => setCurrentView('app')} className={`text-xs font-semibold tracking-wider uppercase transition-colors ${currentView === 'app' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}>Console</button>
          <button onClick={() => setCurrentView('knowledge')} className={`text-xs font-semibold tracking-wider uppercase transition-colors ${currentView === 'knowledge' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}>Knowledge Base</button>
          <button onClick={() => setCurrentView('analytics')} className={`text-xs font-semibold tracking-wider uppercase transition-colors ${currentView === 'analytics' ? 'text-emerald-400' : 'text-slate-400 hover:text-slate-200'}`}>System Telemetry</button>
        </nav>

        <div className="flex items-center gap-4">
          {currentUser ? (
            <div className="flex items-center gap-3">
              <button 
                onClick={() => setShowHistory(!showHistory)}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg transition-colors border border-slate-700 font-medium"
              >
                {showHistory ? 'Close History' : `History (${history.length})`}
              </button>
              <div className="text-xs bg-slate-900 px-3 py-1.5 rounded-lg border border-slate-800 flex flex-col items-end">
                <span className="text-slate-200 font-bold">{currentUser.fullName}</span>
                <span className="text-[9px] text-emerald-400 uppercase tracking-widest">{currentUser.tier}</span>
              </div>
              <button 
                onClick={() => { setCurrentUser(null); setHistory([]); setShowHistory(false); }}
                className="text-xs bg-red-950/50 hover:bg-red-900/50 text-red-300 px-3 py-1.5 rounded-lg transition-colors border border-red-900/60 font-medium"
              >
                Sign Out
              </button>
            </div>
          ) : (
            <div className="flex items-center gap-2">
              <button 
                onClick={() => { setIsLogin(true); setAuthMode(true); }}
                className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-3.5 py-2 rounded-xl transition-colors border border-slate-700 font-semibold"
              >
                Sign In
              </button>
              <button 
                onClick={() => { setIsLogin(false); setAuthMode(true); }}
                className="text-xs bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-4 py-2 rounded-xl transition-colors shadow-lg shadow-emerald-900/30"
              >
                Sign Up
              </button>
            </div>
          )}
        </div>
      </header>

      {authMode && (
        <div className="fixed inset-0 bg-black/80 backdrop-blur-md z-50 flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-slate-800 p-8 rounded-2xl w-full max-w-md space-y-6 shadow-2xl relative animate-in fade-in zoom-in-95 duration-200">
            <div className="flex justify-between items-center border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-xl font-black text-slate-100">{isLogin ? 'Sign In to VERLO' : 'Create Enterprise Account'}</h2>
                <p className="text-xs text-slate-400 mt-0.5">Secure neural authentication gateway</p>
              </div>
              <button onClick={() => setAuthMode(false)} className="text-slate-400 hover:text-slate-200 text-lg font-bold">✕</button>
            </div>
            <form onSubmit={handleAuthSubmit} className="space-y-4">
              {!isLogin && (
                <div>
                  <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Full Name / Designation</label>
                  <input 
                    type="text" 
                    value={fullName} 
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="e.g., Director Alex Mercer"
                    className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500 text-sm font-medium"
                    required
                  />
                </div>
              )}
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Enterprise Email</label>
                <input 
                  type="email" 
                  value={email} 
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="alex@enterprise.com"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500 text-sm font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Neural Key (Password)</label>
                <input 
                  type="password" 
                  value={password} 
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500 text-sm font-medium"
                  required
                />
              </div>
              <button 
                type="submit" 
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold py-3.5 rounded-xl transition-colors cursor-pointer text-sm shadow-lg shadow-emerald-900/30 mt-2"
              >
                {isLogin ? 'Authenticate & Access Console' : 'Initialize Enterprise Profile'}
              </button>
            </form>
          </div>
        </div>
      )}

      {showHistory && (
        <div className="bg-slate-900 border-b border-slate-800 p-6 shadow-2xl transition-all">
          <div className="max-w-4xl mx-auto space-y-4">
            <div className="flex justify-between items-center border-b border-slate-800 pb-3">
              <h2 className="text-sm font-bold uppercase tracking-widest text-emerald-400">Archived Scenario Reports ({history.length})</h2>
              <button onClick={() => setShowHistory(false)} className="text-xs text-slate-400 hover:text-slate-200">Close ✕</button>
            </div>
            {history.length === 0 ? (
              <p className="text-xs text-slate-500 py-2">No historical scenario analyses stored.</p>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 max-h-72 overflow-y-auto pr-2">
                {history.map((item) => (
                  <div key={item.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl flex justify-between items-center hover:border-slate-700 transition-colors">
                    <div className="space-y-1">
                      <h4 className="text-sm font-bold text-slate-200">{item.title || 'Untitled Scenario'}</h4>
                      <p className="text-xs text-slate-400 line-clamp-1">{item.description}</p>
                      <span className="text-[10px] text-slate-500">{new Date(item.timestamp).toLocaleString()}</span>
                    </div>
                    <button 
                      onClick={() => { setReport(item); setTitle(item.title || ''); setDescription(item.description || ''); setStep('result'); setCurrentView('app'); setShowHistory(false); }}
                      className="text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 px-3 py-2 rounded-lg border border-emerald-500/30 font-semibold transition-colors shrink-0 ml-3"
                    >
                      Load Report
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {currentView === 'landing' && (
        <main className="flex-1 flex flex-col items-center justify-center p-8 text-center max-w-5xl mx-auto space-y-8 my-auto">
          <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs font-bold tracking-wide uppercase animate-pulse">
            <span>⚡ VERLO Neural Architecture v4.8 Active</span>
          </div>
          <h1 className="text-5xl md:text-7xl font-black tracking-tight text-slate-100 leading-tight">
            Advanced Decision Intelligence & <span className="text-transparent bg-clip-text bg-gradient-to-r from-emerald-400 to-teal-300">Strategic Simulation</span>
          </h1>
          <p className="text-base md:text-lg text-slate-400 max-w-2xl leading-relaxed">
            Eliminate ambiguity in high-stakes operational disputes, legal friction, and organizational dilemmas using adaptive questioning, comprehensive MCQ profiling, and rigorous AI path-mapping.
          </p>
          <div className="flex flex-wrap items-center justify-center gap-4 pt-4">
            <button 
              onClick={() => setCurrentView('app')}
              className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black px-8 py-4 rounded-2xl transition-all shadow-xl shadow-emerald-900/30 text-sm tracking-wider uppercase cursor-pointer"
            >
              Launch Decision Console
            </button>
            <button 
              onClick={() => setCurrentView('knowledge')}
              className="bg-slate-900 hover:bg-slate-800 text-slate-200 font-bold px-8 py-4 rounded-2xl transition-all border border-slate-800 text-sm tracking-wider uppercase cursor-pointer"
            >
              Explore Knowledge Base
            </button>
          </div>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 w-full pt-12 text-left">
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-2 backdrop-blur">
              <div className="text-emerald-400 font-mono text-xs font-bold">01 // ADAPTIVE PROFILING</div>
              <h3 className="text-base font-bold text-slate-200">Dynamic Clarification</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Pinpoint critical forks and eliminate hidden operational risks through automated multi-variable questioning trees.</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-2 backdrop-blur">
              <div className="text-emerald-400 font-mono text-xs font-bold">02 // RIGOROUS MCQs</div>
              <h3 className="text-base font-bold text-slate-200">Precision Assessment</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Evaluate situational constraints and compliance parameters with rigorous automated multiple-choice diagnostics.</p>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 p-6 rounded-2xl space-y-2 backdrop-blur">
              <div className="text-emerald-400 font-mono text-xs font-bold">03 // ACTION BLUEPRINTS</div>
              <h3 className="text-base font-bold text-slate-200">Executable Pathways</h3>
              <p className="text-xs text-slate-400 leading-relaxed">Receive step-by-step mitigation pathways, exposure ratings, and professional communication templates instantly.</p>
            </div>
          </div>
        </main>
      )}

      {currentView === 'knowledge' && (
        <main className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-8">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-2xl font-black text-slate-100">Enterprise Knowledge Base</h2>
              <p className="text-xs text-slate-400 mt-1">Search or contribute to VERLO's global strategic repository</p>
            </div>
            <button onClick={() => setCurrentView('app')} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl transition-colors border border-slate-700">Back to Console</button>
          </div>

          <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">Search Knowledge Repository</h3>
            <div className="flex gap-3">
              <input 
                type="text" 
                value={kbQuery} 
                onChange={(e) => setKbQuery(e.target.value)}
                placeholder="Search topics, precedents, or tactics..."
                className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
              />
              <button onClick={handleKbSearch} className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold px-6 py-3 rounded-xl transition-colors text-xs">Search</button>
            </div>
            <div className="space-y-3 pt-2">
              {kbResults.length === 0 ? (
                <p className="text-xs text-slate-500">No matching entries found. Enter a query or contribute below.</p>
              ) : (
                kbResults.map(item => (
                  <div key={item.id} className="bg-slate-950 border border-slate-800 p-4 rounded-xl space-y-1">
                    <div className="flex justify-between items-center">
                      <h4 className="text-sm font-bold text-slate-200">{item.topic}</h4>
                      <span className="text-[10px] text-slate-500 font-mono">By {item.author}</span>
                    </div>
                    <p className="text-xs text-slate-400 leading-relaxed">{item.content}</p>
                  </div>
                ))
              )}
            </div>
          </div>

          <form onSubmit={handleKbContribute} className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-4">
            <h3 className="text-sm font-bold uppercase tracking-wider text-emerald-400">Contribute to Knowledge Base</h3>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Topic / Precedent Title</label>
              <input 
                type="text" 
                value={newKbTopic} 
                onChange={(e) => setNewKbTopic(e.target.value)}
                placeholder="e.g., SaaS Contract Termination Clause Standard"
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <div>
              <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1">Comprehensive Content / Framework</label>
              <textarea 
                rows="4"
                value={newKbContent} 
                onChange={(e) => setNewKbContent(e.target.value)}
                placeholder="Detail the tactical framework or precedent..."
                className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500"
                required
              />
            </div>
            <button type="submit" className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-bold py-3 rounded-xl transition-colors text-xs">Submit Contribution</button>
          </form>
        </main>
      )}

      {currentView === 'analytics' && (
        <main className="flex-1 p-8 max-w-4xl mx-auto w-full space-y-8">
          <div className="flex justify-between items-center border-b border-slate-800 pb-4">
            <div>
              <h2 className="text-2xl font-black text-slate-100">System Telemetry & Health</h2>
              <p className="text-xs text-slate-400 mt-1">Real-time neural engine metrics and diagnostics</p>
            </div>
            <button onClick={() => setCurrentView('app')} className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl transition-colors border border-slate-700">Back to Console</button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-500">Core Status</span>
              <div className="text-xl font-black text-emerald-400">{systemHealth?.status?.toUpperCase() || 'ONLINE'}</div>
              <span className="text-[10px] text-slate-400">Engine: {systemHealth?.engine}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-500">Server Uptime</span>
              <div className="text-xl font-black text-slate-200">{Math.floor(systemHealth?.uptime || 0)} seconds</div>
              <span className="text-[10px] text-slate-400">Environment: {systemHealth?.environment}</span>
            </div>
            <div className="bg-slate-900 border border-slate-800 p-6 rounded-2xl space-y-2">
              <span className="text-[10px] uppercase font-bold text-slate-500">Active User Sessions</span>
              <div className="text-xl font-black text-amber-400">{Object.keys(userProfiles).length} Registered</div>
              <span className="text-[10px] text-slate-400">Memory Store Active</span>
            </div>
          </div>
        </main>
      )}

      {currentView === 'app' && (
        <main className="flex-1 p-6 flex flex-col items-center max-w-4xl mx-auto w-full space-y-6">
          {error && (
            <div className="w-full bg-red-950/50 border border-red-800 text-red-200 p-4 rounded-xl text-xs font-semibold">
              {error}
            </div>
          )}

          {step === 'form' && (
            <form onSubmit={handleInitialSubmit} className="w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl space-y-6 shadow-2xl">
              <div className="space-y-1">
                <h2 className="text-xl font-black text-slate-100">Initiate Decision Simulation</h2>
                <p className="text-xs text-slate-400">Provide complete context for your operational dilemma or dispute.</p>
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Scenario Title</label>
                <input 
                  type="text" 
                  value={title} 
                  onChange={(e) => setTitle(e.target.value)}
                  placeholder="e.g., Vendor breach of contract dispute"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500 text-sm font-medium"
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Detailed Description *</label>
                <textarea 
                  rows="5"
                  value={description} 
                  onChange={(e) => setDescription(e.target.value)}
                  placeholder="Detail all terms, dates, financial exposure, and current roadblocks..."
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500 text-sm font-medium"
                  required
                />
              </div>
              <div>
                <label className="block text-xs font-bold uppercase tracking-wider text-slate-400 mb-1.5">Additional Context / Constraints (Optional)</label>
                <input 
                  type="text" 
                  value={context} 
                  onChange={(e) => setContext(e.target.value)}
                  placeholder="e.g., Hard deadline in 48 hours, strict confidentiality"
                  className="w-full bg-slate-950 border border-slate-800 rounded-xl p-3 text-slate-200 focus:outline-none focus:border-emerald-500 text-sm font-medium"
                />
              </div>
              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black py-4 rounded-xl transition-colors cursor-pointer disabled:opacity-50 text-sm shadow-xl shadow-emerald-900/30 uppercase tracking-wider"
              >
                {loading ? 'Evaluating Scenario Complexity...' : 'Begin Adaptive Assessment & MCQ'}
              </button>
            </form>
          )}

          {step === 'wizard' && (
            <form onSubmit={handleWizardSubmit} className="w-full bg-slate-900 border border-slate-800 p-8 rounded-2xl space-y-6 shadow-2xl">
              <div className="border-b border-slate-800 pb-4">
                <h2 className="text-xl font-black text-emerald-400">Adaptive Clarification & MCQ Diagnostic</h2>
                <p className="text-xs text-slate-400 mt-1">Answer the following diagnostic questions to calibrate the final simulation blueprint.</p>
              </div>

              {questions.map((q, idx) => (
                <div key={q.id || idx} className="space-y-3 bg-slate-950 p-5 rounded-xl border border-slate-800">
                  <p className="text-sm font-bold text-slate-200">Adaptive Q{idx + 1}: {q.question}</p>
                  <div className="space-y-2">
                    {q.options.map((opt, oIdx) => (
                      <label key={oIdx} className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 transition-colors">
                        <input 
                          type="radio" 
                          name={q.id || `q_${idx}`} 
                          value={opt}
                          onChange={(e) => setUserAnswers({ ...userAnswers, [q.id || `q_${idx}`]: e.target.value })}
                          required
                          className="text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-slate-300 font-medium">{opt}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              {mcqList.map((mcq, idx) => (
                <div key={mcq.id || idx} className="space-y-3 bg-slate-950 p-5 rounded-xl border border-slate-800">
                  <p className="text-sm font-bold text-emerald-400">MCQ Diagnostic {idx + 1}: {mcq.stem}</p>
                  <div className="space-y-2">
                    {mcq.choices.map((choice, cIdx) => (
                      <label key={cIdx} className="flex items-center gap-3 p-3 bg-slate-900 border border-slate-800 rounded-lg cursor-pointer hover:border-slate-700 transition-colors">
                        <input 
                          type="radio" 
                          name={mcq.id || `mcq_${idx}`} 
                          value={choice}
                          onChange={(e) => setMcqAnswers({ ...mcqAnswers, [mcq.id || `mcq_${idx}`]: e.target.value })}
                          required
                          className="text-emerald-500 focus:ring-emerald-500"
                        />
                        <span className="text-xs text-slate-300 font-medium">{choice}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}

              <button 
                type="submit" 
                disabled={loading}
                className="w-full bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-black py-4 rounded-xl transition-colors cursor-pointer disabled:opacity-50 text-sm shadow-xl shadow-emerald-900/30 uppercase tracking-wider"
              >
                {loading ? 'Synthesizing Strategic Blueprint...' : 'Compute Final Strategic Blueprint'}
              </button>
            </form>
          )}

          {step === 'result' && report && (
            <div className="w-full space-y-6 bg-slate-900 border border-slate-800 p-8 rounded-2xl shadow-2xl">
              <div className="flex justify-between items-center border-b border-slate-800 pb-4">
                <div>
                  <span className="text-xs font-black uppercase tracking-wider text-emerald-400">Confidence Rating: {report.confidence}</span>
                  <h2 className="text-2xl font-black text-slate-100">{title || 'Simulation Report'}</h2>
                </div>
                <button 
                  onClick={() => { setStep('form'); setReport(null); setDescription(''); setTitle(''); setContext(''); setUserAnswers({}); setMcqAnswers({}); }}
                  className="text-xs bg-slate-800 hover:bg-slate-700 text-slate-300 px-4 py-2 rounded-xl transition-colors border border-slate-700 font-semibold"
                >
                  New Scenario
                </button>
              </div>

              <div className="flex border-b border-slate-800 gap-6 overflow-x-auto">
                <button 
                  onClick={() => setActiveTab('pathway')}
                  className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer whitespace-nowrap ${activeTab === 'pathway' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                  Action Pathway & Risk
                </button>
                <button 
                  onClick={() => setActiveTab('template')}
                  className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer whitespace-nowrap ${activeTab === 'template' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                  Communication Template
                </button>
                <button 
                  onClick={() => setActiveTab('chat')}
                  className={`pb-3 text-xs font-bold uppercase tracking-wider border-b-2 transition-colors cursor-pointer whitespace-nowrap ${activeTab === 'chat' ? 'border-emerald-500 text-emerald-400' : 'border-transparent text-slate-400 hover:text-slate-200'}`}
                >
                  Consult VERLO AI ({chatMessages.length})
                </button>
              </div>

              {activeTab === 'pathway' && (
                <div className="space-y-6">
                  <div className="grid grid-cols-1 md:grid-cols-3 gap-4 bg-slate-950 p-5 rounded-xl border border-slate-800">
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Severity Score</span>
                      <span className="text-xl font-black text-amber-400">{report.riskAssessment?.severityScore}/10</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Financial Exposure</span>
                      <span className="text-xs text-slate-300 font-semibold">{report.riskAssessment?.financialExposure}</span>
                    </div>
                    <div>
                      <span className="text-[10px] uppercase font-bold text-slate-500 block">Time Sensitivity</span>
                      <span className="text-xs text-slate-300 font-semibold">{report.riskAssessment?.timeSensitivity}</span>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Situation Summary</h3>
                    <p className="text-sm text-slate-300 bg-slate-950 p-4 rounded-xl border border-slate-800 leading-relaxed font-medium">{report.situation}</p>
                  </div>

                  <div className="space-y-3">
                    <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Step-by-Step Action Pathway</h3>
                    {report.nextSteps?.map((stepItem, idx) => (
                      <div key={idx} className="bg-slate-950 p-5 rounded-xl border border-slate-800 space-y-2">
                        <div className="flex items-center gap-2">
                          <span className="bg-emerald-500/10 text-emerald-400 text-xs px-2.5 py-0.5 rounded font-mono border border-emerald-500/20 font-bold">Step {idx + 1}</span>
                          <h4 className="text-sm font-bold text-slate-200">{stepItem.step}</h4>
                        </div>
                        <p className="text-xs text-slate-400 leading-relaxed"><strong className="text-slate-300">Why:</strong> {stepItem.why}</p>
                        {stepItem.pitfallWarning && (
                          <p className="text-xs text-amber-400/90 bg-amber-950/20 p-2.5 rounded-lg border border-amber-900/30"><strong className="text-amber-400 font-bold">Watch out:</strong> {stepItem.pitfallWarning}</p>
                        )}
                      </div>
                    ))}
                  </div>

                  {report.options?.length > 0 && (
                    <div className="space-y-3">
                      <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Strategic Alternatives</h3>
                      {report.options.map((opt, idx) => (
                        <div key={idx} className="bg-slate-950 p-4 rounded-xl border border-slate-800 space-y-1">
                          <h4 className="text-xs font-bold text-slate-200">{opt.title}</h4>
                          <p className="text-xs text-slate-400"><strong className="text-slate-300">Best For:</strong> {opt.bestFor}</p>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'template' && (
                <div className="space-y-4">
                  <h3 className="text-xs font-bold uppercase tracking-wider text-slate-400">Formal Communication Template</h3>
                  {report.draftTemplate ? (
                    <div className="bg-slate-950 p-6 rounded-xl border border-slate-800 space-y-3 font-mono text-xs text-slate-300">
                      <p><strong className="text-slate-400">To:</strong> {report.draftTemplate.recipient}</p>
                      <p><strong className="text-slate-400">Subject:</strong> {report.draftTemplate.subject}</p>
                      <hr className="border-slate-800 my-3" />
                      <p className="whitespace-pre-wrap font-sans text-slate-300 leading-relaxed font-medium">{report.draftTemplate.body}</p>
                    </div>
                  ) : (
                    <p className="text-xs text-slate-500">No template generated for this pathway.</p>
                  )}
                </div>
              )}

              {activeTab === 'chat' && (
                <div className="space-y-4">
                  <div className="bg-slate-950 border border-slate-800 rounded-xl p-4 h-96 overflow-y-auto space-y-4 flex flex-col">
                    {chatMessages.map((msg, idx) => (
                      <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                        <div className={`max-w-[80%] p-4 rounded-2xl text-xs leading-relaxed font-medium ${msg.role === 'user' ? 'bg-emerald-600 text-slate-950 font-bold' : 'bg-slate-900 text-slate-200 border border-slate-800'}`}>
                          {msg.content}
                        </div>
                      </div>
                    ))}
                    {chatLoading && (
                      <div className="flex justify-start">
                        <div className="bg-slate-900 text-slate-400 border border-slate-800 p-3 rounded-2xl text-xs animate-pulse font-medium">
                          VERLO AI is analyzing follow-up telemetry...
                        </div>
                      </div>
                    )}
                    <div ref={chatBottomRef} />
                  </div>
                  <form onSubmit={handleChatSubmit} className="flex gap-2">
                    <input 
                      type="text" 
                      value={chatInput} 
                      onChange={(e) => setChatInput(e.target.value)}
                      placeholder="Ask a tactical follow-up question..."
                      className="flex-1 bg-slate-950 border border-slate-800 rounded-xl p-3 text-xs text-slate-200 focus:outline-none focus:border-emerald-500 font-medium"
                    />
                    <button 
                      type="submit" 
                      disabled={chatLoading}
                      className="bg-emerald-600 hover:bg-emerald-500 text-slate-950 font-extrabold px-6 rounded-xl transition-colors cursor-pointer text-xs uppercase tracking-wider"
                    >
                      Send
                    </button>
                  </form>
                </div>
              )}
            </div>
          )}
        </main>
      )}
    </div>
  );
}