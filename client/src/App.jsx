import React, { useState, useEffect } from 'react';
import './index.css';

// Dynamically check if VITE_API_URL is provided (Netlify production), otherwise fallback to local backend
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

  // Persistent Auth state using localStorage
  const [currentUser, setCurrentUser] = useState(() => {
    const savedUser = localStorage.getItem('verlo_user');
    return savedUser ? JSON.parse(savedUser) : null;
  });
  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [authEmail, setAuthEmail] = useState('');
  const [authPassword, setAuthPassword] = useState('');
  const [authError, setAuthError] = useState(null);
  
  // History state
  const [userHistory, setUserHistory] = useState([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const processingSteps = [
    "Deciphering the goal...",
    "Detecting personal constraints & stakes...",
    "Calculating risk severity & exposure...",
    "Evaluating strategic options...",
    "Synthesizing customized action pathway..."
  ];

  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
  const MIN_WORDS = 5;

  // Sync user session to localStorage
  useEffect(() => {
    if (currentUser) {
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
        body: JSON.stringify({ email: authEmail, password: authPassword })
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

  const handleSaveToAccount = async (resultData) => {
    if (!currentUser) {
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await fetch(`${API_URL}/api/history/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: currentUser.id, report: { title: title || 'Unnamed Request', description, result: resultData } })
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
    const intervalTime = 900; 

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

  return (
    <div className="verlo-app">
      
      {/* Top Navigation Bar with Account / Login */}
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
              onClick={() => setCurrentUser(null)} 
              style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--danger)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}
            >
              Logout
            </button>
          </div>
        ) : (
          <button 
            onClick={() => { setAuthMode('login'); setShowAuthModal(true); }}
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
                A decision-intelligence system that transforms messy, stressful situations into a fully tailored, risk-scored action pathway.
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
                  <div 
                    className="verlo-card" 
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', marginBottom: 0 }}
                    onClick={() => handleExampleSelect(
                      'Defective warranty denial', 
                      'My premium smartphone battery swelled up and cracked the internal screen within 11 months of purchase. The manufacturer service center claims physical damage and voided the warranty, ignoring consumer protection standards.',
                      'Relying on this device daily for remote work income'
                    )}
                  >
                    📱 <strong>Defective warranty denial</strong> &mdash; Manufacturer rejecting valid hardware repair.
                  </div>
                  <div 
                    className="verlo-card" 
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', marginBottom: 0 }}
                    onClick={() => handleExampleSelect(
                      'Unauthorized medical billing', 
                      'An in-network hospital visit resulted in an unexpected $1,200 out-of-network lab fee balance bill, even though I pre-approved all services and verified network participation beforehand.',
                      'Managing fixed monthly healthcare outlays'
                    )}
                  >
                    🏥 <strong>Unauthorized medical billing</strong> &mdash; Surprise balance billing after pre-approval.
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

            <div className="dominant-action">
              <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '0.5rem' }}>
                👉 Immediate Priority Action
              </h3>
              <h2>{analysisData.nextSteps?.[0]?.step || "Review strategic options below."}</h2>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: 0 }}>
                <strong>Why this first:</strong> {analysisData.nextSteps?.[0]?.why || "Establishes your foundational position."}
              </p>
            </div>

            <div className="result-section">
              <h3 style={{ color: 'var(--text-main)' }}>Situation Summary</h3>
              <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: 0 }}>{analysisData.situation}</p>
            </div>

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
            &copy; {new Date().getFullYear()} Verlo Engine. All rights reserved. Crafted with 🌶️.
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