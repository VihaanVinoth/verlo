import React, { useState, useEffect, useRef } from 'react';
import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { submitChat } from './services/api';

export default function App() {
  const [currentView, setCurrentView] = useState('landing');
  const [userInput, setUserInput] = useState('');
  const [selectedScenario, setSelectedScenario] = useState(null);
  const [processingStep, setProcessingStep] = useState(0);
  const [resultsData, setResultsData] = useState(null);
  const [messages, setMessages] = useState([
    { role: 'assistant', content: 'Hello! I am your VERLO decision intelligence assistant. Ask me anything about your pathways or resolution letters.' }
  ]);
  const [inputMessage, setInputMessage] = useState('');
  const [isSendingMessage, setIsSendingMessage] = useState(false);
  const [chatError, setChatError] = useState('');
  const [copyCount, setCopyCount] = useState(0);
  const [toast, setToast] = useState(null);
  const chatBottomRef = useRef(null);

  const processingStepsList = [
    "Deciphering core objective & stakes...",
    "Running legal and regulatory safety checks...",
    "Computing optimal risk-scored action pathways...",
    "Drafting formal resolution templates..."
  ];

  useEffect(() => {
    chatBottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const renderMarkdown = (text) => {
    if (!text) return null;
    return (
      <div className="prose prose-invert prose-sm max-w-none break-words [&_table]:w-full [&_table]:border-collapse [&_th]:border [&_th]:border-slate-600 [&_th]:bg-slate-700 [&_th]:px-2 [&_th]:py-1 [&_td]:border [&_td]:border-slate-700 [&_td]:px-2 [&_td]:py-1 [&_a]:text-indigo-300 [&_a]:underline">
        <ReactMarkdown
          remarkPlugins={[remarkGfm]}
          components={{
            a: ({ children, ...props }) => (
              <a {...props} target="_blank" rel="noreferrer">{children}</a>
            ),
            pre: ({ children }) => (
              <pre className="my-2 overflow-x-auto rounded-lg bg-slate-950 p-3 font-mono text-xs">{children}</pre>
            ),
            table: ({ children }) => (
              <div className="my-3 overflow-x-auto">
                <table className="w-full border-collapse text-left">{children}</table>
              </div>
            ),
          }}
        >
          {String(text)}
        </ReactMarkdown>
      </div>
    );
  };

  const handleStartAnalysis = (textToAnalyze) => {
    const text = textToAnalyze || userInput;
    if (!text.trim()) return;

    setCurrentView('processing');
    setProcessingStep(0);

    let step = 0;
    const interval = setInterval(() => {
      step++;
      if (step < processingStepsList.length) {
        setProcessingStep(step);
      } else {
        clearInterval(interval);
        setResultsData({
          title: "Consumer Dispute Resolution Pathway",
          riskScore: "Medium-Low (28%)",
          summary: "Based on your input, you have clear grounds under local consumer protection guidelines to demand a resolution.",
          pathways: [
            { id: 1, title: "Direct Formal Demand", timeline: "3-5 Business Days", successRate: "82%", description: "Send a written formal notice detailing the breach of terms." },
            { id: 2, title: "Ombudsman Escalation", timeline: "14-21 Days", successRate: "94%", description: "File an official dispute through the regional regulatory body if direct demand fails." }
          ],
          letter: `Dear Provider,\n\nI am writing to formally address the unresolved issue regarding our recent transaction. Under consumer guidelines, I expect a prompt resolution within 5 business days.\n\nSincerely,\nCustomer`
        });
        setCurrentView('results');
      }
    }, 1000);
  };

  const handleSendMessage = async (e) => {
    e.preventDefault();
    if (!inputMessage.trim() || isSendingMessage) return;

    const currentInput = inputMessage.trim();
    const userMsg = { role: 'user', content: currentInput };
    setMessages((prev) => [...prev, userMsg]);
    setInputMessage('');
    setChatError('');
    setIsSendingMessage(true);

    try {
      const response = await submitChat({
        question: currentInput,
        currentSituation: [resultsData?.title, resultsData?.summary, userInput]
          .filter(Boolean)
          .join('\n'),
        conversationHistory: messages.slice(1),
      });

      if (typeof response.reply !== 'string' || !response.reply.trim()) {
        throw new Error('The assistant returned an empty response. Please try again.');
      }

      setMessages((prev) => [...prev, { role: 'assistant', content: response.reply }]);
      if (response.complete === false) {
        setChatError('The reply reached the model output limit. Ask the assistant to continue.');
      }
    } catch (error) {
      setMessages((prev) => prev.filter((message) => message !== userMsg));
      setInputMessage(currentInput);
      setChatError(error.message || 'Unable to send your message. Please try again.');
    } finally {
      setIsSendingMessage(false);
    }
  };

  const handleCopyLetter = (letterText) => {
    navigator.clipboard.writeText(letterText);
    const newCount = copyCount + 1;
    setCopyCount(newCount);

    if (newCount === 1) {
      setToast("Letter copied to clipboard!");
    } else if (newCount === 2) {
      setToast("Copied again! Make sure to fill in your specific dates before sending.");
    } else {
      setToast("Third time's the charm! Ready to dispatch.");
    }

    setTimeout(() => setToast(null), 3500);
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans selection:bg-indigo-500 selection:text-white flex flex-col">
      {toast && (
        <div className="fixed top-5 right-5 z-50 bg-indigo-600 text-white px-4 py-2 rounded-xl shadow-lg border border-indigo-400 text-sm animate-bounce">
          {toast}
        </div>
      )}

      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur sticky top-0 z-40 px-6 py-4 flex justify-between items-center">
        <div className="flex items-center space-x-2 cursor-pointer" onClick={() => setCurrentView('landing')}>
          <div className="w-8 h-8 bg-indigo-600 rounded-lg flex items-center justify-center font-bold text-lg">V</div>
          <span className="text-xl font-bold tracking-tight bg-gradient-to-r from-white to-slate-400 bg-clip-text text-transparent">VERLO</span>
        </div>
        <div className="text-xs text-slate-400 bg-slate-800/80 px-3 py-1.5 rounded-full border border-slate-700">
          Ethical Decision Intelligence
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 max-w-5xl mx-auto w-full">
        
        {currentView === 'landing' && (
          <div className="text-center space-y-6 max-w-2xl py-12">
            <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight">
              Navigate Complex Disputes With <span className="text-indigo-400">Clarity</span>
            </h1>
            <p className="text-slate-400 text-base sm:text-lg">
              VERLO structures your stressful administrative or consumer situations into clear, risk-scored pathways and automated formal resolution letters.
            </p>
            <div className="pt-4 flex flex-col sm:flex-row justify-center gap-4">
              <button
                onClick={() => setCurrentView('input')}
                className="bg-indigo-600 hover:bg-indigo-500 text-white font-medium px-6 py-3 rounded-xl transition shadow-lg shadow-indigo-600/20"
              >
                Start New Assessment
              </button>
            </div>
          </div>
        )}

        {currentView === 'input' && (
          <div className="w-full max-w-2xl space-y-6 py-8">
            <div className="space-y-2">
              <h2 className="text-2xl font-bold">Describe Your Situation</h2>
              <p className="text-sm text-slate-400">Provide details about the dispute, billing issue, or administrative challenge you are facing.</p>
            </div>
            <textarea
              rows={6}
              value={userInput}
              onChange={(e) => setUserInput(e.target.value)}
              placeholder="e.g., My flight was cancelled with 2 hours notice and the airline refuses to issue a cash refund..."
              className="w-full bg-slate-900 border border-slate-800 rounded-xl p-4 text-slate-100 focus:outline-none focus:border-indigo-500 text-sm leading-relaxed"
            />
            <div className="flex justify-between items-center">
              <button
                onClick={() => setCurrentView('landing')}
                className="text-slate-400 hover:text-white text-sm"
              >
                Back
              </button>
              <button
                onClick={() => handleStartAnalysis()}
                disabled={!userInput.trim()}
                className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white font-medium px-6 py-2.5 rounded-xl transition"
              >
                Analyze Situation
              </button>
            </div>
          </div>
        )}
        {currentView === 'processing' && (
          <div className="text-center space-y-6 py-20">
            <div className="w-12 h-12 border-4 border-indigo-600 border-t-transparent rounded-full animate-spin mx-auto"></div>
            <div className="space-y-2">
              <h3 className="text-xl font-semibold">{processingStepsList[processingStep]}</h3>
              <p className="text-xs text-slate-500">Please wait while VERLO computes your strategy.</p>
            </div>
          </div>
        )}
        {currentView === 'results' && resultsData && (
          <div className="w-full space-y-8 py-6">
            <div className="flex justify-between items-start border-b border-slate-800 pb-4">
              <div>
                <h2 className="text-2xl font-bold">{resultsData.title}</h2>
                <p className="text-sm text-slate-400 mt-1">{resultsData.summary}</p>
              </div>
              <div className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 px-3 py-1 rounded-full text-xs font-semibold">
                Risk: {resultsData.riskScore}
              </div>
            </div>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {resultsData.pathways.map((path) => (
                <div key={path.id} className="bg-slate-900/60 border border-slate-800 rounded-2xl p-5 space-y-3">
                  <div className="flex justify-between items-center">
                    <h3 className="font-semibold text-base">{path.title}</h3>
                    <span className="text-xs bg-indigo-500/10 text-indigo-400 px-2 py-0.5 rounded">Success: {path.successRate}</span>
                  </div>
                  <p className="text-sm text-slate-400">{path.description}</p>
                  <div className="text-xs text-slate-500 pt-2 border-t border-slate-800 flex justify-between">
                    <span>Timeline: {path.timeline}</span>
                  </div>
                </div>
              ))}
            </div>
            <div className="bg-slate-900/80 border border-slate-800 rounded-2xl p-6 space-y-4">
              <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg">Automated Resolution Letter</h3>
                <button
                  onClick={() => handleCopyLetter(resultsData.letter)}
                  className="bg-slate-800 hover:bg-slate-700 text-slate-200 text-xs px-3 py-1.5 rounded-lg border border-slate-700 transition"
                >
                  Copy Template
                </button>
              </div>
              <pre className="bg-slate-950 p-4 rounded-xl text-xs text-slate-300 font-mono whitespace-pre-wrap border border-slate-900">
                {resultsData.letter}
              </pre>
            </div>
            <div className="bg-slate-900/60 border border-slate-800 rounded-2xl p-6 space-y-4">
              <h3 className="font-bold text-lg">Follow-up Assistant</h3>
              <div className="max-h-60 overflow-y-auto space-y-3 pr-2">
                {messages.map((msg, idx) => (
                  <div key={idx} className={`flex ${msg.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[80%] rounded-2xl p-3 text-sm ${msg.role === 'user' ? 'bg-indigo-600 text-white' : 'bg-slate-800 text-slate-200 border border-slate-700'}`}>
                      {renderMarkdown(msg.content)}
                    </div>
                  </div>
                ))}
                {isSendingMessage && (
                  <p className="text-sm text-slate-400" role="status">Verlo is preparing a response...</p>
                )}
                <div ref={chatBottomRef} />
              </div>

              <form onSubmit={handleSendMessage} className="flex gap-2 pt-2">
                <input
                  type="text"
                  value={inputMessage}
                  onChange={(e) => setInputMessage(e.target.value)}
                  placeholder="Ask a question about your pathway..."
                  className="flex-1 bg-slate-950 border border-slate-800 rounded-xl px-4 py-2.5 text-sm text-slate-100 focus:outline-none focus:border-indigo-500"
                  disabled={isSendingMessage}
                />
                <button
                  type="submit"
                  disabled={isSendingMessage || !inputMessage.trim()}
                  className="bg-indigo-600 hover:bg-indigo-500 disabled:opacity-50 text-white px-4 py-2.5 rounded-xl text-sm font-medium transition"
                >
                  {isSendingMessage ? 'Sending...' : 'Send'}
                </button>
              </form>
              {chatError && (
                <p className="text-sm text-amber-300" role="alert">{chatError}</p>
              )}
            </div>

            <div className="flex justify-start pt-4">
              <button
                onClick={() => { setCurrentView('input'); setUserInput(''); }}
                className="text-sm text-slate-400 hover:text-white underline"
              >
                ← Start a new assessment
              </button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}