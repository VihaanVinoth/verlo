import React, { useState, useEffect } from 'react';
import './index.css';

const API_URL = import.meta.env.VITE_API_URL || 'http://127.0.0.1:5001';

export default function App() {
  const [step, setStep] = useState('landing'); 
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [userContext, setUserContext] = useState('');
  
  const [wizardQuestions, setWizardQuestions] = useState([]);
  const [wizardAnswers, setWizardAnswers] = useState({});
  
  const [analysisData, setAnalysisData] = useState(null);
  const [processingStage, setProcessingStage] = useState(0);
  const [error, setError] = useState(null);
  const [copied, setCopied] = useState(false);

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
    "Synthesising diagnostic variables..",
    "Screening through moderation & safety filters...",
    "Evaluating risk severity & exposure metrics...",
    "Generating comprehensive master report dashboard...",
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
      if (!res.ok) throw new Error(data.error || 'Authentication failed');

      setCurrentUser(data.user);
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
      if (data.history) setUserHistory(data.history);
      triggerCustomAlert('Pathway saved successfully!', 'success');
    } catch (err) {
      triggerCustomAlert('Error saving pathway.', 'error');
    }
  };

  const handleInitialSubmit = async (e) => {
    e.preventDefault();
    if (wordCount < MIN_WORDS) {
      setError(`Please provide at least ${MIN_WORDS} words so VERLO can configure your adaptive wizard.`);
      return;
    }

    setError(null);
    setStep('processing');
    setProcessingStage(0);

    try {
      const res = await fetch(`${API_URL}/api/generate-questions`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt: `${title ? title + ': ' : ''}${description}` }),
      });
      const data = await res.json();

      if (!res.ok) {
        setError(data.error || 'Failed to generate adaptive questions.');
        setStep('landing');
        return;
      }

      setWizardQuestions(data.questions || []);
      setWizardAnswers({});
      setStep('wizard');
    } catch (err) {
      setError('Could not connect to server.');
      setStep('landing');
    }
  };

  const handleWizardSubmit = async (e) => {
    e.preventDefault();
    
    const unanswered = wiardQuestions.some((_, idx) => !wizardAnswers[idx]);
    if (unanswered) {
      triggerCustomAlert('Please select an option for all questions before proceeding.', 'error');
      return;
    }

    setStep('processing');
    setProcessingStage(0);

    let currentStage = 0;
    const intervalTime = 700;

    const interval = setInterval(() => {
      currentStage += 1;
      if (currentStage < processingSteps.length) setProcessingStage(currentStage);
      else clearInterval(interval);
    }, intervalTime);

    try {
      const formattedAnswers = wizardQuestions.map((qObj, idx) => ({
        question: qObj.question,
        answer: wizardAnswers[idx]
      }));

      const totalAnimationTime = processingSteps.length * intervalTime;
      const [res] = await Promise.all([
        fetch(`${API_URL}/api/generate-report`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ prompt: `${title ? title + ': ' : ''}${description}`, answers: formattedAnswers }),
        }),
        new Promise(resolve => setTimeout(resolve, totalAnimationTime))
      ]);

      const result = await res.json();
      clearInterval(interval);

      if (!res.ok) {
        setError(result.error || 'Master report generation failed.');
        setStep('wizard');
        return;
      }

      setAnalysisData(result.data);
      setChatHistory([]);
      setStep('results');
    } catch (err) {
      clearInterval(interval);
      setError('Could not connect to the server for report generation.');
      setStep('wizard');
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
              style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer' }}
            >
              Saved History ({userHistory.length})
            </button>
            <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>{currentUser.email}</span>
            <button onClick={handleLogout} style={{ background: 'none', border: '1px solid var(--border-subtle)', color: 'var(--danger)', padding: '0.3rem 0.6rem', borderRadius: '6px', fontSize: '0.8rem', cursor: 'pointer' }}>Logout</button>
          </div>
        ) : (
          <button onClick={() => { setAuthMode('login'); setAuthError(null); setShowAuthModal(true); }} style={{ background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
            Login / Signup
          </button>
        )}
      </div>

      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '800px', margin: '0 auto', padding: '0 1.5rem 3rem 1.5rem', boxSizing: 'border-box', alignItems: 'center' }}>
        
        {step === 'landing' && (
          <div className="page-transition" key="landing" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="verlo-header" style={{ marginTop: '1rem', textAlign: 'center', width: '100%' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem' }}>
                <img src="/VVNormal.png" alt="VERLO Logo" style={{ width: '40px', height: '40px', objectFit: 'contain' }} />
                <span className="verlo-brand" style={{ margin: 0 }}>VERLO</span>
              </div>
              <h1 className="verlo-title">Decision Intelligence Wizard</h1>
              <p className="verlo-subtitle" style={{ marginBottom: '2rem', maxWidth: '650px', marginInline: 'auto' }}>
                Transform complex challenges into dynamic, AI-generated multiple-choice clarification flows, culminating in a comprehensive master report dashboard.
              </p>
            </div>

            <div style={{ width: '100%', maxWidth: '650px' }}>
              {error && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.9rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.75rem', borderRadius: '8px', border: '1px solid rgba(239, 68, 68, 0.3)' }}>{error}</div>}

              <form onSubmit={handleInitialSubmit} className="verlo-card" style={{ width: '100%', boxSizing: 'border-box' }}>
                <div className="form-group">
                  <label className="form-label">Situation Title (Optional)</label>
                  <input type="text" className="form-input" placeholder="e.g., Commercial contract dispute" value={title} onChange={(e) => setTitle(e.target.value)} />
                </div>

                <div className="form-group">
                  <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.5rem' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Describe what happened *</label>
                    <span style={{ fontSize: '0.8rem', color: wordCount < MIN_WORDS ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {wordCount} words {wordCount < MIN_WORDS ? `(Min ${MIN_WORDS})` : '✓'}
                    </span>
                  </div>
                  <textarea className="form-textarea" placeholder="Include timeline, core issues, and your objective..." value={description} onChange={(e) => setDescription(e.target.value)} required />
                </div>

                <button type="submit" className="btn-primary" style={{ width: '100%' }}>
                  Launch Adaptive Wizard →
                </button>
              </form>
            </div>
          </div>
        )}
        {step === 'wizard' && (
          <div className="page-transition" key="wizard" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '680px' }}>
              <div className="verlo-header" style={{ marginBottom: '2rem', textAlign: 'center' }}>
                <h2 className="verlo-title" style={{ fontSize: '2rem' }}>Targeted Clarification</h2>
                <p className="verlo-subtitle">VERLO generated these questions dynamically based on your situation. Select the best option for each:</p>
              </div>

              <form onSubmit={handleWizardSubmit} className="verlo-card" style={{ width: '100%', boxSizing: 'border-box' }}>
                {wizardQuestions.map((qObj, idx) => (
                  <div key={idx} style={{ marginBottom: '2rem', borderBottom: idx < wizardQuestions.length - 1 ? '1px solid var(--border-subtle)' : 'none', paddingBottom: idx < wizardQuestions.length - 1 ? '1.5rem' : '0' }}>
                    <label style={{ color: 'var(--text-main)', fontWeight: 600, fontSize: '0.95rem', display: 'block', marginBottom: '0.75rem' }}>
                      {idx + 1}. {qObj.question}
                    </label>
                    
                    <div style={{ display: 'grid', gap: '0.5rem' }}>
                      {qObj.options?.map((opt, optIdx) => {
                        const isSelected = wizardAnswers[idx] === opt;
                        return (
                          <button
                            type="button"
                            key={optIdx}
                            onClick={() => setWizardAnswers({ ...wizardAnswers, [idx]: opt })}
                            style={{
                              background: isSelected ? 'rgba(16, 185, 129, 0.15)' : 'var(--bg-card)',
                              color: isSelected ? 'var(--accent)' : 'var(--text-main)',
                              border: `1px solid ${isSelected ? 'var(--accent)' : 'var(--border-subtle)'}`,
                              padding: '0.75rem 1rem',
                              borderRadius: '8px',
                              textAlign: 'left',
                              fontSize: '0.9rem',
                              cursor: 'pointer',
                              fontWeight: isSelected ? 600 : 400,
                              display: 'flex',
                              alignItems: 'center',
                              gap: '0.75rem',
                              transition: 'all 0.2s ease'
                            }}
                          >
                            <span style={{ 
                              width: '16px', height: '16px', borderRadius: '50%', 
                              border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--text-muted)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '10px'
                            }}>
                              {isSelected && '✓'}
                            </span>
                            <span>{opt}</span>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}

                <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                  <button type="button" onClick={() => setStep('landing')} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.75rem 1.5rem', borderRadius: '8px', cursor: 'pointer' }}>
                    Back
                  </button>
                  <button type="submit" className="btn-primary" style={{ flex: 1, marginTop: 0 }}>
                    Generate Master Report Dashboard →
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        {step === 'processing' && (
          <div className="page-transition processing-container" key="processing" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', padding: '3rem 0' }}>
            <div className="processing-pulse-ring"></div>
            <h2 style={{ fontSize: '1.5rem', marginTop: '1.5rem', color: 'var(--text-main)' }}>Synthesising Master Intelligence...</h2>
            <div className="processing-steps" style={{ width: '100%', maxWidth: '450px', marginTop: '2rem' }}>
              {processingSteps.map((text, idx) => {
                const isDone = idx < processingStage;
                const isActive = idx === processingStage;
                return (
                  <div key={idx} style={{ display: 'flex', justifyContent: 'space-between', padding: '0.75rem 1rem', background: 'var(--bg-card)', marginBottom: '0.5rem', borderRadius: '6px', border: '1px solid var(--border-subtle)' }}>
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
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem', flexWrap: 'wrap', gap: '0.75rem' }}>
                <div style={{ display: 'flex', gap: '0.75rem' }}>
                  <button onClick={() => setStep('landing')} style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', cursor: 'pointer' }}>
                    ← New Analysis
                  </button>
                  <button onClick={() => handleSaveToAccount(analysisData)} style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid var(--accent)', color: 'var(--accent)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, cursor: 'pointer' }}>
                    Save to Account
                  </button>
                </div>
              </div>

              <div className="result-section animate-fade-slide-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-surface)' }}>
                <div>
                  <span className={`badge ${analysisData.confidence?.toLowerCase()}`} style={{ marginBottom: '0.25rem', display: 'inline-block' }}>
                    Confidence: {analysisData.confidence}
                  </span>
                </div>
                <div style={{ display: 'flex', gap: '1.5rem', fontSize: '0.85rem' }}>
                  <div>
                    <span style={{ color: 'var(--text-muted)' }}>Severity:</span><br/>
                    <strong>{analysisData.riskAssessment?.severityScore}/10</strong>
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

              <div className="dominant-action animate-fade-slide-up">
                <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '0.5rem' }}>
                  Immediate Priority Action
                </h3>
                <h2>{analysisData.nextSteps?.[0]?.step || "Review strategic options below."}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem', marginBottom: 0 }}>
                  <strong>Why this first:</strong> {analysisData.nextSteps?.[0]?.why}
                </p>
              </div>

              <div className="result-section animate-fade-slide-up">
                <h3 style={{ color: 'var(--text-main)', marginBottom: '1rem' }}>Full Step-by-Step Action Roadmap</h3>
                <div style={{ display: 'grid', gap: '1rem' }}>
                  {analysisData.nextSteps?.map((item, idx) => (
                    <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '1.2rem', borderRadius: '8px' }}>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem' }}>
                        <span style={{ background: 'var(--accent)', color: 'var(--bg-primary)', width: '24px', height: '24px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700 }}>{idx + 1}</span>
                        <strong style={{ fontSize: '0.95rem', color: 'var(--text-main)' }}>{item.step}</strong>
                      </div>
                      <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '2.1rem', marginBottom: '0.3rem' }}><strong>Why:</strong> {item.why}</p>
                      {item.pitfallWarning && (
                        <p style={{ fontSize: '0.85rem', color: 'var(--danger)', marginLeft: '2.1rem', marginBottom: 0 }}><strong>⚠️ Pitfall:</strong> {item.pitfallWarning}</p>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {analysisData.draftTemplate && (
                <div className="result-section animate-fade-slide-up" style={{ background: 'rgba(16, 185, 129, 0.05)', borderColor: 'rgba(16, 185, 129, 0.3)' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.75rem' }}>
                    <h3 style={{ color: 'var(--accent)', fontSize: '0.95rem', marginBottom: 0 }}>Automated Resolution Letter</h3>
                    <button onClick={handleCopyDraft} style={{ background: 'var(--accent)', color: 'var(--bg-primary)', border: 'none', padding: '0.3rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer' }}>
                      {copied ? 'Copied!' : 'Copy Letter'}
                    </button>
                  </div>
                  <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', background: 'var(--bg-card)', padding: '1rem', borderRadius: '8px', fontFamily: 'monospace', whiteSpace: 'pre-wrap' }}>
                    {`To: ${analysisData.draftTemplate.recipient}\nSubject: ${analysisData.draftTemplate.subject}\n\n${analysisData.draftTemplate.body}`}
                  </div>
                </div>
              )}

              <div className="result-section animate-fade-slide-up" style={{ background: 'var(--bg-surface)' }}>
                <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem' }}>Consult VERLO AI Assistant</h3>
                <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '1rem' }}>Have questions about this report? Ask below:</p>
                {chatHistory.length > 0 && (
                  <div style={{ display: 'grid', gap: '0.75rem', marginBottom: '1rem', maxHeight: '300px', overflowY: 'auto' }}>
                    {chatHistory.map((msg, index) => (
                      <div key={index} style={{ background: msg.role === 'user' ? 'var(--bg-card)' : 'rgba(16, 185, 129, 0.08)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                        <strong style={{ display: 'block', marginBottom: '0.2rem', color: msg.role === 'user' ? 'var(--text-main)' : 'var(--accent)' }}>
                          {msg.role === 'user' ? 'You' : 'VERLO AI'}
                        </strong>
                        <div style={{ color: 'var(--text-muted)' }} dangerouslySetInnerHTML={{ __html: renderMarkdownToHTML(msg.content) }} />
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
        <div style={{ position: 'fixed', top: 0, right: 0, width: '100%', maxWidth: '380px', height: '100%', background: 'var(--bg-card)', borderLeft: '1px solid var(--border-subtle)', zIndex: 100, padding: '1.5rem', overflowY: 'auto' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <h3 style={{ margin: 0 }}>Saved Pathways</h3>
            <button onClick={() => setShowHistoryDrawer(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
          </div>
          {userHistory.length === 0 ? (
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No saved reports yet.</p>
          ) : (
            <div style={{ display: 'grid', gap: '0.75rem' }}>
              {userHistory.map((item, idx) => (
                <div key={idx} onClick={() => { setTitle(item.title); setDescription(item.description); setAnalysisData(item.result); setStep('results'); setShowHistoryDrawer(false); }} style={{ background: 'var(--bg-surface)', padding: '0.85rem', borderRadius: '8px', border: '1px solid var(--border-subtle)', cursor: 'pointer' }}>
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem' }}>{item.title}</div>
                  <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>{new Date(item.timestamp).toLocaleDateString()}</div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {showAuthModal && (
        <div style={{ position: 'fixed', top: 0, left: 0, width: '100%', height: '100%', background: 'rgba(0,0,0,0.7)', display: 'flex', justifyContent: 'center', alignItems: 'center', zIndex: 200, padding: '1rem' }}>
          <div style={{ background: 'var(--bg-card)', padding: '2rem', borderRadius: '12px', border: '1px solid var(--border-subtle)', width: '100%', maxWidth: '400px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
              <h3 style={{ margin: 0 }}>{authMode === 'login' ? 'Log in' : 'Sign up'}</h3>
              <button onClick={() => setShowAuthModal(false)} style={{ background: 'none', border: 'none', color: 'var(--text-muted)', fontSize: '1.2rem', cursor: 'pointer' }}>✕</button>
            </div>
            {authError && <div style={{ color: 'var(--danger)', marginBottom: '1rem', fontSize: '0.85rem', background: 'rgba(239, 68, 68, 0.1)', padding: '0.5rem', borderRadius: '6px' }}>{authError}</div>}
            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label className="form-label">Email</label>
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