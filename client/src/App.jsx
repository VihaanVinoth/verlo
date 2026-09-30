import { useEffect, useMemo, useRef, useState } from "react";
import "./style.css";

const API_URL = import.meta.env.VITE_API_URL || "https://verlo-30xs.onrender.com";
const STORAGE_KEY = "verlo_app_state_v4";
const MAX_ADAPTIVE_QUESTIONS = 7;

const initialState = {
  screen: "home",
  situation: "",
  title: "",
  category: "",
  context: "",
  questions: [],
  answers: [],
  questionIndex: 0,
  result: null,
  attachments: [],
  verificationEmail: "",
  verificationRequired: false
};

function loadState() {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);

    if (!saved) {
      return initialState;
    }

    const parsed = JSON.parse(saved);

    return {
      ...initialState,
      ...parsed,
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      answers: Array.isArray(parsed.answers) ? parsed.answers : [],
      attachments: Array.isArray(parsed.attachments)
        ? parsed.attachments
        : []
    };
  } catch {
    return initialState;
  }
}

async function api(path, options = {}) {
  const headers = {
    ...(options.body instanceof FormData
      ? {}
      : { "Content-Type": "application/json" }),
    ...(options.headers || {})
  };

  const response = await fetch(`${API_URL}${path}`, {
    ...options,
    headers,
    credentials: "include"
  });

  const text = await response.text();

  let data = {};

  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    data = { message: text };
  }

  if (!response.ok) {
    const error = new Error(
      data.message ||
        data.error ||
        `Request failed with status ${response.status}`
    );

    error.status = response.status;
    error.data = data;

    throw error;
  }

  return data;
}

function Icon({ name, size = 22, strokeWidth = 1.8 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    focusable: "false",
    "aria-hidden": "true",
    style: {
      display: "block",
      flex: "0 0 auto",
      overflow: "visible"
    }
  };

  switch (name) {
    case "arrow":
      return (
        <svg {...common}>
          <path d="M5 12h14" />
          <path d="m13 6 6 6-6 6" />
        </svg>
      );

    case "spark":
      return (
        <svg {...common}>
          <path d="M12 3.5 13.9 10l6.1 2-6.1 2L12 20.5 10.1 14 4 12l6.1-2L12 3.5Z" />
          <path d="M19 3v3" />
          <path d="M17.5 4.5h3" />
        </svg>
      );

    case "history":
      return (
        <svg {...common}>
          <path d="M3.5 12a8.5 8.5 0 1 0 2.7-6.2" />
          <path d="M3.5 4.5v4.5H8" />
          <path d="M12 7v5l3.25 2" />
        </svg>
      );

    case "plus":
      return (
        <svg {...common}>
          <path d="M12 5v14" />
          <path d="M5 12h14" />
        </svg>
      );

    case "clock":
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8.5" />
          <path d="M12 7v5l3.25 2" />
        </svg>
      );

    case "check":
      return (
        <svg {...common}>
          <path d="m5 12.5 4.2 4.2L19 7" />
        </svg>
      );

    case "close":
      return (
        <svg {...common}>
          <path d="M6 6l12 12" />
          <path d="M18 6 6 18" />
        </svg>
      );

    case "chevron":
      return (
        <svg {...common}>
          <path d="m7 9 5 5 5-5" />
        </svg>
      );

    case "file":
      return (
        <svg {...common}>
          <path d="M6.5 3.5h7l4 4v13h-11z" />
          <path d="M13.5 3.5v4h4" />
          <path d="M9 12h6" />
          <path d="M9 16h5" />
        </svg>
      );

    case "logout":
      return (
        <svg {...common}>
          <path d="M10 4H6.5A2.5 2.5 0 0 0 4 6.5v11A2.5 2.5 0 0 0 6.5 20H10" />
          <path d="m14 8 4 4-4 4" />
          <path d="M9 12h9" />
        </svg>
      );

    case "user":
      return (
        <svg {...common}>
          <circle cx="12" cy="8" r="3.25" />
          <path d="M5 20c.8-3.2 3.15-5 7-5s6.2 1.8 7 5" />
        </svg>
      );

    case "lock":
      return (
        <svg {...common}>
          <rect x="5" y="10" width="14" height="10" rx="2" />
          <path d="M8 10V7a4 4 0 0 1 8 0v3" />
          <path d="M12 14v2" />
        </svg>
      );

    case "mail":
      return (
        <svg {...common}>
          <rect x="4" y="6" width="16" height="12" rx="2" />
          <path d="m5 8 7 5 7-5" />
        </svg>
      );

    case "copy":
      return (
        <svg {...common}>
          <rect x="8" y="8" width="11" height="12" rx="2" />
          <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h2" />
        </svg>
      );

    case "external":
      return (
        <svg {...common}>
          <path d="M14 5h5v5" />
          <path d="m19 5-8 8" />
          <path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
        </svg>
      );

    case "download":
      return (
        <svg {...common}>
          <path d="M12 4v11" />
          <path d="m7 10 5 5 5-5" />
          <path d="M5 20h14" />
        </svg>
      );

    case "chat":
      return (
        <svg {...common}>
          <path d="M20 11.5c0 4.15-3.58 7.5-8 7.5a9 9 0 0 1-3.6-.75L4 20l1.65-3.85A7.25 7.25 0 0 1 4 11.5C4 7.35 7.58 4 12 4s8 3.35 8 7.5Z" />
          <path d="M8 11.5h.01" />
          <path d="M12 11.5h.01" />
          <path d="M16 11.5h.01" />
        </svg>
      );

    case "menu":
      return (
        <svg {...common}>
          <path d="M4 7h16" />
          <path d="M4 12h16" />
          <path d="M4 17h16" />
        </svg>
      );

    case "refresh":
      return (
        <svg {...common}>
          <path d="M20 11a8 8 0 0 0-14.8-4L3 10" />
          <path d="M3 5v5h5" />
          <path d="M4 13a8 8 0 0 0 14.8 4L21 14" />
          <path d="M21 19v-5h-5" />
        </svg>
      );

    default:
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="8" />
        </svg>
      );
  }
}

function Logo({ compact = false }) {
  return (
    <div className={`verlo-logo ${compact ? "compact" : ""}`}>
      <div className="verlo-logo-mark" aria-hidden="true">
        <span />
        <span />
        <span />
      </div>
      <span>VERLO</span>
    </div>
  );
}

function LoadingDots() {
  return (
    <span className="loading-dots" aria-hidden="true">
      <i />
      <i />
      <i />
    </span>
  );
}

function AuthModal({
  mode,
  setMode,
  onClose,
  onLogin,
  onSignup,
  loading,
  error
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const submit = async event => {
    event.preventDefault();

    if (mode === "login") {
      await onLogin(email, password);
    } else {
      await onSignup(name, email, password);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="auth-modal"
        onMouseDown={event => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" size={20} />
        </button>

        <div className="auth-heading">
          <Logo compact />
          <h2>
            {mode === "login"
              ? "Welcome back"
              : "Create your VERLO account"}
          </h2>
          <p>
            {mode === "login"
              ? "Continue where you left off."
              : "Keep your assessments and reports available across sessions."}
          </p>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && (
            <label>
              <span>Name</span>
              <div className="input-wrap">
                <Icon name="user" size={18} />
                <input
                  value={name}
                  onChange={event => setName(event.target.value)}
                  placeholder="Your name"
                  autoComplete="name"
                  required
                />
              </div>
            </label>
          )}

          <label>
            <span>Email</span>
            <div className="input-wrap">
              <Icon name="mail" size={18} />
              <input
                type="email"
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label>
            <span>Password</span>
            <div className="input-wrap">
              <Icon name="lock" size={18} />
              <input
                type="password"
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="••••••••"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                minLength={8}
                required
              />
            </div>
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="primary-button full-button" disabled={loading}>
            {loading ? (
              <>
                <LoadingDots />
                {mode === "login" ? "Signing in" : "Creating account"}
              </>
            ) : mode === "login" ? (
              "Sign in"
            ) : (
              "Create account"
            )}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <a className="google-button" href={`${API_URL}/api/auth/google`}>
          <span className="google-letter">G</span>
          Continue with Google
        </a>

        <button
          className="auth-switch"
          onClick={() => setMode(mode === "login" ? "signup" : "login")}
        >
          {mode === "login"
            ? "Don't have an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

function VerificationModal({
  email,
  onVerify,
  onResend,
  onClose,
  loading,
  resendLoading,
  resendCooldown,
  error,
  message
}) {
  const [code, setCode] = useState("");

  const submit = async event => {
    event.preventDefault();

    if (code.length === 6) {
      await onVerify(code);
    }
  };

  return (
    <div className="modal-backdrop">
      <div className="auth-modal verification-modal">
        <div className="auth-heading">
          <div className="verification-icon">
            <Icon name="mail" size={25} />
          </div>
          <h2>Check your email</h2>
          <p>
            We sent a 6-digit verification code to <strong>{email}</strong>.
          </p>
        </div>

        <form onSubmit={submit} className="auth-form">
          <label>
            <span>Verification code</span>
            <input
              className="verification-code"
              value={code}
              onChange={event =>
                setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
              }
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="000000"
              maxLength={6}
            />
          </label>

          {error && <div className="form-error">{error}</div>}
          {message && <div className="form-success">{message}</div>}

          <button
            className="primary-button full-button"
            disabled={loading || code.length !== 6}
          >
            {loading ? (
              <>
                <LoadingDots />
                Verifying
              </>
            ) : (
              "Verify email"
            )}
          </button>
        </form>

        <button
          className="resend-button"
          onClick={onResend}
          disabled={resendLoading || resendCooldown > 0}
        >
          <Icon name="refresh" size={17} />
          {resendLoading
            ? "Sending…"
            : resendCooldown > 0
            ? `Resend code in ${resendCooldown}s`
            : "Resend verification email"}
        </button>

        <button className="auth-switch" onClick={onClose}>
          Use a different email
        </button>
      </div>
    </div>
  );
}

function Home({
  onStart,
  onHistory,
  onLogin,
  onSignup,
  user,
  onLogout
}) {
  return (
    <div className="home-page">
      <header className="site-header">
        <button className="brand-button" onClick={onStart}>
          <Logo />
        </button>

        <nav className="site-nav">
          <button onClick={onStart}>New assessment</button>

          {user && (
            <button onClick={onHistory} className="history-nav-button">
              <Icon name="history" size={18} />
              <span>History</span>
            </button>
          )}

          {user ? (
            <button className="account-button" onClick={onLogout}>
              <Icon name="logout" size={17} />
              Sign out
            </button>
          ) : (
            <>
              <button onClick={onLogin}>Sign in</button>
              <button className="header-cta" onClick={onSignup}>
                Get started
                <Icon name="arrow" size={17} />
              </button>
            </>
          )}
        </nav>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-content">
            <div className="eyebrow">
              <Icon name="spark" size={16} />
              DECISION INTELLIGENCE
            </div>

            <h1>
              Make sense of
              <br />
              <span>what comes next.</span>
            </h1>

            <p className="hero-description">
              VERLO turns complicated situations into clear questions,
              structured reasoning and practical next steps.
            </p>

            <div className="hero-actions">
              <button
                className="primary-button hero-button"
                onClick={onStart}
              >
                Start an assessment
                <Icon name="arrow" size={19} />
              </button>

              {user && (
                <button className="secondary-button" onClick={onHistory}>
                  <Icon name="history" size={18} />
                  View history
                </button>
              )}
            </div>

            <div className="hero-note">
              <Icon name="check" size={16} />
              Adaptive questions change based on your answers.
            </div>
          </div>

          <div className="hero-visual">
            <div className="hero-orbit orbit-one" />
            <div className="hero-orbit orbit-two" />
            <div className="hero-orbit orbit-three" />

            <div className="hero-core">
              <Icon name="spark" size={34} />
            </div>

            <div className="floating-card card-top">
              <Icon name="clock" size={17} />
              <span>Context aware</span>
            </div>

            <div className="floating-card card-bottom">
              <Icon name="check" size={17} />
              <span>Action focused</span>
            </div>
          </div>
        </section>

        <section className="feature-section">
          <div className="section-heading">
            <span className="eyebrow">HOW IT WORKS</span>
            <h2>From uncertainty to a clearer plan.</h2>
          </div>

          <div className="feature-grid">
            <article className="feature-card">
              <div className="feature-icon">
                <Icon name="spark" size={24} />
              </div>
              <span className="feature-number">01</span>
              <h3>Describe</h3>
              <p>
                Explain what is happening in your own words. VERLO starts with
                the context you provide.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-icon">
                <Icon name="chat" size={24} />
              </div>
              <span className="feature-number">02</span>
              <h3>Explore</h3>
              <p>
                Answer adaptive questions that become more specific as VERLO
                learns about the situation.
              </p>
            </article>

            <article className="feature-card">
              <div className="feature-icon">
                <Icon name="check" size={24} />
              </div>
              <span className="feature-number">03</span>
              <h3>Act</h3>
              <p>
                Receive a structured report with practical next steps,
                considerations and useful resources.
              </p>
            </article>
          </div>
        </section>
      </main>
    </div>
  );
}

function InputPage({
  situation,
  setSituation,
  category,
  setCategory,
  attachments,
  setAttachments,
  onContinue,
  onBack,
  loading,
  error
}) {
  const fileInput = useRef(null);

  const handleFiles = async event => {
    const files = Array.from(event.target.files || []);

    const parsed = await Promise.all(
      files.slice(0, 5).map(async file => {
        let text = "";

        if (
          file.type.startsWith("text/") ||
          /\.(txt|md|csv|json)$/i.test(file.name)
        ) {
          try {
            text = (await file.text()).slice(0, 20000);
          } catch {
            text = "";
          }
        }

        return {
          name: file.name,
          type: file.type,
          size: file.size,
          text
        };
      })
    );

    setAttachments([...attachments, ...parsed].slice(0, 5));
    event.target.value = "";
  };

  const removeFile = name => {
    setAttachments(attachments.filter(file => file.name !== name));
  };

  return (
    <div className="assessment-page">
      <header className="assessment-header">
        <button className="brand-button" onClick={onBack}>
          <Logo compact />
        </button>
      </header>

      <main className="assessment-main">
        <div className="assessment-intro">
          <span className="eyebrow">NEW ASSESSMENT</span>
          <h1>What are you trying to figure out?</h1>
          <p>
            Give VERLO enough context to understand the situation. You do not
            need to phrase it perfectly.
          </p>
        </div>

        <div className="input-card">
          <label className="large-label" htmlFor="situation">
            Describe the situation
          </label>

          <div className="textarea-shell">
            <textarea
              id="situation"
              value={situation}
              onChange={event => setSituation(event.target.value)}
              placeholder="Tell me what is happening, what you are deciding, or what you are unsure about..."
              rows={9}
              maxLength={6000}
            />
            <div className="textarea-count">{situation.length}/6000</div>
          </div>

          <div className="category-row">
            <label>
              <span>Area</span>
              <select
                value={category}
                onChange={event => setCategory(event.target.value)}
              >
                <option value="">Let VERLO decide</option>
                <option value="education">Education</option>
                <option value="career">Career</option>
                <option value="technology">Technology</option>
                <option value="business">Business</option>
                <option value="personal">Personal</option>
                <option value="finance">Finance</option>
                <option value="planning">Planning</option>
                <option value="other">Other</option>
              </select>
            </label>
          </div>

          <div className="attachment-area">
            <input
              ref={fileInput}
              type="file"
              multiple
              hidden
              onChange={handleFiles}
            />

            <button
              className="attachment-button"
              onClick={() => fileInput.current?.click()}
            >
              <Icon name="file" size={18} />
              Add supporting files
            </button>

            {attachments.length > 0 && (
              <div className="attachment-list">
                {attachments.map(file => (
                  <div className="attachment-item" key={file.name}>
                    <Icon name="file" size={16} />
                    <span>{file.name}</span>
                    <button
                      onClick={() => removeFile(file.name)}
                      aria-label={`Remove ${file.name}`}
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && <div className="form-error">{error}</div>}

          <div className="input-footer">
            <span>Your information is used to build this assessment.</span>

            <button
              className="primary-button"
              disabled={loading || situation.trim().length < 10}
              onClick={onContinue}
            >
              {loading ? (
                <>
                  <LoadingDots />
                  Preparing
                </>
              ) : (
                <>
                  Continue
                  <Icon name="arrow" size={18} />
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function normalizeQuestion(question, index) {
  if (!question) {
    return {
      id: `question-${index}`,
      question: "",
      type: "text",
      options: []
    };
  }

  if (typeof question === "string") {
    return {
      id: `question-${index}`,
      question,
      type: "text",
      options: []
    };
  }

  return {
    id: question.id || `question-${index}`,
    question:
      question.question ||
      question.text ||
      question.prompt ||
      "Tell me more about this.",
    type:
      question.type ||
      (Array.isArray(question.options) && question.options.length
        ? "choice"
        : "text"),
    options: Array.isArray(question.options) ? question.options : [],
    placeholder: question.placeholder || "",
    imageUrl: question.imageUrl || "",
    imageAlt: question.imageAlt || "",
    imageCaption: question.imageCaption || ""
  };
}

function AdaptiveAssessment({
  questions,
  questionIndex,
  answers,
  onContinue,
  onBack,
  onSkip,
  loading,
  error
}) {
  const question = normalizeQuestion(
    questions[questionIndex],
    questionIndex
  );

  // LUCKY NUMBER 888
  const currentAnswer =
    answers.find(answer => answer.questionId === question.id)?.answer || "";

  const [value, setValue] = useState(currentAnswer);

  useEffect(() => {
    const answer =
      answers.find(item => item.questionId === question.id)?.answer || "";

    setValue(answer);
  }, [question.id, answers]);

  const continueQuestion = () => {
    const answer = value.trim();

    if (!answer || loading) {
      return;
    }

    onContinue({
      questionId: question.id,
      question: question.question,
      answer,
      skipped: false
    });
  };

  const skipQuestion = () => {
    if (loading) {
      return;
    }

    onSkip({
      questionId: question.id,
      question: question.question,
      answer: "",
      skipped: true
    });
  };

  const progress =
    Math.min(
      ((questionIndex + 1) / Math.max(questions.length, 1)) * 100,
      100
    );

  return (
    <div className="adaptive-page">
      <header className="assessment-header">
        <button className="brand-button" onClick={onBack}>
          <Logo compact />
        </button>

        <div className="assessment-progress-label">
          Question {questionIndex + 1}
        </div>
      </header>

      <main className="adaptive-main">
        <div className="adaptive-progress">
          <div
            className="adaptive-progress-bar"
            style={{ width: `${progress}%` }}
          />
        </div>

        <section className="question-card">
          <div className="question-meta">
            <span>ADAPTIVE ASSESSMENT</span>
          </div>

          <h1>{question.question}</h1>

          {question.imageUrl && (
            <div className="question-image">
              <img
                src={question.imageUrl}
                alt={question.imageAlt || "Question reference"}
              />
              {question.imageCaption && <p>{question.imageCaption}</p>}
            </div>
          )}

          {question.type === "choice" && question.options.length > 0 ? (
            <div className="choice-list">
              {question.options.map((option, index) => {
                const optionValue =
                  typeof option === "string"
                    ? option
                    : option.value || option.label || "";

                return (
                  <button
                    type="button"
                    key={`${optionValue}-${index}`}
                    className={`choice-option ${
                      value === optionValue ? "selected" : ""
                    }`}
                    onClick={() => setValue(optionValue)}
                    disabled={loading}
                  >
                    <span className="choice-radio">
                      {value === optionValue && <span />}
                    </span>

                    <span>{optionValue}</span>
                  </button>
                );
              })}
            </div>
          ) : (
            <div className="adaptive-textarea-shell">
              <textarea
                value={value}
                onChange={event => setValue(event.target.value)}
                placeholder={
                  question.placeholder || "Type your answer here..."
                }
                rows={8}
                maxLength={4000}
                disabled={loading}
                style={{
                  width: "100%",
                  maxWidth: "100%",
                  boxSizing: "border-box",
                  resize: "vertical"
                }}
              />

              <div className="adaptive-textarea-count">
                {value.length}/4000
              </div>
            </div>
          )}

          {error && <div className="form-error">{error}</div>}

          <div className="question-footer">
            <button
              type="button"
              className="secondary-button skip-button"
              onClick={skipQuestion}
              disabled={loading}
            >
              Skip
            </button>

            <button
              type="button"
              className="primary-button continue-button"
              disabled={
                loading ||
                (!value.trim() && question.type !== "choice")
              }
              onClick={continueQuestion}
            >
              {loading ? (
                <>
                  <LoadingDots />
                  Thinking
                </>
              ) : (
                <>
                  Continue
                  <Icon name="arrow" size={18} />
                </>
              )}
            </button>
          </div>
        </section>
      </main>
    </div>
  );
}

function Processing({ progress, step }) {
  return (
    <div className="processing-page">
      <div className="processing-inner">
        <Logo />

        <div className="processing-orb">
          <div />
          <div />
          <div />
        </div>

        <span className="eyebrow">BUILDING YOUR REPORT</span>

        <h1>{step}</h1>

        <p>
          VERLO is combining your situation and answers into a structured
          analysis.
        </p>

        <div className="processing-progress">
          <div
            style={{
              width: `${Math.max(5, Math.min(progress, 100))}%`
            }}
          />
        </div>

        <span className="processing-percent">
          {Math.round(progress)}%
        </span>
      </div>
    </div>
  );
}

function getResultValue(result, keys, fallback = "") {
  for (const key of keys) {
    if (result?.[key] !== undefined && result?.[key] !== null) {
      return result[key];
    }
  }

  return fallback;
}

function ResultSection({ icon, eyebrow, title, children }) {
  return (
    <section className="report-section">
      <div className="report-section-heading">
        <div className="report-heading-icon">
          <Icon name={icon} size={21} />
        </div>

        <div>
          <span>{eyebrow}</span>
          <h2>{title}</h2>
        </div>
      </div>

      <div className="report-section-content">{children}</div>
    </section>
  );
}

function Results({
  result,
  situation,
  onNew,
  onHistory,
  onChat,
  chatMessages,
  chatInput,
  setChatInput,
  chatLoading,
  user
}) {
  const [copied, setCopied] = useState(false);

  const summary = getResultValue(
    result,
    ["summary", "overview", "analysis"],
    "VERLO has completed your assessment."
  );

  const title = getResultValue(
    result,
    ["title", "headline"],
    "Your assessment"
  );

  const confidence = getResultValue(
    result,
    ["confidence", "confidenceLevel"],
    ""
  );

  const nextSteps =
    getResultValue(
      result,
      ["nextSteps", "actions", "recommendations"],
      []
    ) || [];

  const considerations =
    getResultValue(
      result,
      ["considerations", "keyConsiderations", "factors"],
      []
    ) || [];

  const resources =
    getResultValue(result, ["resources", "usefulResources"], []) || [];

  const references =
    getResultValue(
      result,
      ["referenceLinks", "references", "sources"],
      []
    ) || [];

  const draft = getResultValue(
    result,
    ["draft", "suggestedMessage", "template"],
    ""
  );

  const asArray = value => {
    if (Array.isArray(value)) {
      return value;
    }

    if (!value) {
      return [];
    }

    return [value];
  };

  const copyDraft = async () => {
    if (!draft) {
      return;
    }

    try {
      await navigator.clipboard.writeText(
        typeof draft === "string"
          ? draft
          : JSON.stringify(draft, null, 2)
      );

      setCopied(true);

      setTimeout(() => {
        setCopied(false);
      }, 1800);
    } catch {}
  };

  return (
    <div className="results-page">
      <header className="results-header">
        <button className="brand-button" onClick={onNew}>
          <Logo compact />
        </button>

        <div className="results-actions">
          {user && (
            <button className="secondary-button" onClick={onHistory}>
              <Icon name="history" size={17} />
              History
            </button>
          )}

          <button className="primary-button" onClick={onNew}>
            <Icon name="plus" size={17} />
            New assessment
          </button>
        </div>
      </header>

      <main className="report-container">
        <section className="report-hero">
          <div className="report-hero-copy">
            <span className="eyebrow">VERLO REPORT</span>
            <h1>{title}</h1>
            <p>{summary}</p>

            {confidence && (
              <div className="confidence-label">
                <Icon name="check" size={16} />
                Confidence: {String(confidence)}
              </div>
            )}
          </div>

          <div className="report-context">
            <span>YOUR ORIGINAL SITUATION</span>
            <p>{situation}</p>
          </div>
        </section>

        <div className="report-grid">
          <ResultSection
            icon="arrow"
            eyebrow="01 · ACTION"
            title="Next steps"
          >
            <div className="next-step-list">
              {asArray(nextSteps).length > 0 ? (
                asArray(nextSteps).map((step, index) => {
                  const text =
                    typeof step === "string"
                      ? step
                      : step.text ||
                        step.description ||
                        step.action ||
                        "";

                  return (
                    <div className="next-step" key={index}>
                      <span>{String(index + 1).padStart(2, "0")}</span>
                      <p>{text}</p>
                    </div>
                  );
                })
              ) : (
                <p className="empty-report">
                  No specific next steps were returned.
                </p>
              )}
            </div>
          </ResultSection>

          <ResultSection
            icon="spark"
            eyebrow="02 · THINK ABOUT"
            title="Key considerations"
          >
            <div className="consideration-list">
              {asArray(considerations).length > 0 ? (
                asArray(considerations).map((item, index) => {
                  const text =
                    typeof item === "string"
                      ? item
                      : item.text ||
                        item.description ||
                        item.title ||
                        "";

                  return (
                    <div className="consideration" key={index}>
                      <Icon name="check" size={17} />
                      <p>{text}</p>
                    </div>
                  );
                })
              ) : (
                <p className="empty-report">
                  No additional considerations were returned.
                </p>
              )}
            </div>
          </ResultSection>

          {draft && (
            <ResultSection
              icon="copy"
              eyebrow="03 · READY TO USE"
              title="Suggested draft"
            >
              <div className="draft-box">
                <p>
                  {typeof draft === "string"
                    ? draft
                    : JSON.stringify(draft)}
                </p>

                <button
                  className="secondary-button"
                  onClick={copyDraft}
                >
                  <Icon
                    name={copied ? "check" : "copy"}
                    size={17}
                  />
                  {copied ? "Copied" : "Copy draft"}
                </button>
              </div>
            </ResultSection>
          )}

          <ResultSection
            icon="file"
            eyebrow="04 · RESOURCES"
            title="Useful resources"
          >
            <div className="resource-grid">
              {asArray(resources).length > 0 ? (
                asArray(resources).map((resource, index) => {
                  const name =
                    typeof resource === "string"
                      ? resource
                      : resource.title ||
                        resource.name ||
                        "Resource";

                  const description =
                    typeof resource === "string"
                      ? ""
                      : resource.description || "";

                  const url =
                    typeof resource === "object"
                      ? resource.url ||
                        resource.href ||
                        ""
                      : "";

                  return (
                    <div className="resource-card" key={index}>
                      <div>
                        <h3>{name}</h3>
                        {description && <p>{description}</p>}
                      </div>

                      {/^https?:\/\//i.test(url) && (
                        <a
                          href={url}
                          target="_blank"
                          rel="noreferrer"
                          aria-label={`Open ${name}`}
                        >
                          <Icon name="external" size={17} />
                        </a>
                      )}
                    </div>
                  );
                })
              ) : (
                <p className="empty-report">
                  No resources were returned for this assessment.
                </p>
              )}
            </div>
          </ResultSection>

          <ResultSection
            icon="external"
            eyebrow="05 · REFERENCES"
            title="References"
          >
            <div className="reference-list">
              {asArray(references).length > 0 ? (
                asArray(references).map((reference, index) => {
                  const title =
                    typeof reference === "string"
                      ? reference
                      : reference.title ||
                        reference.name ||
                        reference.url;

                  const url =
                    typeof reference === "string"
                      ? reference
                      : reference.url ||
                        reference.href ||
                        "";

                  if (!/^https?:\/\//i.test(url)) {
                    return (
                      <div
                        className="reference-row"
                        key={index}
                      >
                        <span>{title}</span>
                      </div>
                    );
                  }

                  return (
                    <a
                      className="reference-row"
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      key={index}
                    >
                      <span>{title}</span>
                      <Icon name="external" size={16} />
                    </a>
                  );
                })
              ) : (
                <p className="empty-report">
                  No external references were returned.
                </p>
              )}
            </div>
          </ResultSection>
        </div>

        <section className="report-chat">
          <div className="report-chat-heading">
            <div>
              <span className="eyebrow">CONTINUE EXPLORING</span>
              <h2>Ask VERLO about this report.</h2>
            </div>

            <Icon name="chat" size={25} />
          </div>

          <div className="chat-messages">
            {chatMessages.length === 0 ? (
              <div className="chat-empty">
                <p>
                  Ask for clarification, explore an alternative or request a
                  simpler explanation.
                </p>
              </div>
            ) : (
              chatMessages.map((message, index) => (
                <div
                  className={`chat-message ${
                    message.role === "user"
                      ? "user-message"
                      : "assistant-message"
                  }`}
                  key={index}
                >
                  <span>
                    {message.role === "user" ? "You" : "VERLO"}
                  </span>
                  <p>{message.content}</p>
                </div>
              ))
            )}
          </div>

          <form
            className="chat-input-row"
            onSubmit={event => {
              event.preventDefault();

              if (chatInput.trim() && !chatLoading) {
                onChat();
              }
            }}
          >
            <input
              value={chatInput}
              onChange={event => setChatInput(event.target.value)}
              placeholder="Ask a follow-up..."
            />

            <button
              className="primary-button"
              disabled={!chatInput.trim() || chatLoading}
            >
              {chatLoading ? (
                <LoadingDots />
              ) : (
                <Icon name="arrow" size={18} />
              )}
            </button>
          </form>
        </section>
      </main>
    </div>
  );
}

function HistoryPanel({ history, onClose, onSelect, loading }) {
  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="history-modal"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="history-heading">
          <div>
            <span className="eyebrow">YOUR HISTORY</span>
            <h2>Previous assessments</h2>
          </div>

          <button className="modal-close" onClick={onClose}>
            <Icon name="close" size={20} />
          </button>
        </div>

        {loading ? (
          <div className="history-loading">
            <LoadingDots />
          </div>
        ) : history.length === 0 ? (
          <div className="history-empty">
            <Icon name="history" size={30} />
            <h3>No assessments yet</h3>
            <p>Your completed assessments will appear here.</p>
          </div>
        ) : (
          <div className="history-list">
            {history.map((item, index) => {
              const title =
                item.title ||
                item.situation ||
                item.prompt ||
                `Assessment ${index + 1}`;

              const date = item.createdAt || item.updatedAt;

              return (
                <button
                  className="history-item"
                  key={item.id || index}
                  onClick={() => onSelect(item)}
                >
                  <div>
                    <span>
                      {date
                        ? new Date(date).toLocaleDateString()
                        : "Assessment"}
                    </span>
                    <h3>{title}</h3>
                  </div>

                  <Icon name="arrow" size={18} />
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] = useState(loadState);
  const [user, setUser] = useState(null);

  const [authMode, setAuthMode] = useState(null);
  const [authLoading, setAuthLoading] = useState(false);
  const [authError, setAuthError] = useState("");

  const [verificationLoading, setVerificationLoading] = useState(false);
  const [verificationError, setVerificationError] = useState("");
  const [verificationMessage, setVerificationMessage] = useState("");
  const [resendLoading, setResendLoading] = useState(false);
  const [resendCooldown, setResendCooldown] = useState(0);

  const [assessmentLoading, setAssessmentLoading] = useState(false);
  const [assessmentError, setAssessmentError] = useState("");

  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingStep, setProcessingStep] = useState(
    "Preparing your assessment"
  );

  const [history, setHistory] = useState([]);
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyLoading, setHistoryLoading] = useState(false);

  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);

  const stateRef = useRef(state);

  useEffect(() => {
    stateRef.current = state;
  }, [state]);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify({
          ...state,
          attachments: (state.attachments || []).map(file => ({
            name: file.name,
            type: file.type,
            size: file.size,
            text: file.text || ""
          }))
        })
      );
    } catch {}
  }, [state]);

  useEffect(() => {
    let mounted = true;

    const restoreSession = async () => {
      try {
        const data = await api("/api/auth/me");

        if (mounted) {
          setUser(data.user || data);
        }
      } catch {}

      if (!mounted) {
        return;
      }
    };

    restoreSession();

    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendCooldown(value => Math.max(0, value - 1));
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  useEffect(() => {
    if (state.screen !== "processing" || state.result) {
      return;
    }

    if (!state.situation || !state.answers?.length) {
      setState(previous => ({
        ...previous,
        screen: "home"
      }));

      return;
    }

    runAnalysis(state.answers);
  }, []);

  const updateState = updates => {
    setState(previous => ({
      ...previous,
      ...updates
    }));
  };

  const openLogin = () => {
    setAuthError("");
    setAuthMode("login");
  };

  const openSignup = () => {
    setAuthError("");
    setAuthMode("signup");
  };

  const handleLogin = async (email, password) => {
    setAuthLoading(true);
    setAuthError("");

    try {
      const data = await api("/api/auth/login", {
        method: "POST",
        body: JSON.stringify({
          email,
          password
        })
      });

      if (data.verificationRequired) {
        updateState({
          verificationEmail: email,
          verificationRequired: true
        });

        setAuthMode(null);
        setVerificationError("");
        setVerificationMessage("");

        return;
      }

      setUser(data.user || data);
      setAuthMode(null);
    } catch (error) {
      if (error.data?.verificationRequired) {
        updateState({
          verificationEmail: email,
          verificationRequired: true
        });

        setAuthMode(null);
        setVerificationError("");

        return;
      }

      setAuthError(error.message || "Unable to sign in.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleSignup = async (name, email, password) => {
    setAuthLoading(true);
    setAuthError("");

    try {
      const data = await api("/api/auth/signup", {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password
        })
      });

      updateState({
        verificationEmail: email,
        verificationRequired: true
      });

      setAuthMode(null);
      setVerificationError("");
      setVerificationMessage(
        data.message || "Verification code sent to your email."
      );
    } catch (error) {
      setAuthError(error.message || "Unable to create your account.");
    } finally {
      setAuthLoading(false);
    }
  };

  const handleVerify = async code => {
    setVerificationLoading(true);
    setVerificationError("");
    setVerificationMessage("");

    try {
      const data = await api("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({
          email: state.verificationEmail,
          code
        })
      });

      setUser(data.user || data);

      updateState({
        verificationRequired: false,
        verificationEmail: ""
      });

      setVerificationMessage("");
    } catch (error) {
      setVerificationError(
        error.message || "That verification code is not valid."
      );
    } finally {
      setVerificationLoading(false);
    }
  };

  const handleResendVerification = async () => {
    if (resendLoading || resendCooldown > 0) {
      return;
    }

    setResendLoading(true);
    setVerificationError("");
    setVerificationMessage("");

    try {
      const data = await api("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({
          email: state.verificationEmail
        })
      });

      setVerificationMessage(
        data.message || "A new verification code has been sent."
      );

      setResendCooldown(data.retryAfter || 60);
    } catch (error) {
      const retry = error.data?.retryAfter || 60;

      if (error.status === 429) {
        setResendCooldown(retry);
      }

      setVerificationError(
        error.message || "Unable to resend the verification email."
      );
    } finally {
      setResendLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await api("/api/auth/logout", {
        method: "POST"
      });
    } catch {}

    setUser(null);
  };

  const startNewAssessment = () => {
    updateState({
      screen: "input",
      situation: "",
      title: "",
      category: "",
      context: "",
      questions: [],
      answers: [],
      questionIndex: 0,
      result: null,
      attachments: []
    });

    setAssessmentError("");
    setAssessmentLoading(false);
    setProcessingProgress(0);
    setProcessingStep("Preparing your assessment");
    setChatMessages([]);
    setChatInput("");
  };

  const startAssessment = async () => {
    const current = stateRef.current;

    if (current.situation.trim().length < 10 || assessmentLoading) {
      return;
    }

    setAssessmentLoading(true);
    setAssessmentError("");

    try {
      const data = await api("/api/adaptive-question", {
        method: "POST",
        body: JSON.stringify({
          situation: current.situation,
          category: current.category,
          answers: [],
          questionIndex: 0,
          previousQuestions: [],
          attachments: current.attachments
        })
      });

      const firstQuestion =
        data.question ||
        data.questions?.[0] ||
        (data.questionText
          ? {
              question: data.questionText
            }
          : null);

      if (!firstQuestion) {
        throw new Error(
          "Adaptive engine failed to create the first question."
        );
      }

      updateState({
        screen: "questions",
        questions: [normalizeQuestion(firstQuestion, 0)],
        answers: [],
        questionIndex: 0,
        title: data.title || "",
        context: data.context || ""
      });
    } catch (error) {
      setAssessmentError(
        error.message ||
          "Adaptive engine failed to create the first question."
      );
    } finally {
      setAssessmentLoading(false);
    }
  };

  const requestNextQuestion = async (nextAnswers, nextIndex) => {
    const current = stateRef.current;

    if (nextIndex >= MAX_ADAPTIVE_QUESTIONS) {
      await runAnalysis(nextAnswers);
      return;
    }

    setAssessmentLoading(true);
    setAssessmentError("");

    try {
      const data = await api("/api/adaptive-question", {
        method: "POST",
        body: JSON.stringify({
          situation: current.situation,
          category: current.category,
          answers: nextAnswers,
          questionIndex: nextIndex,
          previousQuestions: current.questions,
          attachments: current.attachments
        })
      });

      const complete =
        data.complete === true ||
        data.done === true ||
        data.finished === true;

      if (complete) {
        await runAnalysis(nextAnswers);
        return;
      }

      const nextQuestion =
        data.question ||
        data.questions?.[0] ||
        (data.questionText
          ? {
              question: data.questionText
            }
          : null);

      if (!nextQuestion) {
        await runAnalysis(nextAnswers);
        return;
      }

      const normalized = normalizeQuestion(
        nextQuestion,
        nextIndex
      );

      updateState({
        questions: [...current.questions, normalized],
        questionIndex: nextIndex,
        answers: nextAnswers,
        title: data.title || current.title,
        context: data.context || current.context
      });
    } catch (error) {
      setAssessmentError(
        error.message ||
          "Unable to create the next adaptive question."
      );
    } finally {
      setAssessmentLoading(false);
    }
  };

  const saveAnswerAndContinue = async answer => {
    const current = stateRef.current;

    const existing = current.questions[current.questionIndex];

    if (!existing) {
      return;
    }

    const nextAnswers = [
      ...(current.answers || []).filter(
        item => item.questionId !== existing.id
      ),
      answer
    ];

    updateState({
      answers: nextAnswers
    });

    const nextIndex = current.questionIndex + 1;

    if (nextIndex >= MAX_ADAPTIVE_QUESTIONS) {
      await runAnalysis(nextAnswers);
      return;
    }

    await requestNextQuestion(nextAnswers, nextIndex);
  };

  const skipQuestion = async answer => {
    await saveAnswerAndContinue(answer);
  };

  const runAnalysis = async answers => {
    const current = stateRef.current;

    setAssessmentLoading(false);
    setAssessmentError("");
    setProcessingProgress(8);
    setProcessingStep("Reading your situation");

    updateState({
      screen: "processing",
      answers,
      result: null
    });

    try {
      setProcessingProgress(25);
      setProcessingStep("Connecting the important details");

      await new Promise(resolve => setTimeout(resolve, 350));

      setProcessingProgress(48);
      setProcessingStep("Comparing your answers");

      const data = await api("/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          situation: current.situation,
          category: current.category,
          answers,
          questions: current.questions,
          attachments: current.attachments
        })
      });

      setProcessingProgress(76);
      setProcessingStep("Structuring your report");

      await new Promise(resolve => setTimeout(resolve, 300));

      setProcessingProgress(94);
      setProcessingStep("Finishing your report");

      await new Promise(resolve => setTimeout(resolve, 300));

      const result =
        data.result ||
        data.analysis ||
        data.report ||
        data;

      updateState({
        screen: "results",
        result
      });

      setProcessingProgress(100);
      setProcessingStep("Complete");

      if (user) {
        loadHistory();
      }
    } catch (error) {
      setAssessmentError(
        error.message || "Unable to create your report."
      );

      updateState({
        screen: "questions"
      });
    }
  };

  const loadHistory = async () => {
    if (!user) {
      return;
    }

    setHistoryLoading(true);

    try {
      const data = await api("/api/history");

      setHistory(
        Array.isArray(data)
          ? data
          : data.history || data.items || []
      );
    } catch {
      setHistory([]);
    } finally {
      setHistoryLoading(false);
    }
  };

  const openHistory = async () => {
    setHistoryOpen(true);
    await loadHistory();
  };

  const selectHistory = item => {
    const result =
      item.result ||
      item.analysis ||
      item.report ||
      null;

    updateState({
      screen: "results",
      situation: item.situation || "",
      title: item.title || "",
      category: item.category || "",
      context: item.context || "",
      result,
      answers: item.answers || [],
      questions: item.questions || [],
      questionIndex: Math.max(
        0,
        (item.questions || []).length - 1
      )
    });

    setChatMessages([]);
    setChatInput("");
    setHistoryOpen(false);
  };

  const handleChat = async () => {
    const message = chatInput.trim();

    if (!message || chatLoading) {
      return;
    }

    setChatInput("");

    const nextMessages = [
      ...chatMessages,
      {
        role: "user",
        content: message
      }
    ];

    setChatMessages(nextMessages);
    setChatLoading(true);

    try {
      const data = await api("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          situation: state.situation,
          report: state.result,
          history: nextMessages
        })
      });

      setChatMessages(previous => [
        ...previous,
        {
          role: "assistant",
          content:
            data.message ||
            data.response ||
            data.answer ||
            "I could not generate a response."
        }
      ]);
    } catch (error) {
      setChatMessages(previous => [
        ...previous,
        {
          role: "assistant",
          content: error.message || "Something went wrong."
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const currentScreen = useMemo(() => {
    if (
      state.result &&
      state.screen !== "input" &&
      state.screen !== "questions"
    ) {
      return "results";
    }

    return state.screen;
  }, [state.result, state.screen]);

  return (
    <>
      {currentScreen === "home" && (
        <Home
          onStart={startNewAssessment}
          onHistory={openHistory}
          onLogin={openLogin}
          onSignup={openSignup}
          user={user}
          onLogout={handleLogout}
        />
      )}

      {currentScreen === "input" && (
        <InputPage
          situation={state.situation}
          setSituation={value =>
            updateState({ situation: value })
          }
          category={state.category}
          setCategory={value =>
            updateState({ category: value })
          }
          attachments={state.attachments}
          setAttachments={value =>
            updateState({ attachments: value })
          }
          onContinue={startAssessment}
          onBack={() =>
            updateState({
              screen: "home"
            })
          }
          loading={assessmentLoading}
          error={assessmentError}
        />
      )}

      {currentScreen === "questions" && (
        <AdaptiveAssessment
          questions={state.questions}
          questionIndex={state.questionIndex}
          answers={state.answers}
          onContinue={saveAnswerAndContinue}
          onSkip={skipQuestion}
          onBack={() =>
            updateState({
              screen: "input"
            })
          }
          loading={assessmentLoading}
          error={assessmentError}
        />
      )}

      {currentScreen === "processing" && (
        <Processing
          progress={processingProgress}
          step={processingStep}
        />
      )}

      {currentScreen === "results" && state.result && (
        <Results
          result={state.result}
          situation={state.situation}
          onNew={startNewAssessment}
          onHistory={openHistory}
          onChat={handleChat}
          chatMessages={chatMessages}
          chatInput={chatInput}
          setChatInput={setChatInput}
          chatLoading={chatLoading}
          user={user}
        />
      )}

      {authMode && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          onClose={() => setAuthMode(null)}
          onLogin={handleLogin}
          onSignup={handleSignup}
          loading={authLoading}
          error={authError}
        />
      )}

      {state.verificationRequired && (
        <VerificationModal
          email={state.verificationEmail}
          onVerify={handleVerify}
          onResend={handleResendVerification}
          onClose={() =>
            updateState({
              verificationRequired: false,
              verificationEmail: ""
            })
          }
          loading={verificationLoading}
          resendLoading={resendLoading}
          resendCooldown={resendCooldown}
          error={verificationError}
          message={verificationMessage}
        />
      )}

      {historyOpen && (
        <HistoryPanel
          history={history}
          onClose={() => setHistoryOpen(false)}
          onSelect={selectHistory}
          loading={historyLoading}
        />
      )}
    </>
  );
}