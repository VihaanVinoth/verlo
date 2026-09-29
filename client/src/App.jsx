import React, { useState, useEffect } from 'react';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001';

export default function App() {
  const [step, setStep] = useState('landing'); 
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [userContext, setUserContext] = useState('');
  
  const [wizardQuestions, setWizardQuestions] = useState([]);
  const [currentWizardIndex, setCurrentWizardIndex] = useState(0);
  const [wizardResponses, setWizardResponses] = useState({});

  const [analysisData, setAnalysisData] = useState(null);
  const [processingStage, setProcessingStage] = useState(0);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);
  const [copyCount, setCopyCount] = useState(0);

  const [customAlert, setCustomAlert] = useState(null);
  const [alertExiting, setAlertExiting] = useState(false);

  const triggerCustomAlert = (message, type = 'success') => {
    setCustomAlert({ message, type });
    setAlertExiting(false);
    setTimeout(() => {
      setAlertExiting(true);
      setTimeout(() => {
        setCustomAlert(null);
        setAlertExiting(false);
      }, 300);
    }, 3300);
  };

  const [chatQuestion, setChatQuestion] = useState('');
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

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
  
  const [userHistory, setUserHistory] = useState([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const processingSteps = [
    "Deciphering core strategic goals..",
    "Screening through moderation & safety filters...",
    "Evaluating risk severity & exposure metrics...",
    "Synthesising customised action pathway...",
    "Finalising recommendations..."
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

  const renderMarkdownToHTML = (content) => {
    if (!content) return '';
    let html = content
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');

    html = html.replace(/```([\s\S]*?)```/g, '<pre style="background:var(--bg-card); padding:0.75rem; border-radius:6px; overflow-x:auto; font-family:monospace; margin:0.5rem 0;"><code>$1</code></pre>');
    html = html.replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>');
    
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
          report: { title: title || 'Untitled Report', description, result: resultData } 
        })
      });
      const data = await res.json();
      if (data.history) {
        setUserHistory(data.history);
        triggerCustomAlert('Pathway saved successfully to your account history!', 'success');
      } else {
        triggerCustomAlert('Pathway saved successfully.', 'success');
      }
    } catch (err) {
      console.error('Failed to save history', err);
      triggerCustomAlert('Error saving pathway to account history.', 'error');
    }
  };
  const handleInitialSubmit = async (e) => {
    e.preventDefault();
    if (wordCount < MIN_WORDS) {
      setError(`Please provide a bit more detail (at least ${MIN_WORDS} words) so VERLO can build a reliable pathway.`);
      return;
    }

    setError(null);
    setStep('processing');
    setProcessingStage(0);

    try {
      const res = await fetch(`${API_URL}/api/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, context: userContext }),
      });
      const result = await res.json();

      if (!res.ok) {
        setError(result.error || 'Content restricted or engine calculation failed.');
        setStep('input');
        return;
      }

      setAnalysisData(result.data);
      setChatHistory([]);
      setStep('results');
    } catch (err) {
      setError(err.message || 'Could not connect to the server.');
      setStep('input');
    }
  };

  const handleCopyDraft = () => {
    if (!analysisData?.draftTemplate) return;
    const textToCopy = `To: ${analysisData.draftTemplate.recipient}\nSubject: ${analysisData.draftTemplate.subject}\n\n${analysisData.draftTemplate.body}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);
    setCopyCount(prev => prev + 1);
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
        body: JSON.stringify({ question: questionText, currentSituation: description || title })
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
      {customAlert && (
        <div style={{ 
          position: 'fixed', top: '20px', left: '50%', 
          transform: alertExiting ? 'translateX(-50%) translateY(-20px)' : 'translateX(-50%) translateY(0)', 
          opacity: alertExiting ? 0 : 1, transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)', zIndex: 9999, 
          background: customAlert.type === 'error' ? '#ef4444' : '#10b981', color: '#fff', 
          padding: '0.75rem 1.5rem', borderRadius: '8px', boxShadow: '0 4px 12px rgba(0,0,0,0.3)', 
          fontSize: '0.9rem', fontWeight: 600, display: 'flex', alignItems: 'center', gap: '0.5rem' 
        }}>
          <span>{customAlert.type === 'error' ? '⚠️' : '✓'}</span>
          <span>{customAlert.message}</span>
        </div>
      )}

      <div style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', padding: '1rem 1.5rem', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              Saved History ({userHistory.length})
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{currentUser.email || currentUser.id}</span>
            <button onClick={handleLogout} style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--danger)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
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

      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '800px', margin: '0 auto', padding: '0 1.5rem 3rem 1.5rem', boxSizing: 'border-box', alignItems: 'center' }}>
        
        {step === 'landing' && (
          <div className="page-transition" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="verlo-header" style={{ marginTop: '1rem', textAlign: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <img src="/VVNormal.png" alt="VERLO Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                <span className="verlo-brand" style={{ margin: 0 }}>VERLO</span>
              </div>
              <h1 className="verlo-title">Stop guessing. Know your exact next step.</h1>
              <p className="verlo-subtitle" style={{ marginBottom: '2.5rem', maxWidth: '650px', marginInline: 'auto' }}>
                Verlo is an adaptive decision-intelligence system powered by advanced AI models to transform complex situations into structured pathways[cite: 2].
              </p>
              <button className="btn-primary" style={{ maxWidth: '300px', margin: '0 auto 3rem' }} onClick={() => setStep('input')}>
                Launch Decision Engine →
              </button>

              <div style={{ textAlign: 'center', width: '100%', maxWidth: '650px', margin: '0 auto 4org' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
                  Test common VERLO scenarios:
                </p>
                <div style={{ display: 'grid', gap: '0.75rem', width: '100%', textAlign: 'left' }}>
                  <div 
                    className="verlo-card" 
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}
                    onClick={() => handleExampleSelect(
                      'Flight cancelled at gate', 
                      'My international flight was abruptly cancelled at the boarding gate due to mechanical failure. The airline desk agent says the earliest they can rebook me is in 48 hours, and they are refusing hotel accommodations.',
                      'Travelling on a strict budget'
                    )}
                  >
                    <div><strong>Flight cancelled at gate</strong> &mdash; Airline refusing overnight hotel voucher.</div>
                  </div>
                  <div 
                    className="verlo-card" 
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '1rem' }}
                    onClick={() => handleExampleSelect(
                      'Unresolved billing charge', 
                      'I noticed an unexpected $450 charge on my credit card from a software enterprise subscription that I explicitly cancelled three months ago.',
                      'Freelancer relying on tight cash flow'
                    )}
                  >
                    <div><strong>Unresolved billing dispute</strong> &mdash; Subscription charged post-cancellation.</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 'input' && (
          <div className="page-transition" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '650px' }}>
              <div style={{ marginBottom: '1.5rem', textAlign: 'left' }}>
                <button onClick={() => setStep('landing')} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>
                  ← Back to Overview
                </button>
              </div>

              <div className="verlo-header" style={{ textAlign: 'center', marginBottom: '2rem' }}>
                <h2 className="verlo-title" style={{ fontSize: '2rem' }}>Define Your Situation</h2>
                <p className="verlo-subtitle">Provide details below so the adaptive model can formulate your action pathway[cite: 2].</p>
              </div>

              {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', textAlign: 'center' }}>{error}</div>}

              <form onSubmit={handleInitialSubmit} className="verlo-card" style={{ width: '100%', textAlign: 'left' }}>
                <div className="form-group">
                  <label className="form-label">Situation Title (Optional)</label>
                  <input type="text" className="form-input" placeholder="e.g., Landlord deposit dispute" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>
                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label className="form-label">Describe what happened *</label>
                    <span style={{ fontSize: '0.8rem', color: wordCount < MIN_WORDS ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {wordCount} words {wordCount < MIN_WORDS ? `(Min ${MIN_WORDS})` : '✓'}
                    </span>
                  </div>
                  <textarea className="form-textarea" placeholder="Include key dates, amounts, and expected outcomes..." value={description} onChange={(e) => setDescription(e.target.value)} required />
                </div>
                <button type="submit" className="btn-primary" style={{ width: '100%' }}>Compute Pathway →</button>
              </form>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="page-transition" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' }}>
            <div className="processing-pulse-ring"></div>
            <h2 style={{ fontSize: '1.5rem', marginTop: '1.5rem', textAlign: 'center' }}>Synthesising personalised logic...</h2>
          </div>
        )}

        {step === 'results' && analysisData && (
          <div className="page-transition" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '750px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <button onClick={() => setStep('input')} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>
                  ← Edit Situation
                </button>
                <button onClick={() => handleSaveToAccount(analysisData)} style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '0.5rem 1rem', borderRadius: '8px', cursor: 'pointer' }}>
                  Save to Account
                </button>
              </div>

              <div className="result-section" style={{ textAlign: 'left' }}>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>Action Pathway</h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {analysisData.nextSteps?.map((item, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '1.2rem', borderRadius: '8px' }}>
                      <strong>{idx + 1}. {item.step}</strong>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginTop: '0.3rem' }}>{item.why}</p>
                    </div>
                  ))}
                </div>
              </div>

              {analysisData.draftTemplate && (
                <div className="result-section" style={{ background: 'rgba(16, 185, 129, 0.05)', textAlign: 'left' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ color: 'var(--accent)', fontSize: '0.95rem', margin: 0 }}>Automated Resolution Letter</h3>
                    <button onClick={handleCopyDraft} style={{ background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>
                      {copied ? 'Copied!' : 'Copy Template'}
                    </button>
                  </div>
                  <pre style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {`To: ${analysisData.draftTemplate.recipient}\nSubject: ${analysisData.draftTemplate.subject}\n\n${analysisData.draftTemplate.body}`}
                  </pre>
                </div>
              )}

              <div className="result-section" style={{ background: 'var(--bg-surface)', textAlign: 'left' }}>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Consult VERLO AI Assistant</h3>
                {chatHistory.length > 0 && (
                  <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                    {chatHistory.map((msg, index) => (
                      <div key={index} style={{ background: msg.role === 'user' ? 'var(--bg-card)' : 'rgba(16, 185, 129, 0.08)', padding: '0.85rem', borderRadius: '8px' }}>
                        <strong style={{ color: msg.role === 'user' ? 'var(--text-main)' : 'var(--accent)' }}>{msg.role === 'user' ? 'You' : 'VERLO AI'}</strong>
                        <div style={{ color: 'var(--text-muted)', marginTop: '0.2rem' }} dangerouslySetInnerHTML={{ __html: renderMarkdownToHTML(msg.content) }} />
                      </div>
                    ))}
                  </div>
                )}
                <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '0.5rem' }}>
                  <input type="text" className="form-input" placeholder="Ask a follow-up question..." value={chatQuestion} onChange={(e) => setChatQuestion(e.target.value)} disabled={isChatLoading} style={{ marginBottom: 0, flex: 1 }} />
                  <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.5rem 1.25rem', marginTop: 0 }} disabled={isChatLoading}>
                    {isChatLoading ? 'Thinking...' : 'Send'}
                  </button>
                </form>
              </div>

            </div>
          </div>
        )}
      </div>

      {showHistoryDrawer && (
        <div style={{ position: 'fixed', top: 0, right: 0, width: '100%', maxWidth: '380px', height: '100%', background: 'var(--bg-card)', borderLeft: '1px solid var(--border-subtle)', zIndex: 100, padding: '1.5rem', overflowY: 'auto', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Your Saved Pathways</h3>
            <button onClick={() => setShowHistoryDrawer(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
          </div>
          {userHistory.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No saved reports yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {userHistory.map((item, idx) => (
                <div key={idx} onClick={() => { setTitle(item.title); setDescription(item.description); setAnalysisData(item.result); setStep('results'); setShowHistoryDrawer(false); }} style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', cursor: 'pointer', textAlign: 'left' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem' }}>{item.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(item.timestamp).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAuthModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200, padding: '1rem', boxSizing: 'border-box' }}>
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-subtle)', width: '100%', maxWidth: '400px', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>{authMode === 'login' ? 'Log in to VERLO' : 'Create an Account'}</h3>
              <button onClick={() => setShowAuthModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            {authError && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '6px' }}>{authError}</div>}
            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>
                <input type="email" className="form-input" value={authEmail} onChange={(e) => setAuthEmail(e.target.value)} required />
              </div>
              <div className="form-group">
                <label className="form-label">Password</label>
                <input type="password" className="form-input" value={authPassword} onChange={(e) => setAuthPassword(e.target.value)} required />
              </div>
              <button type="submit" className="btn-primary" style={{ width: '100%', marginTop: '1rem' }}>
                {authMode === 'login' ? 'Log In' : 'Sign Up'}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}