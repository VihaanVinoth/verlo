import React, { useState } from 'react';
import './App.css';

export default function App() {
  const [step, setStep] = useState('idle');
  const [initialGoal, setInitialGoal] = useState('');
  const [wizardData, setWizardData] = useState(null);
  const [responses, setResponses] = useState({});
  const [finalReport, setFinalReport] = useState('');
  const [loading, setLoading] = useState(false);

  const startWizard = async (e) => {
    e.preventDefault();
    if (!initialGoal.trim()) return;

    setLoading(true);
    try {
      const res = await fetch('/api/wizard/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ initialGoal }),
      });
      const data = await res.json();
      
      if (data.success) {
        setWizardData(data.wizardStep);
        setStep('wizard');
      }
    } catch (err) {
      console.error('Failed to start wizard:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleOptionSelect = async (questionKey, answer) => {
    const updatedResponses = { ...responses, [questionKey]: answer };
    setResponses(updatedResponses);

    setLoading(true);
    setStep('synthesising');

    try {
      const res = await fetch('/api/wizard/synthesise', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ responses: updatedResponses }),
      });
      const data = await res.json();

      if (data.success) {
        setFinalReport(data.report);
        setStep('complete');
      }
    } catch (err) {
      console.error('Failed to synthesise report:', err);
      setStep('wizard'); 
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="app-container">
      <h1>Adaptive Wizard Engine</h1>

      {step === 'idle' && (
        <form onSubmit={startWizard}>
          <input
            type="text"
            placeholder="Enter your goal or starting prompt..."
            value={initialGoal}
            onChange={(e) => setInitialGoal(e.target.value)}
            disabled={loading}
          />
          <button type="submit" disabled={loading}>
            {loading ? 'Initializing...' : 'Start Wizard'}
          </button>
        </form>
      )}

      {step === 'wizard' && (
        <div className="wizard-step-card">
          <h2>Wizard Step</h2>
          <div className="ai-output-box">
            <p>{typeof wizardData === 'string' ? wizardData : JSON.stringify(wizardData)}</p>
          </div>
          <button onClick={() => handleOptionSelect('step_1', 'Proceed with recommended path')}>
            Select Option &amp; Synthesise
          </button>
        </div>
      )}

      {(step === 'synthesising' || loading) && (
        <div className="loading-state">
          <p>Synthesising your master report using `openai/gpt-oss-120b`...</p>
        </div>
      )}

      {step === 'complete' && (
        <div className="report-container">
          <h2>Final Master Report</h2>
          <div className="report-content">
            <pre>{finalReport}</pre>
          </div>
          <button onClick={() => { setStep('idle'); setInitialGoal(''); setResponses({}); }}>
            Restart Wizard
          </button>
        </div>
      )}
    </div>
  );
}