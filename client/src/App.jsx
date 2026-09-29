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

  const [assessmentAttachment, setAssessmentAttachment] = useState(null);
  const [adaptiveAttachments, setAdaptiveAttachments] = useState({});
  const [chatAttachment, setChatAttachment] = useState(null);

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
    "Establishing secure server connection...",
    "Screening through moderation & safety filters...",
    "Evaluating risk severity & exposure metrics...",
    "Synthesising customised action pathway...",
    "Finalising recommendations for review..."
  ];

  const wordCount = description.trim() ? description.trim().split(/\s+/).length : 0;
  const MIN_WORDS = 5;

  const sampleScenarios = [
    {
      title: "Landlord Deposit Dispute",
      description: "My landlord is withholding $1,500 of my security deposit claiming minor carpet stains that were already there when I moved in 12 months ago. They stopped responding to my emails.",
      context: "Tenant on a budget living in Victoria"
    },
    {
      title: "Freelance Client Non-Payment",
      description: "I completed a web development project worth $3,200 two months ago. The client approved the final deployment but is ignoring invoices and payment reminders.",
      context: "Independent software contractor"
    },
    {
      title: "Unfair University Assignment Grade",
      description: "Received a failing grade on a critical group project component despite submitting all peer review logs proving our individual contributions and complete completion.",
      context: "Full-time student balancing coursework"
    }
  ];

  const handleSelectSample = (sample) => {
    setTitle(sample.title);
    setDescription(sample.description);
    setUserContext(sample.context);
    setStep('input');
  };

  useEffect(() => {
    if (currentUser && (currentUser.id || currentUser.email)) {
      localStorage.setItem('verlo_user', JSON.stringify(currentUser));
      const identifier = currentUser.id || currentUser.email;
      fetch(`${API_URL}/api/history/${identifier}`)
        .then(res => res.json())
        .then(data => {
          if (data.history) setUserHistory(data.history);
        })
        .catch(err => console.error(err));
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
      triggerCustomAlert('Error saving pathway to account history.', 'error');
    }
  };

  const handleFileUpload = async (file, targetContext, questionId = null) => {
    if (!file) return;
    
    if (file.size > 15 * 1024 * 1024) {
      triggerCustomAlert('File exceeds maximum size limit (15MB).', 'error');
      return;
    }

    try {
      triggerCustomAlert('Uploading media to secure backend storage...', 'success');
      
      const reader = new FileReader();
      reader.onload = async () => {
        try {
          const base64Data = reader.result;
          const uploadRes = await fetch(`${API_URL}/api/upload`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              name: file.name,
              size: `${(file.size / 1024).toFixed(1)} KB`,
              type: file.type || 'application/octet-stream',
              data: base64Data,
              ownerId: currentUser ? (currentUser.id || currentUser.email) : 'anonymous'
            })
          });

          const uploadData = await uploadRes.json();
          if (!uploadRes.ok) throw new Error(uploadData.error || 'Server upload failed.');

          const fileMeta = uploadData.file;

          if (targetContext === 'description') {
            setAssessmentAttachment(fileMeta);
            triggerCustomAlert(`File "${file.name}" secured in backend storage.`, 'success');
          } else if (targetContext === 'adaptiveText' && questionId !== null) {
            setAdaptiveAttachments(prev => ({ ...prev, [questionId]: fileMeta }));
            triggerCustomAlert(`File secured for question response.`, 'success');
          } else if (targetContext === 'chat') {
            setChatAttachment(fileMeta);
            triggerCustomAlert(`File attached securely to chat session.`, 'success');
          }
        } catch (innerErr) {
          triggerCustomAlert(innerErr.message || 'Failed to process file stream.', 'error');
        }
      };
      reader.readAsDataURL(file);
    } catch (err) {
      triggerCustomAlert('Failed to upload file to server.', 'error');
    }
  };

  const removeAttachment = (targetContext, questionId = null) => {
    if (targetContext === 'description') {
      setAssessmentAttachment(null);
      triggerCustomAlert('Attachment removed.', 'success');
    } else if (targetContext === 'adaptiveText' && questionId !== null) {
      setAdaptiveAttachments(prev => {
        const updated = { ...prev };
        delete updated[questionId];
        return updated;
      });
      triggerCustomAlert('Attachment removed.', 'success');
    } else if (targetContext === 'chat') {
      setChatAttachment(null);
      triggerCustomAlert('Chat attachment removed.', 'success');
    }
  };

  const handleInitialSubmit = async (e) => {
    e.preventDefault();
    if (wordCount < MIN_WORDS) {
      setError(`Please provide at least ${MIN_WORDS} words.`);
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
        body: JSON.stringify({ title, description, attachment: assessmentAttachment }),
      });
    } catch (err) {
      setError('Could not connect to server.');
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
      setAdaptiveAttachments({});
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
          mcqAnswers: selectedMcqAnswers,
          attachment: assessmentAttachment,
          adaptiveAttachments: adaptiveAttachments
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
    if ((!chatQuestion.trim() && !chatAttachment) || isChatLoading) return;

    const questionText = chatQuestion.trim() || (chatAttachment ? `[Uploaded file: ${chatAttachment.name}]` : '');
    const currentAtt = chatAttachment;
    setChatQuestion('');
    setChatAttachment(null);
    setIsChatLoading(true);

    const newHistory = [...chatHistory, { role: 'user', content: questionText, attachment: currentAtt }];
    setChatHistory(newHistory);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          question: questionText, 
          currentSituation: description || title,
          attachment: currentAtt
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
          gap: '0.5rem',
          maxWidth: '90%',
          boxSizing: 'border-box'
        }}>
          <span>{customAlert.type === 'error' ? '⚠️' : '✓'}</span>
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis' }}>{customAlert.message}</span>
        </div>
      )}
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '1rem 1.5rem', gap: '1rem', width: '100%', boxSizing: 'border-box', flexWrap: 'wrap', borderBottom: '1px solid var(--border-subtle)', background: 'var(--bg-surface)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', cursor: 'pointer' }} onClick={() => setStep('landing')}>
          <img src="/VVNormal.png" alt="VERLO Logo" style={{ width: '32px', height: '32px', objectFit: 'contain' }} />
          <div>
            <span style={{ fontWeight: 800, letterSpacing: '0.05em', color: 'var(--text-main)', fontSize: '1.1rem', display: 'block', lineHeight: 1.1 }}>VERLO</span>
            <span style={{ fontSize: '0.65rem', color: 'var(--accent)', fontWeight: 700 }}>YICTE 2026 Entry</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
          {currentUser ? (
            <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
              <button 
                onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
                style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.85rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: '0.4rem' }}
              >
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/></svg>
                History ({userHistory.length})
              </button>
              <span style={{ fontSize: '0.85rem', color: 'var(--text-muted)' }}>
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
      </div>

      <div style={{ flex: '1 0 auto', display: 'flex', flexDirection: 'column', width: '100%', maxWidth: '850px', margin: '0 auto', padding: '1.5rem 1rem 3rem 1rem', boxSizing: 'border-box', alignItems: 'center' }}>
        
        {step === 'landing' && (
          <div className="page-transition" key="landing" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div className="verlo-header" style={{ marginTop: '1rem', textAlign: 'center', width: '100%', boxSizing: 'border-box' }}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.5rem', marginBottom: '1rem', width: '100%' }}>
                <img src="/VVNormal.png" alt="VERLO Logo" style={{ width: '48px', height: '48px', objectFit: 'contain' }} />
                <span className="verlo-brand" style={{ margin: 0 }}>VERLO</span>
              </div>
              <h1 className="verlo-title" style={{ fontSize: 'clamp(1.75rem, 4vw, 2.75rem)' }}>Stop guessing. Know your exact next step.</h1>
              <p className="verlo-subtitle" style={{ marginBottom: '2rem', maxWidth: '650px', marginInline: 'auto', padding: '0 0.5rem', boxSizing: 'border-box' }}>
                Transform complex dilemmas into rigorous, risk-scored action pathways via adaptive intelligence profiling.
              </p>
              
              <div style={{ display: 'flex', gap: '1rem', justifyContent: 'center', flexWrap: 'wrap', marginBottom: '2.5rem' }}>
                <button className="btn-primary" style={{ maxWidth: '300px', margin: 0 }} onClick={() => setStep('input')}>
                  Launch Decision Engine →
                </button>
              </div>
              <div style={{ width: '100%', marginTop: '1rem', textAlign: 'left' }}>
                <h3 style={{ fontSize: '0.95rem', color: 'var(--text-muted)', marginBottom: '1rem', textAlign: 'center', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                  Or select a sample dilemma to test instantly:
                </h3>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: '1rem', width: '100%' }}>
                  {sampleScenarios.map((sample, sIdx) => (
                    <div 
                      key={sIdx}
                      onClick={() => handleSelectSample(sample)}
                      style={{
                        background: 'var(--bg-card)',
                        border: '1px solid var(--border-subtle)',
                        borderRadius: '10px',
                        padding: '1.25rem',
                        cursor: 'pointer',
                        transition: 'all 0.2s ease',
                        boxSizing: 'border-box',
                        display: 'flex',
                        flexDirection: 'column',
                        justifyContent: 'space-between',
                        textAlign: 'left'
                      }}
                      onMouseEnter={(e) => { e.currentTarget.style.borderColor = 'var(--accent)'; e.currentTarget.style.transform = 'translateY(-2px)'; }}
                      onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'var(--border-subtle)'; e.currentTarget.style.transform = 'translateY(0)'; }}
                    >
                      <div>
                        <h4 style={{ fontSize: '1rem', color: 'var(--text-main)', marginBottom: '0.5rem', marginTop: 0 }}>{sample.title}</h4>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', lineHeight: 1.4, marginBottom: '1rem' }}>{sample.description}</p>
                      </div>
                      <span style={{ fontSize: '0.75rem', color: 'var(--accent)', fontWeight: 600 }}>Try this scenario →</span>
                    </div>
                  ))}
                </div>
              </div>

            </div>
          </div>
        )}

        {step === 'input' && (
          <div className="page-transition" key="input" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '650px', boxSizing: 'border-box' }}>
              <div style={{ marginBottom: '1.5rem', textAlign: 'left', width: '100%' }}>
                <button 
                  onClick={() => setStep('landing')}
                  style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-muted)', padding: '0.5rem 1rem', borderRadius: '8px', fontSize: '0.85rem', fontWeight: 600, display: 'inline-flex', alignItems: 'center', gap: '0.5rem', cursor: 'pointer' }}
                >
                  ← Back to Overview
                </button>
              </div>

              <div className="verlo-header" style={{ marginTop: '0.5rem', marginBottom: '1.5rem', textAlign: 'center', width: '100%' }}>
                <h2 className="verlo-title" style={{ fontSize: '2rem', marginBottom: '0.25rem' }}>Define Your Situation</h2>
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
                  <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '0.5rem', flexWrap: 'wrap', gap: '0.25rem' }}>
                    <label className="form-label" style={{ marginBottom: 0 }}>Describe what happened *</label>
                    <span style={{ fontSize: '0.8rem', color: wordCount < MIN_WORDS ? 'var(--warning)' : 'var(--text-muted)' }}>
                      {wordCount} words {wordCount < MIN_WORDS ? `(Minimum ${MIN_WORDS} required)` : '✓'}
                    </span>
                  </div>
                  
                  <div style={{ position: 'relative', width: '100%' }}>
                    <textarea 
                      className="form-textarea" 
                      placeholder="Include key details: dates, amounts, communications, and desired outcomes..."
                      value={description}
                      onChange={(e) => setDescription(e.target.value)}
                      required
                      style={{ paddingBottom: '3.5rem' }}
                    />
                    <div style={{ position: 'absolute', bottom: '10px', left: '10px', display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                      <label style={{ background: 'var(--accent)', color: 'var(--bg-primary)', padding: '0.4rem 0.8rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 700, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', boxShadow: '0 2px 6px rgba(0,0,0,0.2)' }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Upload Supporting Media
                        <input 
                          type="file" 
                          style={{ display: 'none' }} 
                          onChange={(e) => handleFileUpload(e.target.files[0], 'description')}
                        />
                      </label>
                      <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)' }}>Stored in secure server vault</span>
                    </div>
                  </div>

                  {assessmentAttachment && (
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '0.6rem 0.8rem', borderRadius: '6px', marginTop: '0.5rem', border: '1px solid var(--border-subtle)', fontSize: '0.85rem' }}>
                      <span style={{ color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                        📎 {assessmentAttachment.name} ({assessmentAttachment.size})
                      </span>
                      <button 
                        type="button" 
                        onClick={() => removeAttachment('description')}
                        style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.8rem', fontWeight: 700 }}
                      >
                        Remove
                      </button>
                    </div>
                  )}
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
            <div style={{ width: '100%', maxWidth: '650px', boxSizing: 'border-box' }}>
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
                <h2 className="verlo-title" style={{ fontSize: '1.75rem', marginBottom: '0.25rem' }}>Refine Your Parameters</h2>
              </div>

              <div className="verlo-card" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', margin: 0 }}>
                {currentAssessmentItem.type === 'mcq' ? (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <label className="form-label" style={{ color: 'var(--accent)', fontWeight: 700, marginBottom: 0, display: 'block', fontSize: '1rem' }}>
                        {currentAssessmentItem.stem}
                      </label>
                      <label style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Attach File
                        <input 
                          type="file" 
                          style={{ display: 'none' }} 
                          onChange={(e) => handleFileUpload(e.target.files[0], 'adaptiveText', currentAssessmentItem.id || activeAssessmentIndex)}
                        />
                      </label>
                    </div>

                    {adaptiveAttachments[currentAssessmentItem.id || activeAssessmentIndex] && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                          📎 {adaptiveAttachments[currentAssessmentItem.id || activeAssessmentIndex].name}
                        </span>
                        <button 
                          type="button" 
                          onClick={() => removeAttachment('adaptiveText', currentAssessmentItem.id || activeAssessmentIndex)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          Remove
                        </button>
                      </div>
                    )}

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
                              transition: 'all 0.2s ease',
                              boxSizing: 'border-box'
                            }}
                          >
                            <div style={{ 
                              width: '18px', height: '18px', borderRadius: '50%', 
                              border: `2px solid ${isSelected ? 'var(--accent)' : 'var(--text-muted)'}`,
                              display: 'flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0
                            }}>
                              {isSelected && <div style={{ width: '8px', height: '8px', borderRadius: '50%', background: 'var(--accent)' }} />}
                            </div>
                            <span style={{ wordBreak: 'break-word' }}>{choice}</span>
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1rem', flexWrap: 'wrap', gap: '0.5rem' }}>
                      <label className="form-label" style={{ fontWeight: 700, marginBottom: 0, display: 'block', fontSize: '1rem' }}>
                        {currentAssessmentItem.question}
                      </label>
                      <label style={{ background: 'var(--bg-surface)', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '0.35rem 0.75rem', borderRadius: '6px', fontSize: '0.8rem', fontWeight: 600, cursor: 'pointer', display: 'inline-flex', alignItems: 'center', gap: '0.3rem', flexShrink: 0 }}>
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Attach File
                        <input 
                          type="file" 
                          style={{ display: 'none' }} 
                          onChange={(e) => handleFileUpload(e.target.files[0], 'adaptiveText', currentAssessmentItem.id || activeAssessmentIndex)}
                        />
                      </label>
                    </div>

                    {adaptiveAttachments[currentAssessmentItem.id || activeAssessmentIndex] && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-surface)', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '1rem', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                          📎 {adaptiveAttachments[currentAssessmentItem.id || activeAssessmentIndex].name}
                        </span>
                        <button 
                          type="button" 
                          onClick={() => removeAttachment('adaptiveText', currentAssessmentItem.id || activeAssessmentIndex)}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          Remove
                        </button>
                      </div>
                    )}

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
            <h2 style={{ fontSize: '1.5rem', marginTop: '1.5rem', color: 'var(--text-main)', textAlign: 'center' }}>Synthesising intelligence pathway...</h2>
            
            <div className="processing-steps" style={{ width: '100%', maxWidth: '450px', marginTop: '2rem', boxSizing: 'border-box', padding: '0 1rem' }}>
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
              {/* LUCKY NUMBER 888 */}
            </div>
          </div>
        )}

        {step === 'results' && analysisData && (
          <div className="page-transition animate-fade-slide-up" key="results" style={{ width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center' }}>
            <div style={{ width: '100%', maxWidth: '800px', boxSizing: 'border-box' }}>
              
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
              </div>

              <div className="result-section animate-fade-slide-up" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '1rem', background: 'var(--bg-surface)', width: '100%', boxSizing: 'border-box', marginBottom: '1.25rem' }}>
                <div>
                  <span className={`badge ${analysisData.confidence?.toLowerCase()}`} style={{ marginBottom: '0.25rem', display: 'inline-block' }}>
                    Confidence: {analysisData.confidence}
                  </span>
                  {userContext && <div style={{ fontSize: '0.85rem', color: 'var(--text-muted)', wordBreak: 'break-word' }}>Tailored for: <em>"{userContext}"</em></div>}
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
                <div style={{ display: 'grid', gap: '1.25rem', width: '100%', boxSizing: 'border-box' }}>
                  <div className="dominant-action animate-fade-slide-up" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', margin: 0 }}>
                    <h3 style={{ fontSize: '0.8rem', textTransform: 'uppercase', letterSpacing: '0.08em', color: 'var(--accent)', marginBottom: '0.5rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><polyline points="9 18 15 12 9 6"/></svg>
                      Immediate Priority Action
                    </h3>
                    <h2 style={{ fontSize: '1.25rem', marginBottom: '0.5rem', wordBreak: 'break-word' }}>{analysisData.nextSteps?.[0]?.step || "Review strategic options below."}</h2>
                    <p style={{ color: 'var(--text-muted)', fontSize: '0.9rem', marginBottom: 0, wordBreak: 'break-word' }}>
                      <strong>Why this first:</strong> {analysisData.nextSteps?.[0]?.why || "Establishes your foundational position."}
                    </p>
                  </div>

                  {analysisData.situation && (
                    <div className="result-section animate-fade-slide-up" style={{ width: '100%', boxSizing: 'border-box', textAlign: 'left', margin: 0 }}>
                      <h3 style={{ color: 'var(--text-main)', marginBottom: '0.75rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
                        Situation Summary
                      </h3>
                      <p style={{ fontSize: '0.9rem', color: 'var(--text-muted)', lineHeight: '1.5', margin: 0, wordBreak: 'break-word' }}>{analysisData.situation}</p>
                    </div>
                  )}

                  <div className="result-section animate-fade-slide-up" style={{ background: 'var(--bg-surface)', width: '100%', boxSizing: 'border-box', textAlign: 'left', margin: 0 }}>
                    <h3 style={{ color: 'var(--text-main)', marginBottom: '0.5rem', fontSize: '1rem', display: 'flex', alignItems: 'center', gap: '0.4rem' }}>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/></svg>
                      Ask VERLO AI Assistant
                    </h3>
                    
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
                              boxSizing: 'border-box',
                              wordBreak: 'break-word'
                            }}
                          >
                            <strong style={{ display: 'block', marginBottom: '0.2rem', color: msg.role === 'user' ? 'var(--text-main)' : 'var(--accent)' }}>
                              {msg.role === 'user' ? 'You' : 'VERLO AI'}
                            </strong>
                            {msg.attachment && (
                              <div style={{ fontSize: '0.75rem', color: 'var(--accent)', marginBottom: '0.4rem', fontStyle: 'italic' }}>
                                📎 Attached file: {msg.attachment.name} ({msg.attachment.size})
                              </div>
                            )}
                            {msg.role === 'user' ? (
                              <div style={{ color: 'var(--text-muted)', whiteSpace: 'pre-wrap' }}>{msg.content}</div>
                            ) : (
                              <div style={{ color: 'var(--text-muted)' }} dangerouslySetInnerHTML={{ __html: renderMarkdownToHTML(msg.content) }} />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {chatAttachment && (
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', background: 'var(--bg-card)', padding: '0.5rem 0.75rem', borderRadius: '6px', marginBottom: '0.5rem', border: '1px solid var(--border-subtle)', fontSize: '0.8rem' }}>
                        <span style={{ color: 'var(--accent)', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap', maxWidth: '80%' }}>
                          📎 {chatAttachment.name} ({chatAttachment.size})
                        </span>
                        <button 
                          type="button" 
                          onClick={() => removeAttachment('chat')}
                          style={{ background: 'none', border: 'none', color: 'var(--danger)', cursor: 'pointer', fontSize: '0.75rem', fontWeight: 700 }}
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    <form onSubmit={handleChatSubmit} style={{ display: 'flex', gap: '0.5rem', flexWrap: 'wrap', width: '100%', boxSizing: 'border-box' }}>
                      <input 
                        type="text" 
                        className="form-input" 
                        placeholder="Ask a follow-up question..." 
                        value={chatQuestion}
                        onChange={(e) => setChatQuestion(e.target.value)}
                        disabled={isChatLoading}
                        style={{ marginBottom: 0, flex: '1 1 180px' }}
                      />
                      <label style={{ background: 'var(--accent)', color: 'var(--bg-primary)', padding: '0.5rem 0.85rem', borderRadius: '8px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '0.3rem', fontSize: '0.85rem', fontWeight: 600, flexShrink: 0 }}>
                        <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                        Upload
                        <input 
                          type="file" 
                          style={{ display: 'none' }} 
                          onChange={(e) => handleFileUpload(e.target.files[0], 'chat')}
                        />
                      </label>
                      <button type="submit" className="btn-primary" style={{ width: 'auto', padding: '0.5rem 1rem', marginTop: 0 }} disabled={isChatLoading}>
                        {isChatLoading ? '...' : 'Send'}
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
                    <div style={{ display: 'grid', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
                      {analysisData.personalizedPanels.map((panel, pIdx) => (
                        <div key={pIdx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '1.25rem', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
                          <div style={{ fontWeight: 700, fontSize: '0.95rem', color: 'var(--accent)', marginBottom: '0.4rem', wordBreak: 'break-word' }}>{panel.panelTitle}</div>
                          <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginBottom: '0.75rem', lineHeight: '1.4', wordBreak: 'break-word' }} dangerouslySetInnerHTML={{ __html: renderMarkdownToHTML(panel.insight) }} />
                          <div style={{ fontSize: '0.85rem', color: 'var(--text-main)', background: 'var(--bg-surface)', padding: '0.75rem', borderRadius: '6px', wordBreak: 'break-word' }}>
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
                  <div style={{ display: 'grid', gap: '1rem', width: '100%', boxSizing: 'border-box' }}>
                    {analysisData.nextSteps?.map((item, idx) => (
                      <div key={idx} style={{ background: 'var(--bg-card)', border: '1px solid var(--border-subtle)', padding: '1.2rem', borderRadius: '8px', width: '100%', boxSizing: 'border-box' }}>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', marginBottom: '0.4rem', flexWrap: 'wrap' }}>
                          <span style={{ background: 'var(--accent)', color: 'var(--bg-primary)', width: '22px', height: '22px', borderRadius: '50%', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: '0.75rem', fontWeight: 700, flexShrink: 0 }}>{idx + 1}</span>
                          <strong style={{ fontSize: '0.9rem', color: 'var(--text-main)', wordBreak: 'break-word' }}>{item.step}</strong>
                        </div>
                        <p style={{ fontSize: '0.85rem', color: 'var(--text-muted)', marginLeft: '1.9rem', marginBottom: '0.3rem', wordBreak: 'break-word' }}><strong>Why:</strong> {item.why}</p>
                        {item.pitfallWarning && (
                          <p style={{ fontSize: '0.85rem', color: 'var(--danger)', marginLeft: '1.9rem', marginBottom: 0, wordBreak: 'break-word' }}><strong>⚠️ Pitfall to Avoid:</strong> {item.pitfallWarning}</p>
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
                    <div style={{ display: 'grid', gap: '0.5rem', width: '100%', boxSizing: 'border-box' }}>
                      {analysisData.referenceLinks.map((linkObj, lIdx) => (
                        <a 
                          key={lIdx} 
                          href={linkObj.url} 
                          target="_blank" 
                          rel="noopener noreferrer"
                          style={{ background: 'var(--bg-card)', padding: '0.85rem 1rem', borderRadius: '6px', border: '1px solid var(--border-subtle)', color: 'var(--accent)', textDecoration: 'none', display: 'flex', justifyContent: 'space-between', alignItems: 'center', fontSize: '0.9rem', gap: '0.5rem', boxSizing: 'border-box' }}
                        >
                          <span style={{ wordBreak: 'break-word' }}>🔗 <strong>{linkObj.title}</strong></span>
                          <span style={{ fontSize: '0.75rem', color: 'var(--text-muted)', flexShrink: 0 }}>Visit →</span>
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
            <span style={{ fontWeight: 700, letterSpacing: '0.05em', fontSize: '0.9rem', color: 'var(--text-main)' }}>VERLO Engine</span>
          </div>
          <div style={{ fontSize: '0.75rem', color: 'var(--text-muted)', marginTop: '0.5rem' }}>
            &copy; {new Date().getFullYear()} VERLO Decision-Intelligence. Built for YICTE.
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
            <p style={{ color: 'var(--text-muted)', fontSize: '0.85rem' }}>No saved reports yet.</p>
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
                  <div style={{ fontWeight: 600, fontSize: '0.9rem', marginBottom: '0.2rem', wordBreak: 'break-word' }}>{item.title}</div>
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
          </div>
        </div>
      )}

    </div>
  );
}