import { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";

const API_URL = import.meta.env.VITE_API_URL || "https://verlo-30xs.onrender.com";
const STORAGE_KEY = "verlo_app_state_v4";
const MAX_ADAPTIVE_QUESTIONS = 7;

const DEFAULT_STATE = {
  screen: "home",
  situation: "",
  title: "",
  category: "General",
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
  if (typeof window === "undefined") return DEFAULT_STATE;

  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (!saved) return DEFAULT_STATE;

    const parsed = JSON.parse(saved);

    return {
      ...DEFAULT_STATE,
      ...parsed,
      questions: Array.isArray(parsed.questions) ? parsed.questions : [],
      answers: Array.isArray(parsed.answers) ? parsed.answers : [],
      attachments: Array.isArray(parsed.attachments) ? parsed.attachments : []
    };
  } catch {
    return DEFAULT_STATE;
  }
}

function saveState(state) {
  if (typeof window === "undefined") return;

  try {
    localStorage.setItem(
      STORAGE_KEY,
      JSON.stringify({
        screen: state.screen,
        situation: state.situation,
        title: state.title,
        category: state.category,
        context: state.context,
        questions: state.questions,
        answers: state.answers,
        questionIndex: state.questionIndex,
        result: state.result,
        attachments: state.attachments,
        verificationEmail: state.verificationEmail,
        verificationRequired: state.verificationRequired
      })
    );
  } catch {
    return;
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    }
  });

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (!response.ok) {
    throw new Error(
      data.error ||
        data.message ||
        `Request failed with status ${response.status}.`
    );
  }

  return data;
}

const ICON_PATHS = {
  "arrow-right": (
    <>
      <path d="M5 12h14" />
      <path d="m13 6 6 6-6 6" />
    </>
  ),
  "arrow-left": (
    <>
      <path d="M19 12H5" />
      <path d="m11 18-6-6 6-6" />
    </>
  ),
  check: <path d="m5 12 4 4L19 6" />,
  skip: (
    <>
      <path d="m8 5 8 7-8 7V5Z" />
      <path d="M19 5v14" />
    </>
  ),
  plus: (
    <>
      <path d="M12 5v14" />
      <path d="M5 12h14" />
    </>
  ),
  upload: (
    <>
      <path d="M12 16V4" />
      <path d="m7 9 5-5 5 5" />
      <path d="M5 20h14" />
    </>
  ),
  paperclip: (
    <>
      <path d="m21.44 11.05-8.49 8.49a6 6 0 0 1-8.49-8.49l9.19-9.19a4 4 0 0 1 5.66 5.66l-9.2 9.19a2 2 0 0 1-2.83-2.83l8.49-8.48" />
    </>
  ),
  clock: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  spark: (
    <>
      <path d="m12 3 1.6 5.4L19 10l-5.4 1.6L12 17l-1.6-5.4L5 10l5.4-1.6L12 3Z" />
      <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7L19 16Z" />
    </>
  ),
  shield: (
    <>
      <path d="M12 3 19 6v5c0 4.5-2.8 8.1-7 10-4.2-1.9-7-5.5-7-10V6l7-3Z" />
      <path d="m9 12 2 2 4-4" />
    </>
  ),
  compass: (
    <>
      <circle cx="12" cy="12" r="8.5" />
      <path d="m15.5 8.5-2.2 4.8-4.8 2.2 2.2-4.8 4.8-2.2Z" />
    </>
  ),
  history: (
    <>
      <path d="M3 12a9 9 0 1 0 3-6.7" />
      <path d="M3 5v5h5" />
      <path d="M12 7v5l3 2" />
    </>
  ),
  user: (
    <>
      <circle cx="12" cy="8" r="3.5" />
      <path d="M5 21a7 7 0 0 1 14 0" />
    </>
  ),
  close: (
    <>
      <path d="m6 6 12 12" />
      <path d="m18 6-12 12" />
    </>
  ),
  send: (
    <>
      <path d="m4 4 16 8-16 8 3-8-3-8Z" />
      <path d="M7 12h9" />
    </>
  ),
  chevron: <path d="m7 10 5 5 5-5" />,
  external: (
    <>
      <path d="M14 5h5v5" />
      <path d="M19 5 10 14" />
      <path d="M18 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V7a1 1 0 0 1 1-1h5" />
    </>
  ),
  warning: (
    <>
      <path d="M12 4 21 20H3L12 4Z" />
      <path d="M12 9v5" />
      <path d="M12 17h.01" />
    </>
  )
};

function Icon({ name, size = 18, strokeWidth = 1.8 }) {
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={strokeWidth}
      aria-hidden="true"
      focusable="false"
    >
      {ICON_PATHS[name] || ICON_PATHS.spark}
    </svg>
  );
}

function Logo({ compact = false }) {
  return (
    <span className={`logo ${compact ? "logo-compact" : ""}`}>
      <span className="logo-mark">V</span>
      <span className="logo-name">VERLO</span>
    </span>
  );
}

function LoadingDots() {
  return (
    <span className="loading-dots" aria-label="Loading">
      <span />
      <span />
      <span />
    </span>
  );
}

function AuthModal({
  mode,
  setMode,
  onClose,
  onSuccess,
  onVerificationRequired
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";

      const data = await api(endpoint, {
        method: "POST",
        body: JSON.stringify({
          name,
          email,
          password
        })
      });

      if (data.verificationRequired || data.requiresVerification) {
        onVerificationRequired(email);
        return;
      }

      onSuccess(data.user || data);
      onClose();
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function googleLogin() {
    setError("");

    try {
      const data = await api("/api/auth/google", {
        method: "GET"
      });

      if (data.url) {
        window.location.href = data.url;
        return;
      }

      setError("Google sign-in is not available right now.");
    } catch (err) {
      setError(err.message);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-heading"
        onMouseDown={event => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>

        <div className="auth-heading">
          <span className="eyebrow">{mode === "login" ? "WELCOME BACK" : "CREATE ACCOUNT"}</span>
          <h2 id="auth-heading">
            {mode === "login" ? "Sign in to VERLO" : "Create your VERLO account"}
          </h2>
          <p>
            {mode === "login"
              ? "Access your saved decisions and reports."
              : "Save your decisions and return to them whenever you need."}
          </p>
        </div>

        <button className="google-button" type="button" onClick={googleLogin}>
          <span className="google-mark">G</span>
          Continue with Google
        </button>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && (
            <label className="input-wrap">
              <span>Name</span>
              <input
                value={name}
                onChange={event => setName(event.target.value)}
                autoComplete="name"
                required
              />
            </label>
          )}

          <label className="input-wrap">
            <span>Email</span>
            <input
              value={email}
              onChange={event => setEmail(event.target.value)}
              type="email"
              autoComplete="email"
              required
            />
          </label>

          <label className="input-wrap">
            <span>Password</span>
            <input
              value={password}
              onChange={event => setPassword(event.target.value)}
              type="password"
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="continue-button auth-submit" disabled={loading}>
            {loading ? <LoadingDots /> : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <button
          className="auth-switch"
          type="button"
          onClick={() => {
            setError("");
            setMode(mode === "login" ? "signup" : "login");
          }}
        >
          {mode === "login"
            ? "Don't have an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

function VerificationModal({ email, onClose, onVerified }) {
  const [code, setCode] = useState("");
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);

  async function verify(event) {
    event.preventDefault();
    setError("");
    setMessage("");
    setLoading(true);

    try {
      const data = await api("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({
          email,
          code
        })
      });

      onVerified(data.user || data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setError("");
    setMessage("");
    setResending(true);

    try {
      await api("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email })
      });

      setMessage("A new verification code has been sent.");
    } catch (err) {
      setError(err.message);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="auth-modal verification-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-heading"
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>

        <div className="verification-icon">
          <Icon name="shield" size={28} />
        </div>

        <div className="auth-heading">
          <span className="eyebrow">VERIFY EMAIL</span>
          <h2 id="verification-heading">Check your inbox</h2>
          <p>
            Enter the verification code sent to <strong>{email}</strong>.
          </p>
        </div>

        <form onSubmit={verify} className="auth-form">
          <label className="input-wrap">
            <span>Verification code</span>
            <input
              value={code}
              onChange={event => setCode(event.target.value)}
              inputMode="numeric"
              autoComplete="one-time-code"
              required
            />
          </label>

          {error && <div className="form-error">{error}</div>}
          {message && <div className="form-success">{message}</div>}

          <button className="continue-button auth-submit" disabled={loading}>
            {loading ? <LoadingDots /> : "Verify email"}
          </button>
        </form>

        <button className="resend-button" onClick={resend} disabled={resending}>
          {resending ? "Sending..." : "Resend code"}
        </button>
      </div>
    </div>
  );
}

function Home({ onStart, onHistory, onAccount, user }) {
  return (
    <main className="home-page">
      <header className="site-header">
        <button className="brand-button" onClick={onStart} aria-label="VERLO home">
          <Logo />
        </button>

        <nav className="site-nav" aria-label="Primary navigation">
          {user && (
            <button className="history-nav-button" onClick={onHistory}>
              <Icon name="history" size={17} />
              History
            </button>
          )}

          <button className="account-button" onClick={onAccount}>
            <Icon name="user" size={17} />
            {user ? user.name || user.email || "Account" : "Sign in"}
          </button>
        </nav>
      </header>

      <section className="hero-section">
        <div className="hero-content">
          <span className="eyebrow">DECISION INTELLIGENCE</span>

          <h1>
            Make sense of
            <br />
            <span>what comes next.</span>
          </h1>

          <p className="hero-description">
            VERLO turns complicated situations into clear, structured
            decisions, practical next steps and useful drafts.
          </p>

          <div className="hero-actions">
            <button className="hero-button" onClick={onStart}>
              Start with a situation
              <Icon name="arrow-right" />
            </button>

            {user && (
              <button className="secondary-button" onClick={onHistory}>
                View history
              </button>
            )}
          </div>

          <div className="hero-note">
            <Icon name="shield" size={15} />
            <span>Your information stays private to your VERLO session.</span>
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-orbit orbit-three" />
          <div className="hero-core">
            <Icon name="compass" size={42} strokeWidth={1.4} />
          </div>

          <div className="floating-card card-one">
            <span className="floating-label">SITUATION</span>
            <strong>Understood</strong>
            <Icon name="check" size={16} />
          </div>

          <div className="floating-card card-two">
            <span className="floating-label">NEXT STEP</span>
            <strong>Clarified</strong>
            <Icon name="arrow-right" size={16} />
          </div>

          <div className="floating-card card-three">
            <Icon name="spark" size={16} />
            <span>Adaptive analysis</span>
          </div>
        </div>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <span className="eyebrow">HOW IT WORKS</span>
          <h2>A clearer way forward.</h2>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <div className="feature-number">01</div>
            <div className="feature-icon">
              <Icon name="compass" />
            </div>
            <h3>Explain the situation</h3>
            <p>
              Start with what is happening, what you are deciding, or what
              you are unsure about.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-number">02</div>
            <div className="feature-icon">
              <Icon name="spark" />
            </div>
            <h3>Answer what matters</h3>
            <p>
              VERLO asks adaptive questions based on the information you have
              already provided.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-number">03</div>
            <div className="feature-icon">
              <Icon name="arrow-right" />
            </div>
            <h3>Get a practical plan</h3>
            <p>
              Receive a structured report with next steps, considerations,
              resources and useful drafts.
            </p>
          </article>
        </div>
      </section>
    </main>
  );
}

function InputPage({
  situation,
  setSituation,
  title,
  setTitle,
  category,
  setCategory,
  context,
  setContext,
  attachments,
  setAttachments,
  onBack,
  onStart,
  loading,
  error
}) {
  const fileInputRef = useRef(null);

  function handleFiles(event) {
    const files = Array.from(event.target.files || []);

    const next = files.map(file => ({
      name: file.name,
      type: file.type,
      size: file.size
    }));

    setAttachments(previous => [...previous, ...next]);
    event.target.value = "";
  }

  function removeAttachment(index) {
    setAttachments(previous => previous.filter((_, i) => i !== index));
  }

  return (
    <main className="assessment-page">
      <header className="assessment-header">
        <button className="brand-button" onClick={onBack} aria-label="Back to home">
          <Logo />
        </button>

        <button className="back-button" onClick={onBack}>
          <Icon name="arrow-left" size={17} />
          Back
        </button>
      </header>

      <div className="assessment-main">
        <div className="assessment-intro">
          <span className="eyebrow">START HERE</span>
          <h1>What are you trying to figure out?</h1>
          <p>
            Give VERLO enough context to understand the situation. You can
            keep it simple — the adaptive questions will handle the rest.
          </p>
        </div>

        <form
          className="input-form"
          onSubmit={event => {
            event.preventDefault();
            onStart();
          }}
        >
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
            <div className="textarea-count">
              {situation.length.toLocaleString()} / 6,000
            </div>
          </div>

          <div className="input-fields-grid">
            <label className="input-wrap">
              <span>Title</span>
              <input
                value={title}
                onChange={event => setTitle(event.target.value)}
                placeholder="Give this situation a name"
                maxLength={160}
              />
            </label>

            <label className="input-wrap">
              <span>Category</span>
              <select
                value={category}
                onChange={event => setCategory(event.target.value)}
              >
                <option>General</option>
                <option>Travel</option>
                <option>Money</option>
                <option>Consumer</option>
                <option>Technology</option>
                <option>Education</option>
                <option>Work</option>
                <option>Health</option>
                <option>Legal</option>
                <option>Other</option>
              </select>
            </label>
          </div>

          <label className="input-wrap">
            <span>Additional context</span>
            <textarea
              value={context}
              onChange={event => setContext(event.target.value)}
              placeholder="Anything else VERLO should know?"
              rows={4}
              maxLength={3000}
            />
          </label>

          <div className="attachment-area">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={handleFiles}
            />

            <button
              type="button"
              className="attachment-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="paperclip" size={17} />
              Add supporting files
            </button>

            {attachments.length > 0 && (
              <div className="attachment-list">
                {attachments.map((file, index) => (
                  <div className="attachment-item" key={`${file.name}-${index}`}>
                    <Icon name="paperclip" size={15} />
                    <span>{file.name}</span>
                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      aria-label={`Remove ${file.name}`}
                    >
                      <Icon name="close" size={14} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {error && (
            <div className="form-error input-error">
              <Icon name="warning" size={16} />
              {error}
            </div>
          )}

          <div className="input-footer">
            <span>
              <Icon name="shield" size={15} />
              VERLO asks only what it needs.
            </span>

            <button
              className="continue-button"
              type="submit"
              disabled={loading || situation.trim().length < 5}
            >
              {loading ? (
                <LoadingDots />
              ) : (
                <>
                  Continue
                  <Icon name="arrow-right" />
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </main>
  );
}

function normalizeQuestion(question, index) {
  if (typeof question === "string") {
    return {
      id: `question-${index + 1}`,
      type: "text",
      question,
      stem: question,
      choices: [],
      imageUrl: "",
      imageAlt: "",
      imageCaption: "",
      multiline: undefined,
      answerType: "",
      placeholder: "",
      required: true
    };
  }

  const source = question || {};
  const rawChoices = source.choices || source.options || [];

  const choices = Array.isArray(rawChoices)
    ? rawChoices
        .map(choice => {
          if (typeof choice === "string") return choice;
          return choice?.label || choice?.text || choice?.value || "";
        })
        .filter(Boolean)
    : [];

  return {
    id:
      source.id ||
      source.questionId ||
      source.key ||
      `question-${index + 1}`,
    type: source.type || "text",
    question:
      source.question ||
      source.questionText ||
      source.prompt ||
      source.stem ||
      "",
    stem: source.stem || source.question || source.prompt || "",
    choices,
    imageUrl: source.imageUrl || source.image || "",
    imageAlt: source.imageAlt || "",
    imageCaption: source.imageCaption || "",
    multiline:
      typeof source.multiline === "boolean"
        ? source.multiline
        : typeof source.multiLine === "boolean"
          ? source.multiLine
          : undefined,
    answerType: source.answerType || source.inputType || "",
    placeholder: source.placeholder || "",
    required:
      typeof source.required === "boolean" ? source.required : true
  };
}

function isMultilineQuestion(question) {
  if (question.multiline === true || question.multiLine === true) {
    return true;
  }

  if (question.multiline === false || question.multiLine === false) {
    return false;
  }

  const answerType = String(
    question.answerType || question.inputType || question.type || ""
  ).toLowerCase();

  if (
    [
      "long_text",
      "long-text",
      "textarea",
      "paragraph",
      "multi_line",
      "multi-line",
      "multiline"
    ].includes(answerType)
  ) {
    return true;
  }

  if (
    [
      "short_text",
      "short-text",
      "single_line",
      "single-line",
      "text",
      "string",
      "short",
      "input"
    ].includes(answerType)
  ) {
    if (String(question.inputType).toLowerCase() === "textarea") {
      return true;
    }

    return false;
  }

  const text = String(question.question || "").trim();

  if (
    /^(do you|are you|is |can you|have you|would you|will you|did you|does |could you|has |was |were )/i.test(
      text
    )
  ) {
    return false;
  }

  if (
    /\b(explain|describe|in your own words|provide details|tell me about|what happened|what has happened|what records|what evidence|what documents|what problem .* and what|why)\b/i.test(
      text
    )
  ) {
    return true;
  }

  return false;
}

function AdaptiveAssessment({
  questions,
  questionIndex,
  answers,
  setAnswers,
  onBack,
  onContinue,
  onSkip,
  loading,
  error
}) {
  const question = questions[questionIndex];

  if (!question) {
    return null;
  }

  const [value, setValue] = useState("");
  const multiline = useMemo(
    () => isMultilineQuestion(question),
    [question]
  );

  // LUCKY NUMBER 888
  const currentAnswer =
    answers.find(answer => answer.questionId === question.id)?.answer || "";

  useEffect(() => {
    const answer =
      answers.find(item => item.questionId === question.id)?.answer || "";
    setValue(answer);
  }, [question.id, answers]);

  function updateAnswer(nextValue) {
    setValue(nextValue);

    setAnswers(previous => {
      const existing = previous.findIndex(
        answer => answer.questionId === question.id
      );

      if (existing === -1) {
        return [
          ...previous,
          {
            questionId: question.id,
            question: question.question,
            answer: nextValue
          }
        ];
      }

      return previous.map((answer, index) =>
        index === existing ? { ...answer, answer: nextValue } : answer
      );
    });
  }

  function continueQuestion() {
    const trimmed = value.trim();

    if (question.required !== false && !trimmed) {
      return;
    }

    onContinue({
      questionId: question.id,
      question: question.question,
      answer: value
    });
  }

  function skipQuestion() {
    onSkip({
      questionId: question.id,
      question: question.question,
      answer: "[Skipped]"
    });
  }

  function handleKeyDown(event) {
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      if (!loading) continueQuestion();
      return;
    }

    if (multiline && event.key === "Enter" && (event.metaKey || event.ctrlKey)) {
      event.preventDefault();
      if (!loading) continueQuestion();
    }
  }

  const hasAnswer = Boolean(value.trim());
  const progress = Math.min(
    100,
    ((questionIndex + 1) / Math.max(questions.length, 1)) * 100
  );

  return (
    <main className="assessment-page">
      <header className="assessment-header">
        <button className="brand-button" onClick={onBack} aria-label="Back to home">
          <Logo />
        </button>

        <div className="assessment-progress">
          <span>
            Question {questionIndex + 1}
            {questions.length > 1 ? ` of up to ${MAX_ADAPTIVE_QUESTIONS}` : ""}
          </span>
          <div className="assessment-progress-bar">
            <span style={{ width: `${progress}%` }} />
          </div>
        </div>
      </header>

      <div className="adaptive-main">
        <div className="question-card">
          <div className="question-meta">
            <span>ADAPTIVE QUESTION</span>
            <span>{String(questionIndex + 1).padStart(2, "0")}</span>
          </div>

          <h1>{question.question}</h1>

          {question.imageUrl && (
            <figure className="question-image">
              <img
                src={question.imageUrl}
                alt={question.imageAlt || ""}
              />
              {question.imageCaption && (
                <figcaption>{question.imageCaption}</figcaption>
              )}
            </figure>
          )}

          {question.type === "mcq" || question.choices.length > 0 ? (
            <div className="choice-list" role="radiogroup">
              {question.choices.map((choice, index) => {
                const selected = value === choice;

                return (
                  <button
                    type="button"
                    className={`choice-option ${selected ? "selected" : ""}`}
                    key={`${choice}-${index}`}
                    onClick={() => updateAnswer(choice)}
                    role="radio"
                    aria-checked={selected}
                  >
                    <span className="choice-radio">
                      {selected && <span />}
                    </span>
                    <span>{choice}</span>
                  </button>
                );
              })}
            </div>
          ) : multiline ? (
            <div className="question-input-shell multiline-input-shell">
              <textarea
                value={value}
                onChange={event => updateAnswer(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  question.placeholder ||
                  "Write as much detail as you think is useful..."
                }
                rows={7}
                aria-label="Your answer"
              />
            </div>
          ) : (
            <div className="question-input-shell single-line-input-shell">
              <input
                type="text"
                value={value}
                onChange={event => updateAnswer(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={
                  question.placeholder || "Type your answer and press Enter..."
                }
                aria-label="Your answer"
                autoComplete="off"
              />
            </div>
          )}

          {error && (
            <div className="form-error question-error">
              <Icon name="warning" size={16} />
              {error}
            </div>
          )}

          <div className="question-footer">
            <span className="question-hint">
              {multiline
                ? "Tip: press ⌘/Ctrl + Enter to continue."
                : "Press Enter to continue."}
            </span>

            <div className="question-actions">
              <button
                type="button"
                className="secondary-button"
                onClick={skipQuestion}
                disabled={loading}
              >
                <Icon name="skip" size={16} />
                Skip
              </button>

              <button
                type="button"
                className="continue-button"
                onClick={continueQuestion}
                disabled={
                  loading ||
                  (!hasAnswer && question.required !== false)
                }
              >
                {loading ? (
                  <LoadingDots />
                ) : (
                  <>
                    Continue
                    <Icon name="arrow-right" />
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}

function Processing({ progress = 0 }) {
  return (
    <main className="processing-page">
      <div className="processing-inner" aria-live="polite">
        <div className="processing-orb">
          <div className="processing-orb-ring" />
          <Icon name="spark" size={32} />
        </div>

        <span className="eyebrow">ANALYSING YOUR SITUATION</span>
        <h1>Putting the pieces together.</h1>
        <p>
          VERLO is reviewing your answers and building a structured report.
        </p>

        <div className="processing-progress">
          <div className="processing-progress-bar">
            <span style={{ width: `${Math.min(progress, 100)}%` }} />
          </div>
          <span className="processing-percent">
            {Math.round(Math.min(progress, 100))}%
          </span>
        </div>
      </div>
    </main>
  );
}

function getResultValue(result, keys, fallback = "") {
  if (!result) return fallback;

  for (const key of keys) {
    const value = result[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
}

function normalizeText(value) {
  if (value === undefined || value === null) return "";

  if (typeof value === "string") return value;

  if (Array.isArray(value)) {
    return value
      .map(item => normalizeText(item))
      .filter(Boolean)
      .join("\n");
  }

  if (typeof value === "object") {
    if (value.text) return normalizeText(value.text);
    if (value.content) return normalizeText(value.content);
    if (value.description) return normalizeText(value.description);

    return Object.entries(value)
      .map(([key, item]) => `${key}: ${normalizeText(item)}`)
      .join("\n");
  }

  return String(value);
}

function parseInlineMarkdown(text) {
  const source = String(text ?? "");

  const pattern =
    /(`[^`]+`|\[[^\]]+\]\((?:https?:\/\/|mailto:)[^)]+\)|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;

  const parts = [];
  let lastIndex = 0;
  let match;

  while ((match = pattern.exec(source))) {
    if (match.index > lastIndex) {
      parts.push(source.slice(lastIndex, match.index));
    }

    const token = match[0];

    if (token.startsWith("`")) {
      parts.push(
        <code key={`code-${match.index}`} className="markdown-inline-code">
          {token.slice(1, -1)}
        </code>
      );
    } else if (token.startsWith("[")) {
      const linkMatch = token.match(
        /^\[([^\]]+)\]\(((?:https?:\/\/|mailto:)[^)]+)\)$/
      );

      if (linkMatch) {
        parts.push(
          <a
            key={`link-${match.index}`}
            href={linkMatch[2]}
            target="_blank"
            rel="noreferrer noopener"
          >
            {linkMatch[1]}
          </a>
        );
      } else {
        parts.push(token);
      }
    } else if (
      token.startsWith("**") ||
      token.startsWith("__")
    ) {
      parts.push(
        <strong key={`strong-${match.index}`}>
          {token.slice(2, -2)}
        </strong>
      );
    } else if (token.startsWith("*") || token.startsWith("_")) {
      parts.push(
        <em key={`em-${match.index}`}>
          {token.slice(1, -1)}
        </em>
      );
    } else {
      parts.push(token);
    }

    lastIndex = match.index + token.length;
  }

  if (lastIndex < source.length) {
    parts.push(source.slice(lastIndex));
  }

  return parts;
}

function splitTableRow(line) {
  let value = line.trim();

  if (value.startsWith("|")) value = value.slice(1);
  if (value.endsWith("|")) value = value.slice(0, -1);

  return value.split("|").map(cell => cell.trim());
}

function isTableDivider(line) {
  const cells = splitTableRow(line);

  return (
    cells.length > 0 &&
    cells.every(cell => /^:?-{3,}:?$/.test(cell.trim()))
  );
}

function MarkdownContent({ content }) {
  const markdown = normalizeText(content);

  if (!markdown.trim()) {
    return null;
  }

  const lines = markdown.replace(/\r\n/g, "\n").split("\n");
  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (line.trim().startsWith("```")) {
      const language = line.trim().slice(3).trim();
      const codeLines = [];
      index += 1;

      while (
        index < lines.length &&
        !lines[index].trim().startsWith("```")
      ) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) index += 1;

      blocks.push(
        <pre className="markdown-code-block" key={`code-block-${index}`}>
          <code data-language={language || undefined}>
            {codeLines.join("\n")}
          </code>
        </pre>
      );

      continue;
    }

    const heading = line.match(/^(#{1,6})\s+(.+)$/);

    if (heading) {
      const level = heading[1].length;
      const HeadingTag = `h${level}`;

      blocks.push(
        <HeadingTag key={`heading-${index}`}>
          {parseInlineMarkdown(heading[2])}
        </HeadingTag>
      );

      index += 1;
      continue;
    }

    if (
      index + 1 < lines.length &&
      line.includes("|") &&
      isTableDivider(lines[index + 1])
    ) {
      const headers = splitTableRow(line);
      const rows = [];
      index += 2;

      while (index < lines.length && lines[index].trim() && lines[index].includes("|")) {
        rows.push(splitTableRow(lines[index]));
        index += 1;
      }

      blocks.push(
        <div className="markdown-table-wrap" key={`table-${index}`}>
          <table className="markdown-table">
            <thead>
              <tr>
                {headers.map((header, cellIndex) => (
                  <th key={`head-${cellIndex}`}>
                    {parseInlineMarkdown(header)}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((row, rowIndex) => (
                <tr key={`row-${rowIndex}`}>
                  {headers.map((_, cellIndex) => (
                    <td key={`cell-${rowIndex}-${cellIndex}`}>
                      {parseInlineMarkdown(row[cellIndex] || "")}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

      continue;
    }

    if (/^>\s?/.test(line)) {
      const quoteLines = [];

      while (index < lines.length && /^>\s?/.test(lines[index])) {
        quoteLines.push(lines[index].replace(/^>\s?/, ""));
        index += 1;
      }

      blocks.push(
        <blockquote key={`quote-${index}`}>
          {quoteLines.map((quoteLine, quoteIndex) => (
            <p key={quoteIndex}>{parseInlineMarkdown(quoteLine)}</p>
          ))}
        </blockquote>
      );

      continue;
    }

    if (/^\s*[-*+]\s+/.test(line)) {
      const items = [];

      while (
        index < lines.length &&
        /^\s*[-*+]\s+/.test(lines[index])
      ) {
        items.push(lines[index].replace(/^\s*[-*+]\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ul key={`ul-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{parseInlineMarkdown(item)}</li>
          ))}
        </ul>
      );

      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];

      while (
        index < lines.length &&
        /^\s*\d+\.\s+/.test(lines[index])
      ) {
        items.push(lines[index].replace(/^\s*\d+\.\s+/, ""));
        index += 1;
      }

      blocks.push(
        <ol key={`ol-${index}`}>
          {items.map((item, itemIndex) => (
            <li key={itemIndex}>{parseInlineMarkdown(item)}</li>
          ))}
        </ol>
      );

      continue;
    }

    const paragraphLines = [line];
    index += 1;

    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,6}\s+/.test(lines[index]) &&
      !/^>\s?/.test(lines[index]) &&
      !/^\s*[-*+]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !lines[index].trim().startsWith("```") &&
      !(
        index + 1 < lines.length &&
        lines[index].includes("|") &&
        isTableDivider(lines[index + 1])
      )
    ) {
      paragraphLines.push(lines[index]);
      index += 1;
    }

    blocks.push(
      <p key={`paragraph-${index}`}>
        {paragraphLines.map((paragraphLine, paragraphIndex) => (
          <span key={paragraphIndex}>
            {paragraphIndex > 0 && <br />}
            {parseInlineMarkdown(paragraphLine)}
          </span>
        ))}
      </p>
    );
  }

  return <div className="markdown-content">{blocks}</div>;
}

function ResultSection({ icon, title, children, className = "" }) {
  return (
    <section className={`report-section ${className}`}>
      <div className="report-section-heading">
        <div className="report-heading-icon">
          <Icon name={icon} size={18} />
        </div>
        <h2>{title}</h2>
      </div>

      <div className="report-section-content">{children}</div>
    </section>
  );
}

function Results({
  result,
  title,
  situation,
  category,
  context,
  onNew,
  onHistory,
  user
}) {
  const [chatInput, setChatInput] = useState("");
  const [chatMessages, setChatMessages] = useState([]);
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  const summary = getResultValue(
    result,
    ["summary", "overview", "conclusion"],
    ""
  );

  const riskAssessment = getResultValue(
    result,
    ["riskAssessment", "risk", "risks"],
    ""
  );

  const nextSteps = getResultValue(
    result,
    ["nextSteps", "steps", "recommendations"],
    []
  );

  const panels = getResultValue(
    result,
    ["personalizedPanels", "panels", "considerations"],
    []
  );

  const draftTemplate = getResultValue(
    result,
    ["draftTemplate", "draft", "template"],
    ""
  );

  const resources = getResultValue(
    result,
    ["resources", "resourceList"],
    []
  );

  const references = getResultValue(
    result,
    ["referenceLinks", "references", "sources"],
    []
  );

  const confidence = getResultValue(
    result,
    ["confidence"],
    ""
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }, [chatMessages, chatLoading]);

  function normalizeList(value) {
    if (Array.isArray(value)) return value;

    if (typeof value === "string") {
      return value
        .split(/\n+/)
        .map(item => item.replace(/^\s*[-*]\s*/, "").trim())
        .filter(Boolean);
    }

    return [];
  }

  async function sendChat(event) {
    event?.preventDefault();

    const message = chatInput.trim();

    if (!message || chatLoading) return;

    setChatInput("");

    const userMessage = {
      role: "user",
      content: message
    };

    setChatMessages(previous => [...previous, userMessage]);
    setChatLoading(true);

    try {
      const data = await api("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          question: message,
          message,
          currentSituation: situation,
          context,
          attachment: null
        })
      });

      const reply =
        data.reply ||
        data.response ||
        data.message ||
        data.content ||
        data.answer ||
        data?.choices?.[0]?.message?.content ||
        "";

      if (!reply) {
        throw new Error("VERLO did not return a response.");
      }

      setChatMessages(previous => [
        ...previous,
        {
          role: "assistant",
          content: String(reply)
        }
      ]);
    } catch (error) {
      setChatMessages(previous => [
        ...previous,
        {
          role: "assistant",
          content: `I couldn't complete that follow-up. ${error.message}`
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  function handleChatKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendChat(event);
    }
  }

  const stepItems = normalizeList(nextSteps);
  const panelItems = Array.isArray(panels) ? panels : [];
  const resourceItems = Array.isArray(resources) ? resources : [];
  const referenceItems = Array.isArray(references) ? references : [];

  return (
    <main className="results-page">
      <header className="site-header report-header">
        <button className="brand-button" onClick={onNew} aria-label="VERLO home">
          <Logo />
        </button>

        <nav className="site-nav" aria-label="Report navigation">
          {user && (
            <button className="history-nav-button" onClick={onHistory}>
              <Icon name="history" size={17} />
              History
            </button>
          )}

          <button className="header-cta" onClick={onNew}>
            New situation
            <Icon name="plus" size={16} />
          </button>
        </nav>
      </header>

      <div className="report-container">
        <section className="report-hero">
          <div className="report-hero-copy">
            <span className="eyebrow">VERLO REPORT</span>
            <h1>{title || "Your decision report"}</h1>

            <div className="report-context">
              <span>{category || "General"}</span>
              {confidence && (
                <>
                  <span className="report-context-divider" />
                  <span>Confidence: {normalizeText(confidence)}</span>
                </>
              )}
            </div>

            <p>{summary || "VERLO has finished analysing your situation."}</p>
          </div>

          <div className="report-hero-mark" aria-hidden="true">
            <Icon name="compass" size={44} strokeWidth={1.35} />
          </div>
        </section>

        <div className="report-grid">
          {summary && (
            <ResultSection icon="spark" title="Summary">
              <MarkdownContent content={summary} />
            </ResultSection>
          )}

          {riskAssessment && (
            <ResultSection icon="shield" title="Risk and considerations">
              <MarkdownContent content={riskAssessment} />
            </ResultSection>
          )}

          {stepItems.length > 0 && (
            <ResultSection icon="arrow-right" title="Next steps">
              <div className="next-step-list">
                {stepItems.map((step, index) => (
                  <div className="next-step" key={index}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <MarkdownContent content={step} />
                    </div>
                  </div>
                ))}
              </div>
            </ResultSection>
          )}

          {panelItems.length > 0 && (
            <ResultSection icon="compass" title="Things to consider">
              <div className="consideration-list">
                {panelItems.map((panel, index) => {
                  const panelTitle =
                    typeof panel === "object"
                      ? panel.title || panel.heading || `Consideration ${index + 1}`
                      : `Consideration ${index + 1}`;

                  const panelContent =
                    typeof panel === "object"
                      ? panel.content || panel.description || panel.text || ""
                      : panel;

                  return (
                    <article className="consideration" key={index}>
                      <h3>{panelTitle}</h3>
                      <MarkdownContent content={panelContent} />
                    </article>
                  );
                })}
              </div>
            </ResultSection>
          )}

          {draftTemplate && (
            <ResultSection icon="send" title="Draft you can use">
              <div className="draft-box">
                <MarkdownContent content={draftTemplate} />
              </div>
            </ResultSection>
          )}

          {resourceItems.length > 0 && (
            <ResultSection icon="external" title="Resources">
              <div className="resource-grid">
                {resourceItems.map((resource, index) => {
                  const resourceTitle =
                    typeof resource === "object"
                      ? resource.title || resource.name || `Resource ${index + 1}`
                      : resource;

                  const resourceDescription =
                    typeof resource === "object"
                      ? resource.description || resource.text || ""
                      : "";

                  const resourceUrl =
                    typeof resource === "object"
                      ? resource.url || resource.href || ""
                      : "";

                  return (
                    <article className="resource-card" key={index}>
                      <h3>{resourceTitle}</h3>
                      {resourceDescription && (
                        <MarkdownContent content={resourceDescription} />
                      )}

                      {/^https?:\/\//i.test(resourceUrl) && (
                        <a
                          href={resourceUrl}
                          target="_blank"
                          rel="noreferrer noopener"
                        >
                          Open resource
                          <Icon name="external" size={14} />
                        </a>
                      )}
                    </article>
                  );
                })}
              </div>
            </ResultSection>
          )}

          {referenceItems.length > 0 && (
            <ResultSection icon="paperclip" title="References">
              <div className="reference-list">
                {referenceItems.map((reference, index) => {
                  const referenceTitle =
                    typeof reference === "object"
                      ? reference.title || reference.name || reference.label || `Reference ${index + 1}`
                      : reference;

                  const referenceUrl =
                    typeof reference === "object"
                      ? reference.url || reference.href || ""
                      : "";

                  return (
                    <div className="reference-row" key={index}>
                      <span>{String(index + 1).padStart(2, "0")}</span>

                      <div>
                        {/^https?:\/\//i.test(referenceUrl) ? (
                          <a
                            href={referenceUrl}
                            target="_blank"
                            rel="noreferrer noopener"
                          >
                            {referenceTitle}
                            <Icon name="external" size={14} />
                          </a>
                        ) : (
                          <MarkdownContent content={referenceTitle} />
                        )}
                      </div>
                    </div>
                  );
                })}
              </div>
            </ResultSection>
          )}

          <section className="report-chat">
            <div className="report-chat-heading">
              <div>
                <span className="eyebrow">FOLLOW UP</span>
                <h2>Ask VERLO about this report</h2>
              </div>

              <div className="chat-status">
                <span />
                Ready
              </div>
            </div>

            <div className="chat-messages" aria-live="polite">
              {chatMessages.length === 0 ? (
                <div className="chat-empty">
                  <Icon name="spark" size={20} />
                  <p>
                    Ask a follow-up about your situation, the report, or one of
                    the suggested next steps.
                  </p>
                </div>
              ) : (
                chatMessages.map((message, index) => (
                  <div
                    className={
                      message.role === "user"
                        ? "user-message"
                        : "assistant-message"
                    }
                    key={index}
                  >
                    <div className="chat-message-label">
                      {message.role === "user" ? "YOU" : "VERLO"}
                    </div>
                    <MarkdownContent content={message.content} />
                  </div>
                ))
              )}

              {chatLoading && (
                <div className="assistant-message">
                  <div className="chat-message-label">VERLO</div>
                  <LoadingDots />
                </div>
              )}

              <div ref={chatEndRef} />
            </div>

            <form className="chat-form" onSubmit={sendChat}>
              <textarea
                value={chatInput}
                onChange={event => setChatInput(event.target.value)}
                onKeyDown={handleChatKeyDown}
                placeholder="Ask a follow-up question..."
                rows={2}
                aria-label="Ask VERLO a follow-up question"
              />

              <button
                type="submit"
                className="continue-button"
                disabled={!chatInput.trim() || chatLoading}
                aria-label="Send message"
              >
                <Icon name="send" size={17} />
              </button>
            </form>

            <p className="chat-note">
              Press Enter to send. Shift + Enter for a new line.
            </p>
          </section>
        </div>
      </div>
    </main>
  );
}

function HistoryPanel({ onClose, onSelect }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;

    async function loadHistory() {
      try {
        const data = await api("/api/history");

        if (!active) return;

        setHistory(
          Array.isArray(data)
            ? data
            : data.history || data.items || []
        );
      } catch (err) {
        if (active) setError(err.message);
      } finally {
        if (active) setLoading(false);
      }
    }

    loadHistory();

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        className="history-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="history-heading"
        onMouseDown={event => event.stopPropagation()}
      >
        <div className="history-heading">
          <div>
            <span className="eyebrow">YOUR WORK</span>
            <h2 id="history-heading">History</h2>
          </div>

          <button className="modal-close" onClick={onClose} aria-label="Close">
            <Icon name="close" />
          </button>
        </div>

        {loading && (
          <div className="history-loading">
            <LoadingDots />
          </div>
        )}

        {!loading && error && (
          <div className="form-error">{error}</div>
        )}

        {!loading && !error && history.length === 0 && (
          <div className="history-empty">
            <Icon name="history" size={25} />
            <h3>No saved reports yet</h3>
            <p>
              Complete a VERLO assessment and your reports will appear here.
            </p>
          </div>
        )}

        {!loading && history.length > 0 && (
          <div className="history-list">
            {history.map((item, index) => {
              const itemTitle =
                item.title ||
                item.name ||
                item.situation ||
                `Report ${index + 1}`;

              const date =
                item.createdAt ||
                item.updatedAt ||
                item.date ||
                "";

              return (
                <button
                  className="history-item"
                  key={item.id || item._id || index}
                  onClick={() => onSelect(item)}
                >
                  <div>
                    <span className="history-item-category">
                      {item.category || "General"}
                    </span>
                    <h3>{itemTitle}</h3>
                    {date && (
                      <span className="history-item-date">
                        {new Date(date).toLocaleDateString()}
                      </span>
                    )}
                  </div>

                  <Icon name="arrow-right" size={17} />
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
  const initial = useMemo(() => loadState(), []);

  const [screen, setScreen] = useState(initial.screen);
  const [situation, setSituation] = useState(initial.situation);
  const [title, setTitle] = useState(initial.title);
  const [category, setCategory] = useState(initial.category);
  const [context, setContext] = useState(initial.context);
  const [questions, setQuestions] = useState(initial.questions);
  const [answers, setAnswers] = useState(initial.answers);
  const [questionIndex, setQuestionIndex] = useState(initial.questionIndex);
  const [result, setResult] = useState(initial.result);
  const [attachments, setAttachments] = useState(initial.attachments);
  const [verificationEmail, setVerificationEmail] = useState(
    initial.verificationEmail
  );
  const [verificationRequired, setVerificationRequired] = useState(
    initial.verificationRequired
  );

  const [user, setUser] = useState(null);
  const [authOpen, setAuthOpen] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [historyOpen, setHistoryOpen] = useState(false);

  const [loading, setLoading] = useState(false);
  const [processingProgress, setProcessingProgress] = useState(0);
  const [error, setError] = useState("");

  useEffect(() => {
    saveState({
      screen,
      situation,
      title,
      category,
      context,
      questions,
      answers,
      questionIndex,
      result,
      attachments,
      verificationEmail,
      verificationRequired
    });
  }, [
    screen,
    situation,
    title,
    category,
    context,
    questions,
    answers,
    questionIndex,
    result,
    attachments,
    verificationEmail,
    verificationRequired
  ]);

  useEffect(() => {
    let active = true;

    async function checkAuth() {
      try {
        const data = await api("/api/auth/me");

        if (active) {
          setUser(data.user || data);
        }
      } catch {
        if (active) {
          setUser(null);
        }
      }
    }

    checkAuth();

    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    if (screen !== "processing") {
      setProcessingProgress(0);
      return;
    }

    let value = 0;

    const timer = window.setInterval(() => {
      value += Math.random() * 5 + 1;

      if (value > 94) {
        value = 94;
      }

      setProcessingProgress(value);
    }, 450);

    return () => window.clearInterval(timer);
  }, [screen]);

  function resetAssessment() {
    setSituation("");
    setTitle("");
    setCategory("General");
    setContext("");
    setQuestions([]);
    setAnswers([]);
    setQuestionIndex(0);
    setResult(null);
    setAttachments([]);
    setError("");
    setScreen("input");
  }

  function goHome() {
    setError("");
    setScreen("home");
  }

  async function startAssessment() {
    if (situation.trim().length < 5 || loading) return;

    setLoading(true);
    setError("");

    try {
      const data = await api("/api/adaptive-question", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: situation,
          context,
          previousAnswers: [],
          previousQuestions: [],
          questionNumber: 1,
          maxQuestions: MAX_ADAPTIVE_QUESTIONS,
          attachments
        })
      });

      const rawQuestion =
        data.question ||
        data.questions?.[0] ||
        data.questionText ||
        data.data?.question;

      if (!rawQuestion) {
        throw new Error("Adaptive engine failed to create the first question.");
      }

      const firstQuestion = normalizeQuestion(rawQuestion, 0);

      setQuestions([firstQuestion]);
      setAnswers([]);
      setQuestionIndex(0);
      setScreen("assessment");
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function runAnalysis(finalAnswers = answers) {
    setLoading(false);
    setProcessingProgress(10);
    setScreen("processing");

    try {
      const data = await api("/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          title,
          prompt: situation,
          category,
          context,
          answers: finalAnswers,
          questions,
          attachment: attachments[0] || null,
          attachments
        })
      });

      if (!data.success && !data.result) {
        throw new Error(data.error || "VERLO could not complete the analysis.");
      }

      setProcessingProgress(100);
      setResult(data.result || data);
      setScreen("results");

      if (user) {
        try {
          await api("/api/history/save", {
            method: "POST",
            body: JSON.stringify({
              title,
              category,
              situation,
              result: data.result || data
            })
          });
        } catch {
          return;
        }
      }
    } catch (err) {
      setError(err.message);
      setScreen("assessment");
    }
  }

  async function requestNextQuestion(updatedAnswers) {
    if (loading) return;

    if (questionIndex + 1 >= MAX_ADAPTIVE_QUESTIONS) {
      await runAnalysis(updatedAnswers);
      return;
    }

    setLoading(true);
    setError("");

    try {
      const data = await api("/api/adaptive-question", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: situation,
          context,
          previousAnswers: updatedAnswers,
          previousQuestions: questions,
          questionNumber: questionIndex + 2,
          maxQuestions: MAX_ADAPTIVE_QUESTIONS,
          attachments
        })
      });

      if (
        data.complete ||
        data.done ||
        data.finished ||
        data.completed
      ) {
        await runAnalysis(updatedAnswers);
        return;
      }

      const rawQuestion =
        data.question ||
        data.questions?.[0] ||
        data.questionText ||
        data.data?.question;

      if (!rawQuestion) {
        await runAnalysis(updatedAnswers);
        return;
      }

      const nextQuestion = normalizeQuestion(
        rawQuestion,
        questions.length
      );

      setQuestions(previous => [...previous, nextQuestion]);
      setQuestionIndex(previous => previous + 1);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  async function handleContinue(answer) {
    const updatedAnswers = [
      ...answers.filter(item => item.questionId !== answer.questionId),
      answer
    ];

    setAnswers(updatedAnswers);
    await requestNextQuestion(updatedAnswers);
  }

  async function handleSkip(answer) {
    const updatedAnswers = [
      ...answers.filter(item => item.questionId !== answer.questionId),
      answer
    ];

    setAnswers(updatedAnswers);
    await requestNextQuestion(updatedAnswers);
  }

  async function handleLogout() {
    try {
      await api("/api/auth/logout", {
        method: "POST"
      });
    } catch {
      return;
    } finally {
      setUser(null);
      setHistoryOpen(false);
    }
  }

  function openAccount() {
    if (user) {
      handleLogout();
      return;
    }

    setAuthMode("login");
    setAuthOpen(true);
  }

  function handleAuthenticated(nextUser) {
    setUser(nextUser);
    setAuthOpen(false);
    setVerificationRequired(false);
  }

  function handleVerificationRequired(email) {
    setVerificationEmail(email);
    setVerificationRequired(true);
    setAuthOpen(false);
  }

  function handleHistorySelect(item) {
    const savedResult = item.result || item.report || item.data || item;

    setTitle(item.title || item.name || "Saved report");
    setCategory(item.category || "General");
    setSituation(item.situation || item.prompt || "");
    setContext(item.context || "");
    setResult(savedResult);
    setHistoryOpen(false);
    setScreen("results");
  }

  if (screen === "home") {
    return (
      <>
        <Home
          onStart={() => setScreen("input")}
          onHistory={() => setHistoryOpen(true)}
          onAccount={openAccount}
          user={user}
        />

        {authOpen && (
          <AuthModal
            mode={authMode}
            setMode={setAuthMode}
            onClose={() => setAuthOpen(false)}
            onSuccess={handleAuthenticated}
            onVerificationRequired={handleVerificationRequired}
          />
        )}

        {verificationRequired && (
          <VerificationModal
            email={verificationEmail}
            onClose={() => setVerificationRequired(false)}
            onVerified={handleAuthenticated}
          />
        )}

        {historyOpen && (
          <HistoryPanel
            onClose={() => setHistoryOpen(false)}
            onSelect={handleHistorySelect}
          />
        )}
      </>
    );
  }

  if (screen === "input") {
    return (
      <>
        <InputPage
          situation={situation}
          setSituation={setSituation}
          title={title}
          setTitle={setTitle}
          category={category}
          setCategory={setCategory}
          context={context}
          setContext={setContext}
          attachments={attachments}
          setAttachments={setAttachments}
          onBack={goHome}
          onStart={startAssessment}
          loading={loading}
          error={error}
        />

        {authOpen && (
          <AuthModal
            mode={authMode}
            setMode={setAuthMode}
            onClose={() => setAuthOpen(false)}
            onSuccess={handleAuthenticated}
            onVerificationRequired={handleVerificationRequired}
          />
        )}
      </>
    );
  }

  if (screen === "assessment") {
    return (
      <AdaptiveAssessment
        questions={questions}
        questionIndex={questionIndex}
        answers={answers}
        setAnswers={setAnswers}
        onBack={() => setScreen("input")}
        onContinue={handleContinue}
        onSkip={handleSkip}
        loading={loading}
        error={error}
      />
    );
  }

  if (screen === "processing") {
    return <Processing progress={processingProgress} />;
  }

  if (screen === "results") {
    return (
      <>
        <Results
          result={result}
          title={title}
          situation={situation}
          category={category}
          context={context}
          onNew={resetAssessment}
          onHistory={() => setHistoryOpen(true)}
          user={user}
        />

        {historyOpen && (
          <HistoryPanel
            onClose={() => setHistoryOpen(false)}
            onSelect={handleHistorySelect}
          />
        )}
      </>
    );
  }

  return null;
}