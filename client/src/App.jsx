import React, { useState, useEffect } from 'react';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001';

export default function App() {
  const [step, setStep] = useState('landing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [userContext, setUserContext] = useState('');
  const [analysisData, setAnalysisData] = useState(null);
  const [processingStage, setProcessingStage] = useState(0);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

  // Chat follow-up state
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Persistent Auth state using localStorage
  const [currentUser, setCurrentUser] = useState(() => {
    try {
      const savedUser = localStorage.getItem('verlo_user');
      return savedUser ? JSON.parse(savedUser) : null;
    } catch (e) {
      return null;
    }
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login');
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  
  // History state
  const [userHistory, setUserHistory] = useState([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const processingSteps = [
    "Initializing neural decision matrix...",
    "Executing safety & protocol compliance audit...",
    "Calculating vector risk exposure & temporal criticality...",
    "Synthesizing structured strategic pathway...",
    "Finalizing enterprise deployment parameters..."
  ];

  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
  const MIN_WORDS = 5;

  useEffect(() => {
    if (currentUser && currentUser.id) {
      localStorage.setItem('verlo_user', JSON.stringify(currentUser));
      fetch(`${API_URL}/api/history/${currentUser.id}`)
        .then(res => res.json())
        .then(data => {
          if (data.history) setUserHistory(data.history);
        })
        .catch(err => console.error('Failed to load history', err));
    } else {
      localStorage.removeItem('verlo_user');
      setUserHistory([]);
    }
  }, [currentUser]);

  const handleExampleSelect = (exTitle, exDesc, exContext) => {
    setTitle(exTitle);
    setDescription(exDesc);
    setUserContext(exContext);
    setStep('input');
    setError(null);
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();
    setAuthError(null);
    const endpoint = authMode === 'login' ? '/api/auth/login' : '/api/auth/signup';

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: authEmail.trim(), password: authPassword })
      });
      const data = await res.json();

      if (!res.ok) {
        throw new Error(data.error || 'Authentication failed');
      }

      setCurrentUser(data.user);
      setShowAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('verlo_user');
    setUserHistory([]);
    setStep('landing');
  };

  const handleSaveToAccount = async (resultData) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/history/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          userId: currentUser.id, 
          report: { title: title || 'Untitled Enterprise Audit', description, result: resultData } 
        })
      });
      const data = await res.json();
      if (data.history) {
        setUserHistory(data.history);
        alert('Pathway successfully archived to account secure storage.');
      }
    } catch (err) {
      console.error('Failed to save history', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (wordCount < MIN_WORDS) {
      setError(`Please provide comprehensive operational details (at least ${MIN_WORDS} words) to generate a high-fidelity pathway.`);
      return;
    }

    setError(null);
    setStep('processing');
    setProcessingStage(0);

    let apiPromise;
    try {
      apiPromise = fetch(`${API_URL}/api/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, context: userContext }),
      });
    } catch (err) {
      setError('Could not connect to Verlo engine server. Verify backend connectivity.');
      setStep('input');
      return;
    }

    let currentStage = 0;
    const intervalTime = 700; 

    const interval = setInterval(() => {
      currentStage += 1;
      if (currentStage < processingSteps.length) {
        setProcessingStage(currentStage);
      } else {
        clearInterval(interval);
      }
    }, intervalTime);

    try {
      const totalAnimationTime = processingSteps.length * intervalTime;
      const [res] = await Promise.all([
        apiPromise,
        new Promise(resolve => setTimeout(resolve, totalAnimationTime))
      ]);

      const result = await res.json();

      if (!res.ok) {
        clearInterval(interval);
        setError(result.error || 'Enterprise safety protocols restricted processing.');
        setStep('input');
        return;
      }

      setAnalysisData(result.data);
      setChatHistory([]);
      setStep('results');
    } catch (err) {
      clearInterval(interval);
      setError(err.message || 'Could not connect to Verlo backend.');
      setStep('input');
    }
  };

  const handleCopyDraft = () => {
    if (!analysisData?.draftTemplate) return;
    const textToCopy = `To: ${analysisData.draftTemplate.recipient}\nSubject: ${analysisData.draftTemplate.subject}\n\n${analysisData.draftTemplate.body}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setTimeout(() => setCopied(false), 3000);
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();
    if (!chatQuestion.trim() || isChatLoading) return;

    const questionText = chatQuestion.trim();
    setChatQuestion('');
    setIsChatLoading(true);

    const newHistory = [...chatHistory, { role: 'user', content: questionText }];
    setChatHistory(newHistory);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: questionText, 
          currentSituation: description || title 
        })
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Failed to generate advisory response.');

      setChatHistory([...newHistory, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setChatHistory([...newHistory, { role: 'assistant', content: `System Error: ${err.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="verlo-app-shell">
      
      {/* Top Enterprise Navigation Bar */}
      <header className="verlo-topnav">
        <div className="verlo-nav-brand" onClick={() => setStep('landing')}>
          <img src="/VVNormal.png" alt="Verlo Enterprise Logo" className="brand-logo-img" />
          <span className="brand-text">VERLO<span className="brand-badge-tag">ENTERPRISE</span></span>
        </div>
        <div className="verlo-nav-actions">
          {currentUser ? (
            <div className="user-session-cluster">
              <button 
                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                className="nav-btn secondary-action"
              >
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                <span>Archives ({userHistory.length})</span>
              </button>
              <div className="user-id-badge">
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                <span>{currentUser.email}</span>
              </div>
              <button onClick={handleLogout} className="nav-btn logout-action">
                <span>Sign Out</span>
              </button>
            </div>
          ) : (
            <button 
              onClick={() => { setAuthMode('login'); setAuthError(null); setShowAuthModal(true); }}
              className="nav-btn primary-action"
            >
              <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/></svg>
              <span>Authentication</span>
            </button>
          )}
        </div>
      </header>

      {/* Main Container Viewport */}
      <main className="verlo-main-viewport">
        {step === 'landing' && (
          <div className="page-transition landing-view" key="landing">
            <div className="hero-container">
              <div className="hero-badge">
                <span className="pulse-dot"></span>
                <span>AI-Powered Decision Intelligence Engine</span>
              </div>
              <h1 className="hero-title">Eliminate operational ambiguity. Execute with absolute clarity.</h1>
              <p className="hero-subtitle">
                Transform complex administrative bottlenecks, disputes, and structural crises into comprehensive, risk-assessed execution pathways instantly.
              </p>
              
              <div className="hero-cta-group">
                <button className="btn-enterprise-primary" onClick={() => setStep('input')}>
                  <span>Deploy Intelligence Engine</span>
                  <svg className="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
              </div>

              {/* Comprehensive Examples Grid */}
              <div className="examples-section">
                <div className="section-header-title">
                  <svg className="section-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="12 2 2 7 12 12 22 7 12 2"/><polyline points="2 17 12 22 22 17"/><polyline points="2 12 12 17 22 12"/></svg>
                  <span>Select Pre-Engineered Enterprise Scenario:</span>
                </div>
                
                <div className="examples-grid">
                  <div 
                    className="example-card"
                    onClick={() => handleExampleSelect(
                      'International Flight Cancellation & Denial of Care', 
                      'Long-haul international flight abruptly cancelled at the departure terminal due to structural mechanical failure. Carrier desk personnel are refusing rebooking for 72 hours and denying mandatory overnight hotel accommodation vouchers despite connecting itinerary.',
                      'Corporate executive traveling on critical timeline for merger execution'
                    )}
                  >
                    <div className="card-top-row">
                      <svg className="card-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17.8 19.2 16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.5 1.2c-.2.4 0 .9.4 1.1l5 2.5-2 2-2.5-.5c-.4-.1-.9.1-1.1.5l-.4 1.1c-.2.4 0 .9.4 1.1l4 2 2 4c.2.4.7.6 1.1.4l1.1-.4c.4-.2.6-.7.5-1.1l-.5-2.5 2-2 2.5 5c.2.4.7.6 1.1.4l1.2-.5c.4-.2.6-.7.5-1.1z"/></svg>
                      <span className="tag-pill">Transit & Logistics</span>
                    </div>
                    <h4>Flight Cancellation Dispute</h4>
                    <p>Carrier refusing accommodation & immediate rebooking past regulatory threshold.</p>
                  </div>

                  <div 
                    className="example-card"
                    onClick={() => handleExampleSelect(
                      'Enterprise SaaS Unauthorized Billing Charge', 
                      'Detected an unauthorized $2,450 recurring charge on corporate card for an enterprise software suite that was formally terminated in writing 90 days prior. Account management support is failing to respond to escalation tickets.',
                      'Operations director managing strictly allocated departmental budget'
                    )}
                  >
                    <div className="card-top-row">
                      <svg className="card-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                      <span className="tag-pill">Financial Compliance</span>
                    </div>
                    <h4>Unauthorized SaaS Billing</h4>
                    <p>Subscription charged post-cancellation with zero responsiveness from merchant support.</p>
                  </div>

                  <div 
                    className="example-card"
                    onClick={() => handleExampleSelect(
                      'Commercial Lease Security Deposit Retention', 
                      'Commercial landlord has withheld a $15,000 corporate facility security deposit for over 60 days past lease expiration without itemized deductions or formal damage reports, ignoring legal demand notices.',
                      'Tech startup scaling workspace logistics'
                    )}
                  >
                    <div className="card-top-row">
                      <svg className="card-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                      <span className="tag-pill">Real Estate / Legal</span>
                    </div>
                    <h4>Unreturned Security Deposit</h4>
                    <p>Landlord withholding major capital funds past statutory return deadline.</p>
                  </div>

                  <div 
                    className="example-card"
                    onClick={() => handleExampleSelect(
                      'Breach of Vendor Service Level Agreement (SLA)', 
                      'Primary cloud infrastructure vendor experienced critical sustained downtime violating contracted 99.99% uptime SLA, resulting in severe client transaction failures and documented revenue loss.',
                      'CTO managing enterprise infrastructure dependencies'
                    )}
                  >
                    <div className="card-top-row">
                      <svg className="card-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/><polyline points="3.27 6.96 12 12.01 20.73 6.96"/><line x1="12" y1="22.08" x2="12" y2="12"/></svg>
                      <span className="tag-pill">Contractual Dispute</span>
                    </div>
                    <h4>Vendor SLA Breach</h4>
                    <p>Sustained operational downtime triggering penalty clause requirements.</p>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'input' && (
          <div className="page-transition input-view" key="input">
            <div className="input-container-wrapper">
              <div className="back-nav-row">
                <button onClick={() => setStep('landing')} className="nav-btn secondary-action">
                  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                  <span>Return to Overview</span>
                </button>
              </div>

              <div className="input-header">
                <h2>Configure Situation Parameters</h2>
                <p>Provide comprehensive context to initialize algorithmic decomposition and risk weighting.</p>
              </div>

              {error && (
                <div className="error-alert-banner">
                  <svg className="alert-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                  <span>{error}</span>
                </div>
              )}

              <form onSubmit={handleSubmit} className="verlo-form-card">
                <div className="form-group">
                  <label className="form-label">Situation Identifier / Title (Optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g., Q3 Vendor SLA Non-Compliance Dispute" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <div className="label-flex">
                    <label className="form-label">Detailed Case Description *</label>
                    <span className={`word-counter-badge ${wordCount < MIN_WORDS ? 'warning' : 'valid'}`}>
                      {wordCount} words {wordCount < MIN_WORDS ? `(Min ${MIN_WORDS})` : '✓ Ready'}
                    </span>
                  </div>
                  <textarea 
                    className="form-textarea" 
                    placeholder="Detail chronological events, monetary amounts, communications history, and desired corporate/legal resolution..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Operational Constraints & Context (Optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g., Strict litigation budget, operating under tight deadlines" 
                    value={userContext}
                    onChange={(e) => setUserContext(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-enterprise-primary full-width">
                  <span>Execute Neural Pathway Analysis</span>
                  <svg className="btn-arrow" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="5" y1="12" x2="19" y2="12"/><polyline points="12 5 19 12 12 19"/></svg>
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="page-transition processing-viewport" key="processing">
            <div className="processing-core-cluster">
              <div className="processing-pulse-beacon"></div>
              <h2>Executing Neural Engine Pipeline</h2>
              <p>Analyzing parameters across multimodal vector models...</p>
              
              <div className="processing-steps-list">
                {processingSteps.map((text, idx) => {
                  const isDone = idx < processingStage;
                  const isActive = idx === processingStage;
                  return (
                    <div key={idx} className={`processing-step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                      <span className="step-text">{text}</span>
                      <span className="step-status-icon">{isDone ? '✓' : isActive ? '●' : '○'}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        )}

        {step === 'results' && analysisData && (
          <div className="page-transition results-viewport" key="results">
            
            {/* Results Action Toolbar */}
            <div className="results-toolbar">
              <div className="toolbar-cluster-left">
                <button onClick={() => setStep('input')} className="nav-btn secondary-action">
                  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="19" y1="12" x2="5" y2="12"/><polyline points="12 19 5 12 12 5"/></svg>
                  <span>Reconfigure Situation</span>
                </button>
                <button onClick={() => handleSaveToAccount(analysisData)} className="nav-btn success-action">
                  <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                  <span>Archive to Account</span>
                </button>
              </div>
              <button onClick={() => setStep('landing')} className="nav-btn text-action">
                <span>Start New Analysis</span>
              </button>
            </div>

            {/* Risk Assessment Summary Matrix */}
            <div className="metric-summary-card">
              <div className="metric-left-col">
                <div className={`confidence-pill ${analysisData.confidence?.toLowerCase()}`}>
                  Confidence Index: {analysisData.confidence}
                </div>
                {userContext && <div className="context-subtext">Context applied: <em>"{userContext}"</em></div>}
              </div>
              <div className="metric-right-grid">
                <div className="metric-node">
                  <span className="metric-label">Severity Score</span>
                  <span className={`metric-val ${Number(analysisData.riskAssessment?.severityScore) > 7 ? 'danger' : 'warning'}`}>
                    {analysisData.riskAssessment?.severityScore}/10
                  </span>
                </div>
                <div className="metric-node">
                  <span className="metric-label">Financial Exposure</span>
                  <span className="metric-val">{analysisData.riskAssessment?.financialExposure}</span>
                </div>
                <div className="metric-node">
                  <span className="metric-label">Time Criticality</span>
                  <span className="metric-val">{analysisData.riskAssessment?.timeSensitivity}</span>
                </div>
              </div>
            </div>

            {/* Immediate Dominant Priority Action */}
            <div className="dominant-priority-card">
              <div className="priority-header-tag">
                <svg className="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polygon points="13 2 3 14 12 14 11 22 21 10 12 10 13 2"/></svg>
                <span>Immediate Priority Action</span>
              </div>
              <h2>{analysisData.nextSteps?.[0]?.step || "Evaluate execution parameters below."}</h2>
              <p><strong>Strategic Rationale:</strong> {analysisData.nextSteps?.[0]?.why || "Establishes authoritative baseline posture."}</p>
            </div>

            {/* Comprehensive Action Pathway Grid */}
            <div className="content-section-box">
              <h3>
                <svg className="section-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                <span>Comprehensive Sequential Action Pathway</span>
              </h3>
              <div className="pathway-steps-stack">
                {analysisData.nextSteps?.map((item, idx) => (
                  <div key={idx} className="pathway-step-node">
                    <div className="step-num-circle">{idx + 1}</div>
                    <div className="step-content-body">
                      <h4>{item.step}</h4>
                      <p><strong>Rationale:</strong> {item.why}</p>
                      {item.pitfallWarning && (
                        <p className="pitfall-text"><strong>Pitfall Warning:</strong> {item.pitfallWarning}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>

            {/* Evaluated Strategic Options Matrix */}
            {analysisData.options && analysisData.options.length > 0 && (
              <div className="content-section-box">
                <h3>
                  <svg className="section-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                  <span>Evaluated Strategic Alternatives</span>
                </h3>
                <div className="options-grid-stack">
                  {analysisData.options.map((opt, i) => (
                    <div key={i} className="option-card-node">
                      <div className="option-title">{opt.title}</div>
                      <div className="option-bestfor"><strong>Optimal Utility:</strong> {opt.bestFor}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Situation Summary Overview */}
            <div className="content-section-box">
              <h3>
                <svg className="section-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                <span>Situation Analysis Summary</span>
              </h3>
              <p className="summary-desc-text">{analysisData.situation}</p>
            </div>

            {/* Verification Checklist */}
            {analysisData.verificationNeeded && analysisData.verificationNeeded.length > 0 && (
              <div className="content-section-box surface-muted">
                <h3>
                  <svg className="section-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                  <span>Mandatory Fact-Checking & Verification Items</span>
                </h3>
                <ul className="verification-bullet-list">
                  {analysisData.verificationNeeded.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Automated Resolution Letter Template */}
            {analysisData.draftTemplate && (
              <div className="content-section-box accent-border">
                <div className="draft-header-row">
                  <h3>
                    <svg className="section-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                    <span>Automated Enterprise Resolution Document</span>
                  </h3>
                  <button onClick={handleCopyDraft} className="nav-btn primary-action">
                    {copied ? 'Copied to Clipboard' : 'Copy Draft Document'}
                  </button>
                </div>
                <div className="code-template-block">
                  {`To: ${analysisData.draftTemplate.recipient}\nSubject: ${analysisData.draftTemplate.subject}\n\n${analysisData.draftTemplate.body}`}
                </div>
              </div>
            )}

            {/* Contextual Advisory Assistant Chat */}
            <div className="content-section-box">
              <h3>
                <svg className="section-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                <span>Consult Verlo Advisory Engine</span>
              </h3>
              <p className="chat-subtext">Engage the active AI decision assistant for tactical scenario refinement and follow-up correspondence drafting:</p>
              
              {chatHistory.length > 0 && (
                <div className="chat-history-stack">
                  {chatHistory.map((msg, index) => (
                    <div key={index} className={`chat-bubble-node ${msg.role}`}>
                      <strong>{msg.role === 'user' ? 'Authorized Operator' : 'Verlo Intelligence'}</strong>
                      <div className="bubble-content">{msg.content}</div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleChatSubmit} className="chat-input-cluster">
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., What are the enforcement implications if they default on response timeline?" 
                  value={chatQuestion}
                  onChange={(e) => setChatQuestion(e.target.value)}
                  disabled={isChatLoading}
                />
                <button type="submit" className="btn-enterprise-primary chat-submit-btn" disabled={isChatLoading}>
                  {isChatLoading ? 'Processing...' : 'Transmit Query'}
                </button>
              </form>
            </div>

            {/* ⚠️ Pure Red Critical Warning Footer Banner */}
            <div className="critical-red-warning-banner">
              <svg className="warning-ico" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3Z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
              <div>
                <strong>CRITICAL COMPLIANCE NOTICE & LEGAL VERIFICATION MANDATE</strong>
                Verlo is an artificial intelligence decision-intelligence tool designed exclusively for structured operational guidance. Automated recommendations, risk metrics, and contract templates must be independently verified by licensed legal, financial, or technical counsel before executing high-exposure commitments or binding agreements.
              </div>
            </div>

          </div>
        )}
      </main>

      {/* Full-Width Pinned Ground Footer */}
      <footer className="verlo-ground-footer">
        <div className="footer-content-inner">
          <div className="footer-brand-cluster">
            <img src="/VVNormal.png" alt="Verlo Logo" className="footer-logo" />
            <span className="footer-brand-title">VERLO ENTERPRISE INTELLIGENCE</span>
          </div>
          <div className="footer-copyright-text">
            &copy; {new Date().getFullYear()} Verlo Systems Inc. All enterprise rights reserved. Secure cryptographic decision architecture.
          </div>
        </div>
      </footer>

      {/* Archives History Drawer */}
      {showHistoryDrawer && (
        <div className="history-drawer-overlay">
          <div className="history-drawer-panel">
            <div className="drawer-header">
              <h3>Archived Pathways</h3>
              <button onClick={() => setShowHistoryDrawer(false)} className="drawer-close-btn">✕</button>
            </div>
            {userHistory.length === 0 ? (
              <p className="drawer-empty-text">No archived reports found. Use "Archive to Account" on any analysis outcome screen.</p>
            ) : (
              <div className="drawer-list-stack">
                {userHistory.map((item, idx) => (
                  <div 
                    key={idx} 
                    onClick={() => {
                      setTitle(item.title);
                      setDescription(item.description);
                      setAnalysisData(item.result);
                      setStep('results');
                      setShowHistoryDrawer(false);
                    }}
                    className="drawer-item-node"
                  >
                    <div className="drawer-item-title">{item.title}</div>
                    <div className="drawer-item-date">{new Date(item.timestamp).toLocaleDateString()}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Authentication Modal */}
      {showAuthModal && (
        <div className="auth-modal-overlay">
          <div className="auth-modal-card">
            <div className="auth-modal-header">
              <h3>{authMode === 'login' ? 'Enterprise Operator Login' : 'Register Operator Account'}</h3>
              <button onClick={() => setShowAuthModal(false)} className="drawer-close-btn">✕</button>
            </div>

            {authError && <div className="error-alert-banner">{authError}</div>}

            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label className="form-label">Corporate Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Secure Access Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)} 
                  required 
                />
              </div>

              <button type="submit" className="btn-enterprise-primary full-width" style={{ marginTop: '1rem' }}>
                <span>{authMode === 'login' ? 'Authenticate Session' : 'Initialize Account'}</span>
              </button>
            </form>

            <div className="auth-switch-row">
              {authMode === 'login' ? (
                <span>Need an operator profile? <button onClick={() => setAuthMode('signup')} className="text-link-btn">Register</button></span>
              ) : (
                <span>Already registered? <button onClick={() => setAuthMode('login')} className="text-link-btn">Log In</button></span>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}