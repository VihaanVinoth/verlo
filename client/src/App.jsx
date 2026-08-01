// --- app.jsx ---
import React, { useState, useEffect } from 'react';
import './App.css'; // Make sure your CSS matches the styles provided earlier

const API_BASE = 'http://127.0.0.1:5001/api';

export default function App() {
  const [user, setUser] = useState(null);
  const [authMode, setAuthMode] = useState('login'); // 'login' or 'signup'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  
  // App views: 'form', 'processing', 'results'
  const [view, setView] = useState('form');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [context, setContext] = useState('');
  
  const [reportData, setReportData] = useState(null);
  const [history, setHistory] = useState([]);
  const [alertBanner, setAlertBanner] = useState(null); // Custom non-chrome alert banner state

  // Toast / Banner Helper
  const triggerAlert = (message, type = 'error') => {
    setAlertBanner({ message, type });
    setTimeout(() => setAlertBanner(null), 5000);
  };

  // Load user session from localStorage
  useEffect(() => {
    const savedUser = localStorage.getItem('verlo_user');
    if (savedUser) {
      const parsedUser = JSON.parse(savedUser);
      setUser(parsedUser);
      fetchHistory(parsedUser.id);
    }
  }, []);

  const fetchHistory = async (userId) => {
    try {
      const res = await fetch(`${API_BASE}/history/${userId}`);
      const data = await res.json();
      if (data.history) setHistory(data.history);
    } catch (err) {
      console.error('Failed to fetch history', err);
    }
  };

  const handleAuth = async (e) => {
    e.preventDefault();
    const endpoint = authMode === 'signup' ? '/auth/signup' : '/auth/login';
    try {
      const res = await fetch(`${API_BASE}${endpoint}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, password })
      });
      const data = await res.json();
      
      if (!res.ok) {
        triggerAlert(data.error || 'Authentication failed', 'error');
        return;
      }

      setUser(data.user);
      localStorage.setItem('verlo_user', JSON.stringify(data.user));
      fetchHistory(data.user.id);
      triggerAlert(data.message || 'Successfully signed in!', 'success');
    } catch (err) {
      triggerAlert('Network error during authentication.', 'error');
    }
  };

  const handleLogout = () => {
    setUser(null);
    localStorage.removeItem('verlo_user');
    setHistory([]);
    setView('form');
  };

  const handleDiagnose = async (e) => {
    e.preventDefault();
    if (!description.trim()) {
      triggerAlert('Please provide a description.', 'error');
      return;
    }

    setView('processing');

    try {
      const res = await fetch(`${API_BASE}/diagnose`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ title, description, context })
      });
      const data = await res.json();

      if (!res.ok) {
        triggerAlert(data.error || 'Moderation or server error encountered.', 'error');
        setView('form');
        return;
      }

      setReportData(data.data);
      setView('results');
    } catch (err) {
      triggerAlert('Failed to connect to Verlo engine backend.', 'error');
      setView('form');
    }
  };

  const handleSaveReport = async () => {
    if (!user || !reportData) return;
    try {
      const res = await fetch(`${API_BASE}/history/save`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: user.id, report: { title: title || 'Untitled Decision', ...reportData } })
      });
      const data = await res.json();
      if (res.ok) {
        setHistory(data.history);
        triggerAlert(data.message || 'Report saved successfully!', 'success');
      } else {
        triggerAlert(data.error || 'Failed to save report.', 'error');
      }
    } catch (err) {
      triggerAlert('Network error while saving report.', 'error');
    }
  };

  return (
    <div className="page-transition" style={{ padding: '2rem 1rem', maxWidth: '720px', margin: '0 auto' }}>
      
      {/* Custom Non-Chrome Alert Notification Banner */}
      {alertBanner && (
        <div style={{
          background: alertBanner.type === 'error' ? 'rgba(239, 68, 68, 0.15)' : 'rgba(16, 185, 129, 0.15)',
          border: `1px solid ${alertBanner.type === 'error' ? '#ef4444' : '#10b981'}`,
          color: alertBanner.type === 'error' ? '#ef4444' : '#10b981',
          padding: '1rem',
          borderRadius: '8px',
          marginBottom: '1.5rem',
          textAlign: 'center',
          fontWeight: 600
        }}>
          {alertBanner.message}
        </div>
      )}

      {/* Header & Perfectly Centered Alignment */}
      <header className="verlo-header">
        <span className="verlo-brand">Verlo Engine</span>
        <h1 className="verlo-title">Decision Intelligence</h1>
        <p className="verlo-subtitle">
          Advanced automated synthesis, risk analysis, and strategic resolution pathways.
        </p>
      </header>

      {!user ? (
        <div className="verlo-card">
          <h2 style={{ marginBottom: '1rem', fontSize: '1.25rem' }}>{authMode === 'login' ? 'Sign In' : 'Create Account'}</h2>
          <form onSubmit={handleAuth}>
            <div className="form-group">
              <label className="form-label">Email Address</label>
              <input 
                type="email" 
                className="form-input" 
                value={email} 
                onChange={e => setEmail(e.target.value)} 
                required 
              />
            </div>
            <div className="form-group">
              <label className="form-label">Password</label>
              <input 
                type="password" 
                className="form-input" 
                value={password} 
                onChange={e => setPassword(e.target.value)} 
                required 
              />
            </div>
            <button type="submit" className="btn-primary" style={{ marginBottom: '1rem' }}>
              {authMode === 'login' ? 'Sign In' : 'Sign Up'}
            </button>
            <p style={{ textAlign: 'center', fontSize: '0.9rem', color: 'var(--text-muted)' }}>
              {authMode === 'login' ? "Don't have an account? " : "Already have an account? "}
              <span 
                style={{ color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
                onClick={() => setAuthMode(authMode === 'login' ? 'signup' : 'login')}
              >
                {authMode === 'login' ? 'Sign Up' : 'Log In'}
              </span>
            </p>
          </form>
        </div>
      ) : (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '1.5rem' }}>
            <span style={{ fontSize: '0.9rem', color: 'var(--text-muted)' }}>Logged in as: <b>{user.email}</b></span>
            <button onClick={handleLogout} style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '0.4rem 0.8rem', borderRadius: '6px' }}>
              Sign Out
            </button>
          </div>

          {view === 'form' && (
            <div className="verlo-card">
              <form onSubmit={handleDiagnose}>
                <div className="form-group">
                  <label className="form-label">Dilemma Title</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="e.g., Contract Renegotiation Strategy" 
                    value={title} 
                    onChange={e => setTitle(e.target.value)} 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Situation Description</label>
                  <textarea 
                    className="form-textarea" 
                    placeholder="Describe your current challenge in detail..." 
                    value={description} 
                    onChange={e => setDescription(e.target.value)} 
                    required 
                  />
                </div>
                <div className="form-group">
                  <label className="form-label">Additional Context (Optional)</label>
                  <input 
                    type="text" 
                    className="form-input" 
                    placeholder="Constraints, timelines, budgets..." 
                    value={context} 
                    onChange={e => setContext(e.target.value)} 
                  />
                </div>
                <button type="submit" className="btn-primary">Run Decision Analysis</button>
              </form>
            </div>
          )}

          {view === 'processing' && (
            <div className="processing-container">
              <div className="processing-pulse-ring"></div>
              <p style={{ color: 'var(--text-muted)' }}>Synthesizing strategy parameters with Groq AI...</p>
            </div>
          )}

          {view === 'results' && reportData && (
            <div>
              <div className="dominant-action">
                <span className="badge strong">Confidence: {reportData.confidence}</span>
                <h2>{title || 'Strategic Analysis'}</h2>
                <p style={{ color: 'var(--text-muted)', fontSize: '0.95rem' }}>{reportData.situation}</p>
              </div>

              <div className="result-section">
                <h3 style={{ fontSize: '1.1rem', marginBottom: '0.75rem' }}>Next Steps</h3>
                <ul>
                  {reportData.nextSteps?.map((item, idx) => (
                    <li key={idx}><b>{item.step}</b>: {item.why}</li>
                  ))}
                </ul>
              </div>

              <div style={{ display: 'flex', gap: '1rem', marginTop: '1.5rem' }}>
                <button onClick={handleSaveReport} className="btn-primary">Save to History</button>
                <button onClick={() => setView('form')} style={{ background: 'transparent', border: '1px solid var(--border-subtle)', color: 'var(--text-main)', padding: '0.9rem 1.5rem', borderRadius: '8px', fontWeight: 600 }}>
                  New Analysis
                </button>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}