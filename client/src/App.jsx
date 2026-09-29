import React, { useState, useEffect } from 'react';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001';

export default function App() {
  const [step, setStep] = useState('landing');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [userContext, setUserContext] = useState('');
  
  const [assessmentData, setAssessmentData] = useState(null);
  const [selectedMcqAnswers, setSelectedMcqAnswers] = useState({});
  const [adaptiveTextAnswers, setAdaptiveTextAnswers] = useState({});
  const [activeAssessmentIndex, setActiveAssessmentIndex] = useState(0);

  const [analysisData, setAnalysisData] = useState(null);
  const [activeTab, setActiveTab] = useState('overview');  
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
    html = html.replace(/\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer" style="color: var(--accent); text-decoration: underline;">$1</a>');

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

    let apiPromise;
    try {
      apiPromise = fetch(`${API_URL}/api/assess`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description }),
      });
    } catch (err) {
      setError('Could not connect to server. Is the backend running?');
      setStep('input');
      return;
    }

    let currentStage = 0;
    const intervalTime = 600; 

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
        setError(result.error || 'Engine calculation failed.');
        setStep('input');
        return;
      }

      setAssessmentData(result.data);
      setSelectedMcqAnswers({});
      setAdaptiveTextAnswers({});
      setActiveAssessmentIndex(0);
      setStep('assessment');
    } catch (err) {
      clearInterval(interval);
      setError(err.message || 'Could not connect to the server.');
      setStep('input');
    }
  };

  const getAllAssessmentItems = () => {
    if (!assessmentData) return [];
    const mcqs = (assessmentData.mcqAssessment || []).map(item => ({ type: 'mcq', ...item }));
    const texts = (assessmentData.adaptiveQuestions || []).map(item => ({ type: 'text', ...item }));
    return [...mcqs, ...texts];
  };

  const assessmentItems = getAllAssessmentItems();

  const handleAssessmentNext = () => {
    if (activeAssessmentIndex < assessmentItems.length - 1) {
      setActiveAssessmentIndex(activeAssessmentIndex + 1);
    } else {
      handleFinalAssessmentSubmit();
    }
  };

  const handleAssessmentPrev = () => {
    if (activeAssessmentIndex > 0) {
      setActiveAssessmentIndex(activeAssessmentIndex - 1);
    } else {
      setStep('input');
    }
  };

  const handleFinalAssessmentSubmit = async () => {
    setStep('processing');
    setProcessingStage(0);

    let apiPromise;
    try {
      apiPromise = fetch(`${API_URL}/api/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          title, 
          description, 
          context: userContext, 
          userAnswers: adaptiveTextAnswers, 
          mcqAnswers: selectedMcqAnswers 
        }),
      });
    } catch (err) {
      setError('Could not connect to server.');
      setStep('assessment');
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
        setError(result.error || 'Failed to compute final diagnostic pathway.');
        setStep('assessment');
        return;
      }

      setAnalysisData(result.data);
      setChatHistory([]); 
      setActiveTab('overview');
      setStep('results');
    } catch (err) {
      clearInterval(interval);
      setError(err.message || 'Could not connect to the server.');
      setStep('assessment');
    }
  };

  const handleCopyDraft = () => {
    if (!analysisData?.draftTemplate) return;
    const textToCopy = `To: ${analysisData.draftTemplate.recipient}\nSubject: ${analysisData.draftTemplate.subject}\n\n${analysisData.draftTemplate.body}`;
    navigator.clipboard.writeText(textToCopy);
    setCopied(true);

    const nextCount = copyCount + 1;
    setCopyCount(nextCount);

    if (nextCount === 1) {
      triggerCustomAlert('Letter template copied to clipboard!', 'success');
    } else {
      triggerCustomAlert(`Letter copied (${nextCount}x multi-strike!)! 🎯`, 'success');
    }

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

  const currentAssessmentItem = assessmentItems[activeAssessmentIndex];

  return (
    <div className="verlo-app" style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column', boxSizing: 'border-box', position: 'relative' }}>
      {customAlert && (
        <div style={{ 
          position: 'fixed', 
          top: '20px', 
          left: '50%', 
          transform: alertExiting ? 'translateX(-50%) translateY(-20px)' : 'translateX(-50%) translateY(0)', 
          opacity: alertExiting ? 0 : 1,
          transition: 'all 0.3s cubic-bezier(0.16, 1, 0.3, 1)',
          zIndex: 9999, 
          background: customAlert.type === 'error' ? '#ef4444' : '#10b981', 
          color: '#fff', 
          padding: '0.75rem 1.5rem', 
          borderRadius: '8px', 
          boxShadow: '0 4px 12px rgba(0,0,0,0.3)', 
          fontSize: '0.9rem', 
          fontWeight: 600, 
          display: 'flex', 
          alignItems: 'center', 
          gap: '0.5rem' 
        }}>
          <span>{customAlert.type === 'error' ? '⚠️' : '✓'}</span>
          <span>{customAlert.message}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }} onClick={() => setStep('landing')}>
          <img src="/VVNormal.png" alt="VERLO Logo" style={{ width: '28px', height: '28px', objectFit: 'contain' }} />
          <span style={{ fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-main)', fontSize: '1.1rem' }}>VERLO</span>
        </div>
        
        {currentUser ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
            <button 
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
            >
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
              History ({userHistory.length})
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
              {currentUser.email || currentUser.id}
            </span>
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

      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '850px', margin: '0 auto', padding: '0 1.25rem 3rem 1.25rem', boxSizing: 'border-box', alignItems: 'center' }}>
        {step === 'landing' && (
          <div className="page-transition" key="landing" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="verlo-header" style={{ marginTop: '1rem', textAlign: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem', width: '100%' }}>
                <img src="/VVNormal.png" alt="VERLO Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                <span className="verlo-brand" style={{ margin: 0 }}>VERLO</span>
              </div>
              <h1 className="verlo-title">Stop guessing. Know your exact next step.</h1>
              <p className="verlo-subtitle" style={{ marginBottom: '2.5rem', maxWidth: '650px', marginInline: 'auto' }}>
                Verlo is an adaptive supercharged decision-intelligence engine that transforms messy, stressful situations into a fully tailored, risk-scored action pathway through dynamic profiling.
              </p>
              <button className="btn-primary" style={{ maxWidth: '300px', margin: '0 auto 3rem' }} onClick={() => setStep('input')}>
                Launch Decision Engine →
              </button>

              <div style={{ textAlign: 'center', width: '100%', maxWidth: '650px', margin: '0 auto 4rem' }}>
                <p style={{ fontSize: '0.8rem', color: 'var(--text-muted)', marginBottom: '1rem', textTransform: 'uppercase', letterSpacing: '0.08em', textAlign: 'center' }}>
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
                    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: 'var(--accent)', flexShrink: 0 }}>
                      <path d="M21 16v-2l-8-5V3.5c0-.83-.67-1.5-1.5-1.5S10 2.67 10 3.5V9l-8 5v2l8-2.5V19l-2 1.5V22l3.5-1 3.5 1v-1.5L13 19v-5.5l8 2.5z"/>
                    </svg>
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
                      'Landlord withholding bond', 
                      'My tenancy agreement ended 3 weeks ago and my landlord is refusing to release my full $2,000 security deposit, claiming minor carpet scuffs that were already present when I moved in as documented on my condition report.',
                      'First-time renter moving into a new apartment'
                    )}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}><path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/><polyline points="9 22 9 12 15 12 15 22"/></svg>
                    <div>
                      <strong>Landlord withholding bond</strong> &mdash; Disputing false wear-and-tear deductions.
                    </div>
                  </div>

                  <div 
                    className="verlo-card" 
                    style={{ padding: '1rem 1.25rem', cursor: 'pointer', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '1rem', width: '100%', boxSizing: 'border-box' }}
                    onClick={() => handleExampleSelect(
                      'Defective laptop warranty dispute', 
                      'I purchased a high-end laptop 5 months ago that has suffered multiple motherboard failures. The manufacturer service center is claiming accidental liquid damage violation even though the machine has never been exposed to liquids.',
                      'Student relying on laptop for coursework'
                    )}
                  >
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ color: 'var(--accent)', flexShrink: 0 }}><rect x="2" y="3" width="20" height="14" rx="2" ry="2"/><line x1="8" y1="21" x2="16" y2="21"/><line x1="12" y1="17" x2="12" y2="21"/></svg>
                    <div>
                      <strong>Defective laptop warranty</strong> &mdash; Manufacturer denying warranty repair unfairly.
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
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                >
                  ← Back to Overview
                </button>
              </div>

              <div className="verlo-header" style={{ marginTop: '1rem', marginBottom: '2rem', textAlign: 'center', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem', width: '100%' }}>
                  <img src="/VVNormal.png" alt="VERLO Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                  <span className="verlo-brand" style={{ margin: 0 }}>VERLO</span>
                </div>
                <h2 className="verlo-title" style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Define Your Situation</h2>
                <p className="verlo-subtitle" style={{ margin: 0, textAlign: 'center' }}>Provide the details below. Our adaptive engine will formulate custom probing questions before constructing your report.</p>
              </div>

              {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)', width: '100%', boxSizing: 'border-box', textAlign: 'center' }}>{error}</div>}

              <form onSubmit={handleInitialSubmit} className="verlo-card" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left' }}>
                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label">Situation Title (Optional)</label>
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

                <div className="form-group" style={{ textAlign: 'left' }}>
                  <label className="form-label">Any specific personal context or constraints? (Optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g., I'm a student living on a tight budget" 
                    value={userContext}
                    onChange={(e) => setUserContext(e.target.value)}
                  />
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                  Generate Adaptive Assessment →
                </button>
              </form>
            </div>
          </div>
        )}
        {step === 'assessment' && assessmentData && currentAssessmentItem && (
          <div className="page-transition animate-fade-slide-up" key="assessment" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '650px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', width: '100%' }}>
                <button 
                  onClick={handleAssessmentPrev}
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                >
                  ← Back
                </button>
                <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                  Question {activeAssessmentIndex + 1} of {assessmentItems.length}
                </span>
              </div>
              <div style={{ width: '100%', height: '4px', background: 'var(--bg-surface)', borderRadius: '2px', marginBottom: '2rem', overflow: 'hidden' }}>
                <div style={{ width: `${((activeAssessmentIndex + 1) / assessmentItems.length) * 100}%`, height: '100%', background: 'var(--accent)', transition: 'width 0.3s ease' }} />
              </div>

              <div className="verlo-header" style={{ marginTop: '0.5rem', marginBottom: '1.5rem', textAlign: 'center', width: '100%' }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '0.75rem', width: '100%' }}>
                  <img src="/VVNormal.png" alt="VERLO Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
                  <span className="verlo-brand" style={{ margin: 0 }}>Adaptive Intelligence Matrix</span>
                </div>
                <h2 className="verlo-title" style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Refine Your Parameters</h2>
                <p className="verlo-subtitle" style={{ margin: 0, textAlign: 'center' }}>Answering these custom inquiries ensures your final action pathway is laser-focused.</p>
              </div>

              <div className="verlo-card" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', margin: 0 }}>
                {currentAssessmentItem.type === 'mcq' ? (
                  <div>
                    <label className="form-label" style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: '1rem', display: 'block', fontSize: '1rem' }}>
                      {currentAssessmentItem.stem}
                    </label>
                    <div style={{ display: 'grid', gap: '0.75rem' }}>
                      {currentAssessmentItem.choices.map((choice, cIndex) => {
                        const isSelected = selectedMcqAnswers[currentAssessmentItem.id || activeAssessmentIndex] === choice;
                        return (
                          <div 
                            key={cIndex}
                            onClick={() => setSelectedMcqAnswers({ ...selectedMcqAnswers, [currentAssessmentItem.id || activeAssessmentIndex]: choice })}
                            style={{ 
                              padding: '1rem', 
                              borderRadius: '8px', 
                              border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                              background: isSelected ? 'rgba(16, 185, 129, 0.08)' : 'var(--bg-card)',
                              color: 'var(--text-main)',
                              cursor: 'pointer',
                              fontSize: '0.95rem',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <div style={{ 
                              width: '18px', height: '18px', borderRadius: '50%', 
                              border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--text-muted)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                              {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />}
                            </div>
                            <span>{choice}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="form-label" style={{ fontWeight: 700, marginBottom: '1rem', display: 'block', fontSize: '1rem' }}>
                      {currentAssessmentItem.question}
                    </label>
                    <input 
                      type="text" 
                      className="form-input" 
                      placeholder="Type your precise specification here and press Enter..."
                      value={adaptiveTextAnswers[currentAssessmentItem.id || activeAssessmentIndex] || ''}
                      onChange={(e) => setAdaptiveTextAnswers({ ...adaptiveTextAnswers, [currentAssessmentItem.id || activeAssessmentIndex]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          e.preventDefault();
                          handleAssessmentNext();
                        }
                      }}
                      style={{ fontSize: '1rem', padding: '0.85rem' }}
                      autoFocus
                    />
                  </div>
                )}
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1.5rem', width: '100%' }}>
                <button 
                  onClick={handleAssessmentNext} 
                  className="btn-primary" 
                  style={{ width: 'auto', padding: '0.75rem 2rem' }}
                >
                  {activeAssessmentIndex === assessmentItems.length - 1 ? 'Synthesise Final Report →' : 'Next Question →'}
                </button>
              </div>
            </div>
          </div>
        )}
        {step === 'processing' && (
          <div className="page-transition processing-container" key="processing" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' }}>
            <div className="processing-pulse-ring"></div>
            <h2 style={{ fontSize: '1.5rem', marginTop: '1.5rem', color: 'var(--text-main)', textAlign: 'center' }}>Synthesising supercharged logic & links...</h2>
            
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
            <div style={{ width: '100%', maxWidth: '800px' }}>
              
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.25rem', flexWrap: 'wrap', gap: '0.75rem', width: '100%' }}>
                <div style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap' }}>
                  <button 
                    onClick={() => setStep('input')}
                    style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer' }}
                  >
                    ← New Situation
                  </button>
                  <button 
                    onClick={() => handleSaveToAccount(analysisData)}
                    style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
                  >
                    <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M19 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h11l5 5v11a2 2 0 0 1-2 2z"/><polyline points="17 21 17 13 7 13 7 21"/><polyline points="7 3 7 8 15 8"/></svg>
                    Save Pathway
                  </button>
                </div>
                <button 
                  onClick={() => setStep('landing')} 
                  style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.45rem 0.9rem', borderRadius: '8px', fontSize: '0.8rem', cursor: 'pointer' }}
                >
                  Start Over
                </button>
              </div>

              <div className="result-section animate-fade-slide-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-surface)', width: '100%', boxSizing: 'border-box', marginBottom: '1.25rem' }}>
                <div>
                  <span className={`badge ${analysisData.confidence?.toLowerCase()}`} style={{ marginBottom: '0.25rem', display: 'inline-block' }}>
                    Confidence: {analysisData.confidence}
                  </span>
                  {userContext && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>Tailored for: <em>"{userContext}"</em></div>}
                </div>
                <div style={{ display: 'flex', gap: '1.25rem', fontSize: '0.85rem', flexWrap: 'wrap' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Severity:</span><br/>
                    <strong style={{ color: Number(analysisData.riskAssessment?.severityScore) > 7 ? 'var(--danger)' : 'var(--warning)' }}>
                      {analysisData.riskAssessment?.severityScore}/10
                    </strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Exposure:</span><br/>
                    <strong>{analysisData.riskAssessment?.financialExposure}</strong>
                  </div>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Urgency:</span><br/>
                    <strong>{analysisData.riskAssessment?.timeSensitivity}</strong>
                  </div>
                </div>
              </div>

              <div style={{ display: 'flex', gap: '0.3rem', background: 'var(--bg-surface)', padding: '0.3rem', borderRadius: '10px', border: '1px solid var(--border-subtle)', marginBottom: '1.25rem', overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
                {[
                  { id: 'overview', label: '⚡ Overview' },
                  { id: 'panels', label: '🧩 Panels' },
                  { id: 'steps', label: '📋 Action Steps' },
                  { id: 'letter', label: '✉️ Letter' },
                  { id: 'resources', label: '🔗 Resources' }
                ].map(tab => {
                  const isActive = activeTab === tab.id;
                  return (
                    <button
                      key={tab.id}
                      onClick={() => setActiveTab(tab.id)}
                      style={{
                        flex: '1 1 auto',
                        padding: '0.6rem 0.8rem',
                        borderRadius: '7px',
                        border: 'none',
                        background: isActive ? 'var(--accent)' : 'transparent',
                        color: isActive ? 'var(--bg-primary)' : 'var(--text-muted)',
                        fontWeight: isActive ? 700 : 500,
                        fontSize: '0.82rem',
                        cursor: 'pointer',
                        whiteSpace: 'nowrap',
                        transition: 'all 0.2s ease'
                      }}
                    >
                      {tab.label}
                    </button>
                  );
                })}
              </div>

              {activeTab === 'overview' && (
                <div style={{ display: 'grid', gap: '1.25rem', width: '100%' }}>
                  <div className="dominant-action animate-fade-slide-up" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', margin: 0 }}>
                    <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      Immediate Priority Action
                    </h3>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem' }}>{analysisData.nextSteps?.[0]?.step || "Review strategic options below."}</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 0 }}>
                      <strong>Why this first:</strong> {analysisData.nextSteps?.[0]?.why || "Establishes your foundational position."}
                    </p>
                  </div>

                  {analysisData.situation && (
                    <div className="result-section animate-fade-slide-up" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', margin: 0 }}>
                      <h3 style={{ color: 'var(--text-main)', marginBottom: '0.75rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        Situation Summary
                      </h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0 }}>{analysisData.situation}</p>
                    </div>
                  )}

                  <div className="result-section animate-fade-slide-up" style={{ background: 'var(--bg-surface)', width: '100%', boxSizing: 'border-box', textAlign: 'left', margin: 0 }}>
                    <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      Ask VERLO AI Assistant
                    </h3>
                    <p style={{ fontSize: '0.82rem', color: 'var(--text-muted)', marginBottom: '0.75rem' }}>Need immediate clarification or a follow-up response?</p>
                    {chatHistory.length > 0 && (
                      <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '0.75rem', maxHeight: '250px', overflowY: 'auto', paddingRight: '0.4rem', width: '100%', boxSizing: 'border-box' }}>
                        {chatHistory.map((msg, index) => (
                          <div 
                            key={index} 
                            style={{ 
                              background: msg.role === 'user' ? 'var(--bg-card)' : 'rgba(16, 185, 129, 0.08)', 
                              padding: '0.75rem', 
                              borderRadius: '8px', 
                              border: '1px solid var(--border-subtle)',
                              fontSize: '0.85rem',
                              width: '100%',
                              boxSizing: 'border-box'
                            }}
                          >
                            <strong style={{ display: 'block', marginBottom: '0.2rem', color: msg.role === 'user' ? 'var(--text-main)' : 'var(--accent)' }}>
                              {msg.role === 'user' ? 'You' : 'VERLO AI'}
                            </strong>
                            {msg.role === 'user' ? (
                              <div style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                            ) : (
                              <div style={{ color: 'var(--text-muted)' }} dangerouslySetInnerHTML={{ __html: renderMarkdownToHTML(msg.content) }} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                    <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="e.g., What should I do if they ignore this?" 
                        value={chatQuestion}
                        onChange={(e) => setChatQuestion(e.target.value)}
                        // LUCKY NUMBER 888
                        disabled={isChatLoading}
                        style={{ marginBottom: 0, flex: '1 1 200px' }}
                      />
                      <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem', marginTop: 0 }} disabled={isChatLoading}>
                        {isChatLoading ? '...' : 'Ask'}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {activeTab === 'panels' && (
                <div className="result-section animate-fade-slide-up" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', margin: 0 }}>
                  <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="3" y="3" width="18" height="18" rx="2" ry="2"/><line x1="3" y1="9" x2="21" y2="9"/><line x1="9" y1="21" x2="9" y2="9"/></svg>
                    Personalised Issue Solution Panels
                  </h3>
                  {(!analysisData.personalizedPanels || analysisData.personalizedPanels.length === 0) ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No custom panels generated for this query.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '1rem', width: '100%' }}>
                      {analysisData.personalizedPanels.map((panel, pIdx) => (
                        <div key={pIdx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent)', marginBottom: '0.4rem' }}>{panel.panelTitle}</div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: '1.4' }} dangerouslySetInnerHTML={{ __html: renderMarkdownToHTML(panel.insight) }} />
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: '6px' }}>
                            <strong>Recommended Solution:</strong> {panel.solution}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === 'steps' && (
                <div className="result-section animate-fade-slide-up" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', margin: 0 }}>
                  <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/><line x1="8" y1="18" x2="21" y2="18"/><line x1="3" y1="6" x2="3.01" y2="6"/><line x1="3" y1="12" x2="3.01" y2="12"/><line x1="3" y1="18" x2="3.01" y2="18"/></svg>
                    Full Step-by-Step Action Pathway
                  </h3>
                  <div style={{ display: 'grid', gap: '1rem', width: '100%' }}>
                    {analysisData.nextSteps?.map((item, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '1.2rem', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                          <span style={{ background: 'var(--accent)', color: 'var(--bg-primary)', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{idx + 1}</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)' }}>{item.step}</strong>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '1.9rem', marginBottom: '0.3rem' }}><strong>Why:</strong> {item.why}</p>
                        {item.pitfallWarning && (
                          <p style={{ fontSize: '0.85rem', color: 'var(--danger)', marginLeft: '1.9rem', marginBottom: 0 }}><strong>⚠️ Pitfall to Avoid:</strong> {item.pitfallWarning}</p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === 'letter' && (
                <div className="result-section animate-fade-slide-up" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.3)', width: '100%', boxSizing: 'border-box', textAlign: 'left', margin: 0 }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                    <h3 style={{ color: 'var(--accent)', fontSize: '0.95rem', marginBottom: 0, display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M4 4h16c1.1 0 2 .9 2 2v12c0 1.1-.9 2-2 2H4c-1.1 0-2-.9-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/></svg>
                      Automated Resolution Letter
                    </h3>
                    <button 
                      onClick={handleCopyDraft}
                      style={{ background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', padding: '0.35rem 0.85rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}
                    >
                      {copied ? 'Copied!' : 'Copy Letter Template'}
                    </button>
                  </div>
                  {analysisData.draftTemplate ? (
                    <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', whiteSpace: 'pre-wrap', overflowX: 'auto', width: '100%', boxSizing: 'border-box' }}>
                      {`To: ${analysisData.draftTemplate.recipient}\nSubject: ${analysisData.draftTemplate.subject}\n\n${analysisData.draftTemplate.body}`}
                    </div>
                  ) : (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No template generated for this situation.</p>
                  )}
                </div>
              )}

              {activeTab === 'resources' && (
                <div className="result-section animate-fade-slide-up" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', margin: 0 }}>
                  <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem', fontSize: '1.05rem' }}>
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M10 13a5 5 0 0 0 7.54.54l3-3a5 5 0 0 0-7.07-7.07l-1.72 1.71"/><path d="M14 11a5 5 0 0 0-7.54-.54l-3 3a5 5 0 0 0 7.07 7.07l1.71-1.71"/></svg>
                    Authoritative Resources & Links
                  </h3>
                  {(!analysisData.referenceLinks || analysisData.referenceLinks.length === 0) ? (
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No external links provided for this pathway.</p>
                  ) : (
                    <div style={{ display: 'grid', gap: '0.5rem', width: '100%' }}>
                      {analysisData.referenceLinks.map((linkObj, lIdx) => (
                        <a 
                          key={lIdx} 
                          href={linkObj.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ background: 'var(--bg-card)', padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', color: 'var(--accent)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem' }}
                        >
                          <span>🔗 <strong>{linkObj.title}</strong></span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Visit →</span>
                        </a>
                      ))}
                    </div>
                  )}
                </div>
              )}

            </div>
          </div>
        )}
      </div>

      <footer style={{ borderTop: '1px solid var(--border-subtle)', padding: '2rem 1rem', background: 'var(--bg-surface)', width: '100%', boxSizing: 'border-box', marginTop: 'auto', textAlign: 'center', flexShrink: 0 }}>
        <div style={{ maxWidth: '1000px', margin: '0 auto', display: 'flex', flexDirection: 'column', gap: '0.75rem', alignItems: 'center' }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
            <img src="/VVNormal.png" alt="VERLO Logo" style={{ width: '20px', height: '20px', objectFit: 'contain' }} />
            <span style={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.9rem', color: 'var(--text-main)' }}>VERLO</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            &copy; {new Date().getFullYear()} VERLO Engine. All rights reserved. Crafted with 🌶️. 
          </div>
        </div>
      </footer>

      {showHistoryDrawer && (
        <div className="animate-slide-in-right" style={{ position: 'fixed', top: 0, right: 0, width: '100%', maxWidth: '380px', height: '100%', background: 'var(--bg-card)', borderLeft: '1px solid var(--border-subtle)', zIndex: 100, padding: '1.5rem', overflowY: 'auto', boxShadow: '-5px 0 25px rgba(0,0,0,0.5)', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0, fontSize: '1.1rem' }}>Your Saved Pathways</h3>
            <button onClick={() => setShowHistoryDrawer(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
          </div>
          {userHistory.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No saved reports yet. Click "Save Pathway" on any result screen!</p>
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
                    setActiveTab('overview');
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

      {showAuthModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200, padding: '1rem', boxSizing: 'border-box' }}>
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-subtle)', width: '100%', maxWidth: '400px', boxSizing: 'border-box', textAlign: 'left' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: '0' }}>{authMode === 'login' ? 'Log in to VERLO' : 'Create an Account'}</h3>
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