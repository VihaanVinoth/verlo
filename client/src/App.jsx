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
    "Deciphering the core strategic goal...",
    "Screening through moderation & safety filters...",
    "Evaluating risk severity & exposure metrics...",
    "Synthesizing customized action pathway...",
    "Finalizing tactical recommendations..."
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
          report: { title: title || 'Unnamed Request', description, result: resultData } 
        })
      });
      const data = await res.json();
      if (data.history) {
        setUserHistory(data.history);
        alert('Pathway saved successfully to your account history!');
      }
    } catch (err) {
      console.error('Failed to save history', err);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (wordCount < MIN_WORDS) {
      setError(`Please provide a bit more detail (at least ${MIN_WORDS} words) so Verlo can build a reliable pathway.`);
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
      setError('Could not connect to Verlo server. Is the backend running?');
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
        setError(result.error || 'Content restricted or engine calculation failed.');
        setStep('input');
        return;
      }

      setAnalysisData(result.data);
      setChatHistory([]); // Reset chat history for new diagnosis
      setStep('results');
    } catch (err) {
      clearInterval(interval);
      setError(err.message || 'Could not connect to Verlo server.');
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
      if (!res.ok) throw new Error(data.error || 'Failed to get chat response.');

      setChatHistory([...newHistory, { role: 'assistant', content: data.reply }]);
    } catch (err) {
      setChatHistory([...newHistory, { role: 'assistant', content: `⚠️ Error: ${err.message}` }]);
    } finally {
      setIsChatLoading(false);
    }
  };

  return (
    <div className="verlo-app">
      
      {/* Top Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '1rem 2rem', gap: '1rem' }}>
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <button 
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              📁 Saved History ({userHistory.length})
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>👤 {currentUser.email}</span>
            <button 
              onClick={handleLogout} 
              style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--danger)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Logout
            </button>
          </div>
        ) : (
          <button 
            onClick={() => { setAuthMode('login'); setAuthError(null); setShowAuthModal(true); }}
            style={{ background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
          >
            Login / Signup
          </button>
        )}
      </div>

      {/* Main Content Area */}
      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column' }}>
        {step === 'landing' && (
          <div className="page-transition" key="landing">
            <div className="verlo-header" style={{ marginTop: '2rem' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem', width: '100%' }}>
                <img src="/VVNormal.png" alt="Verlo Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                <span className="verlo-brand" style={{ margin: 0 }}>VERLO</span>
              </div>
              <h1 className="verlo-title">Stop guessing. Know your exact next step.</h1>
              <p className="verlo-subtitle" style={{ marginBottom: '2.5rem' }}>
                An ethical decision-intelligence system that transforms messy, stressful situations into a fully tailored, risk-scored action pathway.
              </p>
              <button className="btn-primary" style={{ maxWidth: '300px', margin: '0 auto 3rem' }} onClick={() => setStep('input')}>
                Launch Decision Engine →
              </button>

              <div style={{ textAlign: 'left', maxWidth: '650px', margin: '0 auto 4rem' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Test common administrative scenarios:
                </p>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  <div 
                    className="verlo-card" 
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', marginBottom: 0 }}
                    onClick={() => handleExampleSelect(
                      'Flight cancelled at gate', 
                      'My international flight was abruptly cancelled at the boarding gate due to mechanical failure. The airline desk agent says the earliest they can rebook me is in 48 hours, and they are refusing to cover hotel accommodations for the night despite my connecting ticket.',
                      'Traveling on a strict budget for an important family event'
                    )}
                  >
                    ✈️ <strong>Flight cancelled at gate</strong> &mdash; Airline refusing overnight hotel voucher.
                  </div>
                  <div 
                    className="verlo-card" 
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', marginBottom: 0 }}
                    onClick={() => handleExampleSelect(
                      'Unresolved billing charge', 
                      'I noticed an unexpected $450 charge on my credit card from a software enterprise subscription that I explicitly cancelled three months ago in writing. Support is ignoring my emails and chat tickets.',
                      'Freelancer relying on tight monthly cash flow'
                    )}
                  >
                    💳 <strong>Unresolved billing dispute</strong> &mdash; Subscription charged post-cancellation.
                  </div>
                  <div 
                    className="verlo-card" 
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', marginBottom: 0 }}
                    onClick={() => handleExampleSelect(
                      'Unreturned apartment deposit', 
                      'My landlord has withheld my full $1,800 security deposit for over 45 days past lease termination without itemized deduction notices or damage reports, and is now ignoring my phone calls.',
                      'First-time renter moving to a new state'
                    )}
                  >
                    🏠 <strong>Unreturned security deposit</strong> &mdash; Landlord withholding funds past legal deadline.
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'input' && (
          <div className="page-transition" key="input" style={{ flex: 1 }}>
            <div style={{ maxWidth: '650px', margin: '0 auto', padding: '0 1rem 3rem' }}>
              <div style={{ marginBottom: '1.5rem' }}>
                <button 
                  onClick={() => setStep('landing')}
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                >
                  ← Back to Overview
                </button>
              </div>

              <div className="verlo-header" style={{ marginTop: '1rem', marginBottom: '2rem' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem', width: '100%' }}>
                  <img src="/VVNormal.png" alt="Verlo Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                  <span className="verlo-brand" style={{ margin: 0 }}>VERLO</span>
                </div>
                <h2 className="verlo-title" style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Define Your Situation</h2>
                <p className="verlo-subtitle" style={{ margin: 0 }}>Provide the details below so the engine can formulate your tailored pathway.</p>
              </div>

              {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>{error}</div>}

              <form onSubmit={handleSubmit} className="verlo-card">
                <div className="form-group">
                  <label className="form-label">Situation Title (Optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g., Landlord deposit dispute" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Describe what happened *</label>
                    <span style={{ fontSize: '0.8rem', color: wordCount < MIN_WORDS ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {wordCount} words {wordCount < MIN_WORDS ? `(Minimum ${MIN_WORDS} required)` : '✓'}
                    </span>
                  </div>
                  <textarea 
                    className="form-textarea" 
                    placeholder="Include key details: dates, amounts, communications, and what outcome you are looking for..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">Any specific personal context or constraints? (Optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g., I'm a student living on a tight budget" 
                    value={userContext}
                    onChange={(e) => setUserContext(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-primary">
                  Compute Tailored Pathway →
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="page-transition processing-container" key="processing" style={{ flex: 1 }}>
            <div className="processing-pulse-ring"></div>
            <h2 style={{ fontSize: '1.5rem', marginTop: '0.5rem' }}>Synthesizing personalized logic...</h2>
            
            <div className="processing-steps">
              {processingSteps.map((text, idx) => {
                const isDone = idx < processingStage;
                const isActive = idx === processingStage;
                return (
                  <div key={idx} className={`step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`}>
                    <span>{text}</span>
                    <span>{isDone ? '✓' : isActive ? '●' : '○'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 'results' && analysisData && (
          <div className="page-transition" key="results" style={{ maxWidth: '800px', margin: '0 auto', padding: '0 1rem 3rem', flex: 1 }}>
            
            {/* Top Navigation Bar inside Results */}
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
              <div style={{ display: 'flex', gap: '0.75rem' }}>
                <button 
                  onClick={() => setStep('input')}
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  ← Edit Situation
                </button>
                <button 
                  onClick={() => handleSaveToAccount(analysisData)}
                  style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}
                >
                  💾 Save to Account
                </button>
              </div>
              <button 
                onClick={() => setStep('landing')} 
                style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer' }}
              >
                Start Over
              </button>
            </div>

            {/* ⚠️ Ethical Verification & Fact-Checking Warning Banner */}
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid rgba(245, 158, 11, 0.4)', padding: '1rem 1.25rem', borderRadius: '8px', marginBottom: '1.5rem', fontSize: '0.85rem', color: 'var(--warning)', display: 'flex', gap: '0.75rem', alignItems: 'flex-start' }}>
              <span style={{ fontSize: '1.2rem', lineHeight: 1 }}>⚠️</span>
              <div>
                <strong style={{ display: 'block', marginBottom: '0.2rem', color: 'var(--text-main)' }}>Ethical Notice & Information Verification Required</strong>
                Verlo is an AI decision-intelligence assistant designed to structure administrative pathways. AI models can occasionally misstate rules, statutes, or deadlines. Please independently verify all critical claims, contract terms, legal deadlines, or financial obligations before executing high-stakes actions.
              </div>
            </div>

            {/* Risk Assessment Summary Bar */}
            <div className="result-section" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-surface)' }}>
              <div>
                <span className={`badge ${analysisData.confidence?.toLowerCase()}`} style={{ marginBottom: '0.25rem' }}>
                  Confidence: {analysisData.confidence}
                </span>
                {userContext && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tailored for: <em>"{userContext}"</em></div>}
              </div>
              <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem' }}>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Severity Score:</span><br/>
                  <strong style={{ color: Number(analysisData.riskAssessment?.severityScore) > 7 ? 'var(--danger)' : 'var(--warning)' }}>
                    {analysisData.riskAssessment?.severityScore}/10
                  </strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Financial Exposure:</span><br/>
                  <strong>{analysisData.riskAssessment?.financialExposure}</strong>
                </div>
                <div>
                  <span style={{ color: 'var(--text-muted)' }}>Urgency:</span><br/>
                  <strong>{analysisData.riskAssessment?.timeSensitivity}</strong>
                </div>
              </div>
            </div>

            {/* Dominant Action Card */}
            <div className="dominant-action">
              <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '0.5rem' }}>
                👉 Immediate Priority Action
              </h3>
              <h2>{analysisData.nextSteps?.[0]?.step || "Review strategic options below."}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: 0 }}>
                <strong>Why this first:</strong> {analysisData.nextSteps?.[0]?.why || "Establishes your foundational position."}
              </p>
            </div>

            {/* Full Step-by-Step Action Pathway */}
            <div className="result-section">
              <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>📋 Full Step-by-Step Action Pathway</h3>
              <div style={{ display: 'grid', gap: '1rem' }}>
                {analysisData.nextSteps?.map((item, idx) => (
                  <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '1rem', borderRadius: '8px' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', marginBottom: '0.3rem' }}>
                      <span style={{ background: 'var(--accent)', color: 'var(--bg-primary)', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>{idx + 1}</span>
                      <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{item.step}</strong>
                    </div>
                    <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '1.75rem', marginBottom: '0.2rem' }}><strong>Why:</strong> {item.why}</p>
                    {item.pitfallWarning && (
                      <p style={{ fontSize: '0.85rem', color: 'var(--danger)', marginLeft: '1.75rem', marginBottom: 0 }}><strong>⚠️ Pitfall to Avoid:</strong> {item.pitfallWarning}</p>
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Strategic Options & Verification Needs */}
            {analysisData.options && analysisData.options.length > 0 && (
              <div className="result-section">
                <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>⚖️ Evaluated Strategic Options</h3>
                <div style={{ display: 'grid', gap: '0.75rem' }}>
                  {analysisData.options.map((opt, i) => (
                    <div key={i} style={{ background: 'var(--bg-card)', padding: '0.85rem 1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)' }}>
                      <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.2rem' }}>{opt.title}</div>
                      <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><strong>Best For:</strong> {opt.bestFor}</div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Situation Summary */}
            <div className="result-section">
              <h3 style={{ color: 'var(--text-main)' }}>Situation Summary</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: 0 }}>{analysisData.situation}</p>
            </div>

            {/* Verification Checklist Section */}
            {analysisData.verificationNeeded && analysisData.verificationNeeded.length > 0 && (
              <div className="result-section" style={{ background: 'var(--bg-surface)' }}>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '0.75rem' }}>🔍 Items Recommended for Verification</h3>
                <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'grid', gap: '0.4rem' }}>
                  {analysisData.verificationNeeded.map((item, i) => (
                    <li key={i}>{item}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Automated Resolution Letter Template */}
            {analysisData.draftTemplate && (
              <div className="result-section" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                  <h3 style={{ color: 'var(--accent)', fontSize: '0.95rem', marginBottom: 0 }}>✉️ Automated Resolution Letter</h3>
                  <button 
                    onClick={handleCopyDraft}
                    style={{ background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                  >
                    {copied ? 'Copied!' : 'Copy Letter Template'}
                  </button>
                </div>
                <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                  {`To: ${analysisData.draftTemplate.recipient}\nSubject: ${analysisData.draftTemplate.subject}\n\n${analysisData.draftTemplate.body}`}
                </div>
              </div>
            )}

            {/* Contextual Follow-up Chat with Verlo Assistant */}
            <div className="result-section" style={{ background: 'var(--bg-surface)' }}>
              <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>💬 Consult Verlo AI Assistant</h3>
              <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Have questions about this pathway or need to draft a follow-up response? Ask below:</p>
              
              {chatHistory.length > 0 && (
                <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem' }}>
                  {chatHistory.map((msg, index) => (
                    <div 
                      key={index} 
                      style={{ 
                        background: msg.role === 'user' ? 'var(--bg-card)' : 'rgba(16, 185, 129, 0.08)', 
                        padding: '0.85rem', 
                        borderRadius: '8px', 
                        border: '1px solid var(--border-subtle)',
                        fontSize: '0.85rem',
                        marginLeft: msg.role === 'user' ? '2rem' : '0',
                        marginRight: msg.role === 'user' ? '0' : '2rem'
                      }}
                    >
                      <strong style={{ display: 'block', marginBottom: '0.2rem', color: msg.role === 'user' ? 'var(--text-main)' : 'var(--accent)' }}>
                        {msg.role === 'user' ? 'You' : 'Verlo AI'}
                      </strong>
                      <div style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                    </div>
                  ))}
                </div>
              )}

              <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
                <input 
                  type="text" 
                  className="form-input" 
                  placeholder="e.g., What should I do if they don't reply within 3 days?" 
                  value={chatQuestion}
                  onChange={(e) => setChatQuestion(e.target.value)}
                  disabled={isChatLoading}
                  style={{ marginBottom: 0 }}
                />
                <button 
                  type="submit" 
                  className="btn-primary" 
                  style={{ width: 'auto', padding: '0.5rem 1.25rem', marginTop: 0 }}
                  disabled={isChatLoading}
                >
                  {isChatLoading ? 'Thinking...' : 'Send'}
                </button>
              </form>
            </div>

          </div>
        )}
      </div>

      {/* Footer Component */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '2rem 1rem', background: 'var(--bg-surface)', marginTop: 'auto', textAlign: 'center', flexShrink: 0 }}>
        <div style={{ maxWidth: '800px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src="/VVNormal.png" alt="Verlo Logo" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.9rem', color: 'var(--text-main)' }}>VERLO</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            &copy; {new Date().getFullYear()} Verlo Engine. All rights reserved. Built with ethical decision-intelligence standards.
          </div>
        </div>
      </footer>

      {/* Saved History Drawer Modal */}
      {showHistoryDrawer && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: '380px', height: '100%', background: 'var(--bg-card)', borderLeft: '1px solid var(--border-subtle)', zIndex: 100, padding: '1.5rem', overflowY: 'auto', boxShadow: '-5px 0 25px rgba(0,0,0,0.5)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Your Saved Pathways</h3>
            <button onClick={() => setShowHistoryDrawer(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
          </div>
          {userHistory.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No saved reports yet. Click "Save to Account" on any result screen!</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
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
                  style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}
                >
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{item.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(item.timestamp).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Auth Modal */}
      {showAuthModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200 }}>
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-subtle)', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>{authMode === 'login' ? 'Log in to Verlo' : 'Create an Account'}</h3>
              <button onClick={() => setShowAuthModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            {authError && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '6px' }}>{authError}</div>}

            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)} 
                  required 
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                {authMode === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            </form>

            <div style={{ textAlign: 'center', marginTop: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)' }}>
              {authMode === 'login' ? (
                <span>Don't have an account? <button onClick={() => setAuthMode('signup')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Sign up</button></span>
              ) : (
                <span>Already have an account? <button onClick={() => setAuthMode('login')} style={{ background: 'none', border: 'none', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}>Log in</button></span>
              )}
            </div>
          </div>
        </div>
      )}

    </div>
  );
}