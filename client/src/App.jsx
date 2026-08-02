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

  // Custom inline alert state (replaces chrome alert)
  const [customAlert, setCustomAlert] = useState(null);

  const triggerCustomAlert = (message, type = 'success') => {
    setCustomAlert({ message, type });
    setTimeout(() => {
      setCustomAlert(null);
    }, 4000);
  };

  // Chat follow-up state
  const [chatQuestion, setChatQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  // Persistent Auth state using localStorage AND backend session recovery via userId/email
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
    "Deciphering core strategic goals for VERLO...",
    "Screening through moderation & safety filters...",
    "Evaluating risk severity & exposure metrics...",
    "Synthesising customised action pathway...",
    "Finalising VERLO tactical recommendations..."
  ];

  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
  const MIN_WORDS = 5;

  useEffect(() => {
    if (currentUser && (currentUser.id || currentUser.email)) {
      localStorage.setItem('verlo_user', JSON.stringify(currentUser));
      const identifier = currentUser.id || currentUser.email;
      fetch(`${API_URL}/api/history/${identifier}`)
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

  // Simple lightweight parser to convert basic Markdown (bold, lists, code blocks, paragraphs) into safe HTML
  const renderMarkdownToHTML = (content) => {
    if (!content) return '';
    let html = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:var(--bg-card); padding:0.75rem; border-radius:6px; overflow-x:auto; font-family:monospace; margin:0.5rem 0;"><code>$1</code></pre>');
    
    // Bold
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
    // Bullet points / lists
    const lines = html.split('\n');
    let inList = false;
    let processedLines = lines.map(line => {
      if (line.trim().startsWith('- ') || line.trim().startsWith('* ')) {
        const item = line.trim().substring(2);
        const wrapped = `<li>${item}</li>`;
        if (!inList) {
          inList = true;
          return `<ul style="margin: 0.5rem 0; padding-left: 1.25rem;">${wrapped}`;
        }
        return wrapped;
      } else {
        if (inList) {
          inList = false;
          return `</ul><p style="margin: 0.5rem 0;">${line}</p>`;
        }
        return line.trim() ? `<p style="margin: 0.5rem 0;">${line}</p>` : '';
      }
    });
    if (inList) processedLines.push('</ul>');

    return processedLines.join('');
  };

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
        if (authMode === 'signup' && (res.status === 400 || res.status === 409 || (data.error && data.error.toLowerCase().includes('exist')))) {
          throw new Error('This email address is already registered. Please log in instead.');
        }
        throw new Error(data.error || 'Authentication failed');
      }

      const userData = data.user || { id: data.userId || authEmail, email: authEmail };
      setCurrentUser(userData);
      setShowAuthModal(false);
      setAuthEmail('');
      setAuthPassword('');
      triggerCustomAlert(authMode === 'signup' ? 'Account created successfully!' : 'Logged in successfully!', 'success');
    } catch (err) {
      setAuthError(err.message);
    }
  };

  const handleLogout = () => {
    setCurrentUser(null);
    localStorage.removeItem('verlo_user');
    setUserHistory([]);
    setStep('landing');
    triggerCustomAlert('Logged out successfully.', 'success');
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
          userId: currentUser.id || currentUser.email, 
          report: { title: title || 'Untitled VERLO Report', description, result: resultData } 
        })
      });
      const data = await res.json();
      if (data.history) {
        setUserHistory(data.history);
        triggerCustomAlert('Pathway saved successfully to your VERLO account history!', 'success');
      } else {
        triggerCustomAlert('Pathway saved successfully.', 'success');
      }
    } catch (err) {
      console.error('Failed to save history', err);
      triggerCustomAlert('Error saving pathway to account history.', 'error');
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (wordCount < MIN_WORDS) {
      setError(`Please provide a bit more detail (at least ${MIN_WORDS} words) so VERLO can build a reliable pathway.`);
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
      setError('Could not connect to VERLO server. Is the backend running?');
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
      setChatHistory([]); 
      setStep('results');
    } catch (err) {
      clearInterval(interval);
      setError(err.message || 'Could not connect to VERLO server.');
      setStep('input');
    }
  };

  const handleCopyDraft = () => {
    if (!analysisData?.draftTemplate) return;
    const textToCopy = `To: ${analysisData.draftTemplate.recipient}\nSubject: ${analysisData.draftTemplate.subject}\n\n${analysisData.draftTemplate.body}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    triggerCustomAlert('Letter template copied to clipboard!', 'success');
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
    <div className="verlo-app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative' }}>
      
      {/* Custom Non-Chrome Alert Banner Popup */}
      {customAlert && (
        <div style={{ position: 'fixed', top: '20px', left: '50%', transform: 'translateX(-50%)', zIndex: 9999, background: customAlert.type === 'error' ? '#ef4444' : '#10b981', color: '#fff', padding: '0.75rem 1.5rem', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem', animation: 'fadeIn 0.2s ease-out' }}>
          <span>{customAlert.type === 'error' ? '⚠️' : '✓'}</span>
          <span>{customAlert.message}</span>
        </div>
      )}

      {/* Top Navigation Bar */}
      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '1rem 1.5rem', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', textShadow: 'none' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              Saved History ({userHistory.length})
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem', textShadow: 'none' }}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
              {currentUser.email || currentUser.id}
            </span>
            <button 
              onClick={handleLogout} 
              style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--danger)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer', textShadow: 'none' }}
            >
              Logout
            </button>
          </div>
        ) : (
          <button 
            onClick={() => { setAuthMode('login'); setAuthError(null); setShowAuthModal(true); }}
            style={{ background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textShadow: 'none', boxShadow: 'none' }}
          >
            Login / Signup
          </button>
        )}
      </div>

      {/* Main Content Area Container with Centered Layout and constrained max widths */}
      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '800px', margin: '0 auto', padding: '0 1.5rem 3rem 1.5rem', boxSizing: 'border-box', alignItems: 'center' }}>
        {step === 'landing' && (
          <div className="page-transition" key="landing" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="verlo-header" style={{ marginTop: '1rem', textAlign: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem', width: '100%' }}>
                <img src="/VVNormal.png" alt="VERLO Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                <span className="verlo-brand" style={{ margin: 0, textShadow: 'none' }}>VERLO</span>
              </div>
              <h1 className="verlo-title" style={{ textShadow: 'none' }}>Stop guessing. Know your exact next step.</h1>
              <p className="verlo-subtitle" style={{ marginBottom: '2.5rem', maxWidth: '650px', marginInline: 'auto', textShadow: 'none' }}>
                An ethical decision-intelligence system for VERLO that transforms messy, stressful situations into a fully tailored, risk-scored action pathway.
              </p>
              <button className="btn-primary" style={{ maxWidth: '300px', margin: '0 auto 3rem', textShadow: 'none', boxShadow: 'none' }} onClick={() => setStep('input')}>
                Launch Decision Engine →
              </button>

              <div style={{ textAlign: 'center', width: '100%', maxWidth: '650px', margin: '0 auto 4rem' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center', textShadow: 'none' }}>
                  Test common VERLO scenarios:
                </p>
                <div style={{ display: 'grid', gap: '0.75rem', width: '100%', textAlign: 'left' }}>
                  <div 
                    className="verlo-card" 
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', boxSizing: 'border-box' }}
                    onClick={() => handleExampleSelect(
                      'Flight cancelled at gate', 
                      'My international flight was abruptly cancelled at the boarding gate due to mechanical failure. The airline desk agent says the earliest they can rebook me is in 48 hours, and they are refusing to cover hotel accommodations for the night despite my connecting ticket.',
                      'Travelling on a strict budget for an important family event'
                    )}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}><path d="M17.8 19.2L16 11l3.5-3.5C21 6 21.5 4 21 3c-1-.5-3 0-4.5 1.5L13 8 4.8 6.2c-.5-.1-.9.1-1.1.5l-.5 1.2c-.2.5 0 1.1.5 1.3l5.5 2.5-3.5 3.5L3 16l3 3 1.5-1.5 3.5-3.5 2.5 5.5c.2.5.8.7 1.3.5l1.2-.5c.4-.2.6-.6.5-1.1z"/></svg>
                    <div>
                      <strong>Flight cancelled at gate</strong> &mdash; Airline refusing overnight hotel voucher.
                    </div>
                  </div>
                  <div 
                    className="verlo-card" 
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', boxSizing: 'border-box' }}
                    onClick={() => handleExampleSelect(
                      'Unresolved billing charge', 
                      'I noticed an unexpected $450 charge on my credit card from a software enterprise subscription that I explicitly cancelled three months ago in writing. Support is ignoring my emails and chat tickets.',
                      'Freelancer relying on tight monthly cash flow'
                    )}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}><rect x="1" y="4" width="22" height="16" rx="2" ry="2"/><line x1="1" y1="10" x2="23" y2="10"/></svg>
                    <div>
                      <strong>Unresolved billing dispute</strong> &mdash; Subscription charged post-cancellation.
                    </div>
                  </div>
                  <div 
                    className="verlo-card" 
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', boxSizing: 'border-box' }}
                    onClick={() => handleExampleSelect(
                      'Unreturned apartment deposit', 
                      'My landlord has withheld my full $1,800 security deposit for over 45 days past lease termination without itemised deduction notices or damage reports, and is now ignoring my phone calls.',
                      'First-time renter moving to a new state'
                    )}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    <div>
                      <strong>Unreturned security deposit</strong> &mdash; Landlord withholding funds past legal deadline.
                    </div>
                  </div>
                  <div 
                    className="verlo-card" 
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', boxSizing: 'border-box' }}
                    onClick={() => handleExampleSelect(
                      'Damaged courier delivery', 
                      'An expensive electronics item I ordered arrived completely smashed due to poor handling by the courier service. The seller is claiming it is the courier’s fault, and the courier claims I need to file through the merchant.',
                      'Purchased using debit card with standard consumer guarantees'
                    )}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}><path d="M21 16V8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16z"/></svg>
                    <div>
                      <strong>Damaged courier delivery</strong> &mdash; Merchant and courier shifting blame for broken item.
                    </div>
                  </div>
                  <div 
                    className="verlo-card" 
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', boxSizing: 'border-box' }}
                    onClick={() => handleExampleSelect(
                      'Unauthorised gym membership debit', 
                      'My local fitness club continued debiting my account for two months after I submitted my written contract cancellation form in person. They are claiming they never received the paperwork.',
                      'Strict monthly budget constraints'
                    )}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
                    <div>
                      <strong>Unauthorised gym direct debit</strong> &mdash; Fees charged after contract cancellation.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'input' && (
          <div className="page-transition" key="input" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '650px' }}>
              <div style={{ marginBottom: '1.5rem', textAlign: 'left', width: '100%' }}>
                <button 
                  onClick={() => setStep('landing')}
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer', textShadow: 'none' }}
                >
                  ← Back to Overview
                </button>
              </div>

              <div className="verlo-header" style={{ marginTop: '1rem', marginBottom: '2rem', textAlign: 'center', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem', width: '100%' }}>
                  <img src="/VVNormal.png" alt="VERLO Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                  <span className="verlo-brand" style={{ margin: 0, textShadow: 'none' }}>VERLO</span>
                </div>
                <h2 className="verlo-title" style={{ fontSize: '2rem', marginBottom: '0.25rem', textShadow: 'none' }}>Define Your Situation</h2>
                <p className="verlo-subtitle" style={{ margin: 0, textAlign: 'center', textShadow: 'none' }}>Provide the details below using the VERLO server & index engine so we can formulate your tailored pathway.</p>
              </div>

              {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', width: '100%', boxSizing: 'border-box', textAlign: 'center' }}>{error}</div>}

              <form onSubmit={handleSubmit} className="verlo-card" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label" style={{ textShadow: 'none' }}>Situation Title (Optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g., Landlord deposit dispute" 
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="form-group" style={{ textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem' }}>
                    <label className="form-label" style={{ marginBottom: 0, textShadow: 'none' }}>Describe what happened *</label>
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

                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label" style={{ textShadow: 'none' }}>Any specific personal context or constraints? (Optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g., I'm a student living on a tight budget" 
                    value={userContext}
                    onChange={(e) => setUserContext(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%', textShadow: 'none', boxShadow: 'none' }}>
                  Compute Tailored Pathway →
                </button>
              </form>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="page-transition processing-container" key="processing" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' }}>
            <div className="processing-pulse-ring"></div>
            <h2 style={{ fontSize: '1.5rem', marginTop: '1.5rem', color: 'var(--text-main)', textAlign: 'center', textShadow: 'none' }}>Synthesising personalised logic...</h2>
            
            <div className="processing-steps" style={{ width: '100%', maxWidth: '450px', marginTop: '2rem' }}>
              {processingSteps.map((text, idx) => {
                const isDone = idx < processingStage;
                const isActive = idx === processingStage;
                return (
                  <div key={idx} className={`step-item ${isActive ? 'active' : ''} ${isDone ? 'done' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-card)', marginBottom: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', width: '100%', boxSizing: 'border-box' }}>
                    <span style={{ color: isActive ? 'var(--accent)' : 'var(--text-muted)', fontSize: '0.9rem' }}>{text}</span>
                    <span>{isDone ? '✓' : isActive ? '●' : '○'}</span>
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {step === 'results' && analysisData && (
          <div className="page-transition animate-fade-slide-up" key="results" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '750px' }}>
              
              {/* Top Navigation Bar inside Results */}
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem', width: '100%' }}>
                <div style={{ display: 'flex', gap: '0.75rem', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => setStep('input')}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', textShadow: 'none' }}
                  >
                    ← Edit Situation
                  </button>
                  <button 
                    onClick={() => handleSaveToAccount(analysisData)}
                    style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem', textShadow: 'none' }}
                  >
                    <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Save to Account
                  </button>
                </div>
                <button 
                  onClick={() => setStep('landing')} 
                  style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer', textShadow: 'none' }}
                >
                  Start Over
                </button>
              </div>

              {/* Risk Assessment Summary Bar */}
              <div className="result-section animate-fade-slide-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-surface)', width: '100%', boxSizing: 'border-box' }}>
                <div>
                  <span className={`badge ${analysisData.confidence?.toLowerCase()}`} style={{ marginBottom: '0.25rem', display: 'inline-block' }}>
                    Confidence: {analysisData.confidence}
                  </span>
                  {userContext && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tailored for: <em>"{userContext}"</em></div>}
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
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
              <div className="dominant-action animate-fade-slide-up" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem', textShadow: 'none' }}>
                  <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                  Immediate Priority Action
                </h3>
                <h2 style={{ textShadow: 'none' }}>{analysisData.nextSteps?.[0]?.step || "Review strategic options below."}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: 0 }}>
                  <strong>Why this first:</strong> {analysisData.nextSteps?.[0]?.why || "Establishes your foundational position."}
                </p>
              </div>

              {/* Full Comprehensive Step-by-Step Action Pathway */}
              <div className="result-section animate-fade-slide-up" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                  Full Step-by-Step Action Pathway
                </h3>
                <div style={{ display: 'grid', gap: '1rem', width: '100%' }}>
                  {analysisData.nextSteps?.map((item, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '1.2rem', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                        <span style={{ background: 'var(--accent)', color: 'var(--bg-primary)', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{idx + 1}</span>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{item.step}</strong>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '2.1rem', marginBottom: '0.3rem' }}><strong>Why:</strong> {item.why}</p>
                      {item.pitfallWarning && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--danger)', marginLeft: '2.1rem', marginBottom: 0 }}><strong>⚠️ Pitfall to Avoid:</strong> {item.pitfallWarning}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Strategic Options */}
              {analysisData.options && analysisData.options.length > 0 && (
                <div className="result-section animate-fade-slide-up" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
                  <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>
                    Evaluated Strategic Options
                  </h3>
                  <div style={{ display: 'grid', gap: '0.75rem', width: '100%' }}>
                    {analysisData.options.map((opt, i) => (
                      <div key={i} style={{ background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ fontWeight: 600, fontSize: '0.9rem', color: 'var(--text-main)', marginBottom: '0.25rem' }}>{opt.title}</div>
                        <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}><strong>Best For:</strong> {opt.bestFor}</div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Situation Summary */}
              <div className="result-section animate-fade-slide-up" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
                <h3 style={{ color: 'var(--text-main)', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10 9 9 9 8 9"/></svg>
                  Situation Summary
                </h3>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: 0 }}>{analysisData.situation}</p>
              </div>

              {/* Verification Checklist Section */}
              {analysisData.verificationNeeded && analysisData.verificationNeeded.length > 0 && (
                <div className="result-section animate-fade-slide-up" style={{ background: 'var(--bg-surface)', width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
                  <h3 style={{ color: 'var(--text-main)', marginBottom: '0.75rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><polyline points="22 4 12 14.01 9 11.01"/></svg>
                    Items Recommended for Verification
                  </h3>
                  <ul style={{ margin: 0, paddingLeft: '1.25rem', fontSize: '0.85rem', color: 'var(--text-muted)', display: 'grid', gap: '0.4rem' }}>
                    {analysisData.verificationNeeded.map((item, i) => (
                      <li key={i}>{item}</li>
                    ))}
                  </ul>
                </div>
              )}

              {/* Automated Resolution Letter Template */}
              {analysisData.draftTemplate && (
                <div className="result-section animate-fade-slide-up" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.3)', width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ color: 'var(--accent)', fontSize: '0.95rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      Automated Resolution Letter
                    </h3>
                    <button 
                      onClick={handleCopyDraft}
                      style={{ background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', textShadow: 'none', boxShadow: 'none' }}
                    >
                      {copied ? 'Copied!' : 'Copy Letter Template'}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
                    {`To: ${analysisData.draftTemplate.recipient}\nSubject: ${analysisData.draftTemplate.subject}\n\n${analysisData.draftTemplate.body}`}
                  </div>
                </div>
              )}

              {/* Contextual Follow-up Chat with VERLO Assistant (with Markdown-to-HTML parser) */}
              <div className="result-section animate-fade-slide-up" style={{ background: 'var(--bg-surface)', width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                  Consult VERLO AI Assistant
                </h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Have questions about this pathway or need to draft a follow-up response? Ask below:</p>
                
                {chatHistory.length > 0 && (
                  <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem', maxHeight: '300px', overflowY: 'auto', paddingRight: '0.5rem', width: '100%', boxSizing: 'border-box' }}>
                    {chatHistory.map((msg, index) => (
                      <div 
                        key={index} 
                        style={{ 
                          background: msg.role === 'user' ? 'var(--bg-card)' : 'rgba(16, 185, 129, 0.08)', 
                          padding: '0.85rem', 
                          borderRadius: '8px', 
                          border: '1px solid var(--border-subtle)',
                          fontSize: '0.85rem',
                          marginLeft: msg.role === 'user' ? '1rem' : '0',
                          marginRight: msg.role === 'user' ? '0' : '1rem',
                          width: 'calc(100% - 1rem)',
                          boxSizing: 'border-box'
                        }}
                      >
                        <strong style={{ display: 'block', marginBottom: '0.2rem', color: msg.role === 'user' ? 'var(--text-main)' : 'var(--accent)' }}>
                          {msg.role === 'user' ? 'You' : 'VERLO AI'}
                        </strong>
                        {msg.role === 'user' ? (
                          <div style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                        ) : (
                          <div 
                            style={{ color: 'var(--text-muted)' }} 
                            dangerouslySetInnerHTML={{ __html: renderMarkdownToHTML(msg.content) }} 
                          />
                        )}
                      </div>
                    ))}
                  </div>
                )}

                <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g., What should I do if they don't reply within 3 days?" 
                    value={chatQuestion}
                    onChange={(e) => setChatQuestion(e.target.value)}
                    disabled={isChatLoading}
                    style={{ marginBottom: 0, flex: '1 1 250px' }}
                  />
                  <button 
                    type="submit" 
                    className="btn-primary" 
                    style={{ width: 'auto', padding: '0.5rem 1.25rem', marginTop: 0, textShadow: 'none', boxShadow: 'none' }}
                    disabled={isChatLoading}
                  >
                    {isChatLoading ? 'Thinking...' : 'Send'}
                  </button>
                </form>
              </div>

              {/* ⚠️ Warning Banner */}
              <div style={{ background: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.5)', padding: '1rem 1.25rem', borderRadius: '8px', marginTop: '1.5rem', fontSize: '0.85rem', color: '#ef4444', display: 'flex', gap: '0.75rem', alignItems: 'flex-start', width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="#ef4444" strokeWidth="2" style={{ flexShrink: 0, marginTop: '2px' }}><path d="M10.29 3.86L1.82 18a2 2 0 0 0 1.71 3h16.94a2 2 0 0 0 1.71-3L13.71 3.86a2 2 0 0 0-3.42 0z"/><line x1="12" y1="9" x2="12" y2="13"/><line x1="12" y1="17" x2="12.01" y2="17"/></svg>
                <div>
                  <strong style={{ display: 'block', marginBottom: '0.2rem', color: '#ef4444' }}>Ethical Notice & Information Verification Required</strong>
                  VERLO is an AI decision-intelligence assistant designed to structure administrative pathways. AI models can occasionally misstate rules, statutes, or deadlines. Please independently verify all critical claims, contract terms, legal deadlines, or financial obligations before executing high-stakes actions.
                </div>
              </div>

            </div>
          </div>
        )}
      </div>

      {/* Footer Component - Clamped to absolute bottom & full width */}
      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '2rem 1rem', background: 'var(--bg-surface)', width: '100%', boxSizing: 'border-box', marginTop: 'auto', textAlign: 'center', flexShrink: 0 }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src="/VVNormal.png" alt="VERLO Logo" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.9rem', color: 'var(--text-main)', textShadow: 'none' }}>VERLO</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            &copy; {new Date().getFullYear()} VERLO Engine. All rights reserved. Built with ethical decision-intelligence standards.
          </div>
        </div>
      </footer>

      {/* Saved History Drawer Modal with slide-in animation */}
      {showHistoryDrawer && (
        <div className="animate-slide-in-right" style={{ position: 'fixed', top: 0, right: 0, width: '100%', maxWidth: '380px', height: '100%', background: 'var(--bg-card)', borderLeft: '1px solid var(--border-subtle)', zIndex: 100, padding: '1.5rem', overflowY: 'auto', boxShadow: '-5px 0 25px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem', textShadow: 'none' }}>Your Saved Pathways</h3>
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
                  style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', cursor: 'pointer', textAlign: 'left' }}
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
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200, padding: '1rem', boxSizing: 'border-box' }}>
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-subtle)', width: '100%', maxWidth: '400px', boxSizing: 'border-box', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0', textShadow: 'none' }}>{authMode === 'login' ? 'Log in to VERLO' : 'Create an Account'}</h3>
              <button onClick={() => setShowAuthModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>

            {authError && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '6px' }}>{authError}</div>}

            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label className="form-label" style={{ textShadow: 'none' }}>Email Address</label>
                <input 
                  type="email" 
                  className="form-input" 
                  value={authEmail} 
                  onChange={(e) => setAuthEmail(e.target.value)} 
                  required 
                />
              </div>
              <div className="form-group">
                <label className="form-label" style={{ textShadow: 'none' }}>Password</label>
                <input 
                  type="password" 
                  className="form-input" 
                  value={authPassword} 
                  onChange={(e) => setAuthPassword(e.target.value)} 
                  required 
                />
              </div>

              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem', textShadow: 'none', boxShadow: 'none' }}>
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