import { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";

const API_URL = import.meta.env.VITE_API_URL || "http://127.0.0.1:5001";
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
    if (!saved) return initialState;
    return {
      ...initialState,
      ...JSON.parse(saved)
    };
  } catch {
    return initialState;
  }
}

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    credentials: "include",
    headers: {
      "Content-Type": "application/json",
      ...(options.headers || {})
    },
    ...options
  });

  let data = null;

  try {
    data = await response.json();
  } catch {
    data = null;
  }

  if (!response.ok) {
    throw new Error(
      data?.error ||
      data?.message ||
      `Request failed with status ${response.status}`
    );
  }

  return data;
}

function Icon({ name, size = 20, strokeWidth = 1.8 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": "true"
  };

  const paths = {
    arrow: (
      <>
        <path d="M5 12h14" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    back: (
      <>
        <path d="M19 12H5" />
        <path d="m11 18-6-6 6-6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    close: (
      <>
        <path d="m6 6 12 12" />
        <path d="M18 6 6 18" />
      </>
    ),
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.8-3.3 3.2-5 7-5s6.2 1.7 7 5" />
      </>
    ),
    upload: (
      <>
        <path d="M12 16V4" />
        <path d="m7 9 5-5 5 5" />
        <path d="M5 20h14" />
      </>
    ),
    send: (
      <>
        <path d="m22 2-7 20-4-9-9-4Z" />
        <path d="M22 2 11 13" />
      </>
    ),
    clock: (
      <>
        <circle cx="12" cy="12" r="8.5" />
        <path d="M12 7v5l3 2" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 19 6v5c0 5-3 8-7 10-4-2-7-5-7-10V6Z" />
        <path d="m9 12 2 2 4-5" />
      </>
    ),
    spark: (
      <>
        <path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7Z" />
        <path d="m19 16 .7 2.3L22 19l-2.3.7L19 22l-.7-2.3L16 19l2.3-.7Z" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </>
    ),
    file: (
      <>
        <path d="M6 3h8l4 4v14H6Z" />
        <path d="M14 3v5h4" />
        <path d="M9 13h6" />
        <path d="M9 17h5" />
      </>
    ),
    external: (
      <>
        <path d="M14 5h5v5" />
        <path d="m19 5-8 8" />
        <path d="M19 13v6H5V5h6" />
      </>
    ),
    copy: (
      <>
        <rect x="8" y="8" width="11" height="12" rx="2" />
        <path d="M16 8V6a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v9a2 2 0 0 0 2 2h2" />
      </>
    )
  };

  return <svg {...common}>{paths[name] || paths.spark}</svg>;
}

function Logo({ compact = false }) {
  return (
    <div className={`verlo-logo ${compact ? "compact" : ""}`}>
      <span className="verlo-logo-mark">
        <span />
        <span />
        <span />
      </span>
      <span className="verlo-logo-word">VERLO</span>
    </div>
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
  onClose,
  onSubmit,
  onGoogle,
  onSwitch,
  loading,
  error
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");

  const isSignup = mode === "signup";

  return (
    <div className="modal-backdrop" role="presentation">
      <div
        className="auth-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="auth-title"
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>

        <div className="auth-heading">
          <span className="auth-icon">
            <Icon name="user" size={22} />
          </span>
          <div>
            <span className="eyebrow">VERLO ACCOUNT</span>
            <h2 id="auth-title">
              {isSignup ? "Create your account" : "Welcome back"}
            </h2>
            <p>
              {isSignup
                ? "Save reports and continue your decisions across devices."
                : "Sign in to access your saved reports and history."}
            </p>
          </div>
        </div>

        <form
          className="auth-form"
          onSubmit={event => {
            event.preventDefault();
            onSubmit({ email, password, name });
          }}
        >
          {isSignup && (
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
              type="email"
              value={email}
              onChange={event => setEmail(event.target.value)}
              autoComplete="email"
              required
            />
          </label>

          <label className="input-wrap">
            <span>Password</span>
            <input
              type="password"
              value={password}
              onChange={event => setPassword(event.target.value)}
              autoComplete={isSignup ? "new-password" : "current-password"}
              required
              minLength={6}
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="primary-button auth-submit" disabled={loading}>
            {loading ? <LoadingDots /> : isSignup ? "Create account" : "Sign in"}
          </button>
        </form>

        <div className="auth-divider">
          <span>OR</span>
        </div>

        <button
          className="google-button"
          onClick={onGoogle}
          disabled={loading}
          type="button"
        >
          Continue with Google
        </button>

        <div className="auth-switch">
          <span>
            {isSignup ? "Already have an account?" : "Don't have an account?"}
          </span>
          <button onClick={onSwitch}>
            {isSignup ? "Sign in" : "Create one"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VerificationModal({
  email,
  onClose,
  onVerify,
  onResend,
  loading,
  message
}) {
  const [code, setCode] = useState("");

  return (
    <div className="modal-backdrop">
      <div
        className="verification-modal"
        role="dialog"
        aria-modal="true"
        aria-labelledby="verification-title"
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>

        <div className="verification-icon">
          <Icon name="shield" size={28} />
        </div>

        <span className="eyebrow">VERIFY EMAIL</span>
        <h2 id="verification-title">Check your inbox</h2>
        <p>
          We sent a verification code to <strong>{email}</strong>.
        </p>

        <form
          onSubmit={event => {
            event.preventDefault();
            onVerify(code);
          }}
        >
          <input
            className="verification-code"
            value={code}
            onChange={event =>
              setCode(event.target.value.replace(/\D/g, "").slice(0, 6))
            }
            inputMode="numeric"
            placeholder="000000"
            aria-label="Verification code"
          />

          {message && <div className="form-success">{message}</div>}

          <button className="primary-button" disabled={loading || code.length < 4}>
            {loading ? <LoadingDots /> : "Verify email"}
          </button>
        </form>

        <button className="resend-button" onClick={onResend} disabled={loading}>
          Resend code
        </button>
      </div>
    </div>
  );
}

function Home({ onStart, onHistory, onAccount, user }) {
  return (
    <main className="home-page">
      <header className="site-header">
        <button className="brand-button" onClick={() => window.scrollTo(0, 0)}>
          <Logo />
        </button>

        <nav className="site-nav">
          {user && (
            <button className="history-nav-button" onClick={onHistory}>
              <Icon name="history" size={17} />
              <span>History</span>
            </button>
          )}

          <button className="account-button" onClick={onAccount}>
            <Icon name="user" size={17} />
            <span>{user ? "Account" : "Sign in"}</span>
          </button>

          <button className="header-cta" onClick={onStart}>
            Start a decision
            <Icon name="arrow" size={16} />
          </button>
        </nav>
      </header>

      <section className="hero-section">
        <div className="hero-content">
          <span className="eyebrow">
            <span className="eyebrow-dot" />
            DECISION INTELLIGENCE
          </span>

          <h1>
            Make sense of
            <br />
            <span>what comes next.</span>
          </h1>

          <p className="hero-description">
            VERLO turns complicated situations into a clear, structured
            decision report. It asks the questions that matter, adapts to your
            answers, and helps you understand your options.
          </p>

          <div className="hero-actions">
            <button className="hero-button" onClick={onStart}>
              Start a decision
              <Icon name="arrow" size={18} />
            </button>

            <button className="secondary-button" onClick={onHistory}>
              View history
            </button>
          </div>

          <div className="hero-note">
            <Icon name="shield" size={15} />
            Designed to help you think clearly, not decide for you.
          </div>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-orbit orbit-three" />

          <div className="hero-core">
            <span className="hero-core-line" />
            <span className="hero-core-line" />
            <span className="hero-core-line" />
          </div>

          <div className="floating-card floating-card-top">
            <span className="floating-label">CONTEXT</span>
            <strong>Structured</strong>
          </div>

          <div className="floating-card floating-card-bottom">
            <span className="floating-label">NEXT STEP</span>
            <strong>Clearer</strong>
          </div>
        </div>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <span className="eyebrow">HOW VERLO WORKS</span>
          <h2>From uncertainty to understanding.</h2>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <span className="feature-number">01</span>
            <span className="feature-icon">
              <Icon name="file" size={21} />
            </span>
            <h3>Explain the situation</h3>
            <p>
              Tell VERLO what is happening in your own words. You don't need to
              know exactly what you need yet.
            </p>
          </article>

          <article className="feature-card">
            <span className="feature-number">02</span>
            <span className="feature-icon">
              <Icon name="spark" size={21} />
            </span>
            <h3>Answer what matters</h3>
            <p>
              The assessment adapts as you answer, focusing on information
              that can actually change the analysis.
            </p>
          </article>

          <article className="feature-card">
            <span className="feature-number">03</span>
            <span className="feature-icon">
              <Icon name="check" size={21} />
            </span>
            <h3>Understand the result</h3>
            <p>
              Get a structured report with context, considerations, next
              steps, and useful references.
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
  category,
  setCategory,
  attachments,
  setAttachments,
  onBack,
  onContinue,
  loading
}) {
  const categories = [
    "Travel",
    "Education",
    "Finance",
    "Technology",
    "Work",
    "Health",
    "Relationships",
    "Other"
  ];

  const fileInput = useRef(null);

  function addFiles(event) {
    const files = Array.from(event.target.files || []);

    setAttachments(previous => [
      ...previous,
      ...files.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size
      }))
    ]);

    event.target.value = "";
  }

  return (
    <main className="assessment-page">
      <header className="assessment-header">
        <button className="back-button" onClick={onBack}>
          <Icon name="back" size={18} />
          <span>Back</span>
        </button>
        <Logo compact />
        <span className="assessment-step">01 / 03</span>
      </header>

      <div className="assessment-main">
        <div className="assessment-intro">
          <span className="eyebrow">START HERE</span>
          <h1>What's going on?</h1>
          <p>
            Give VERLO enough context to understand the situation. You can
            write naturally — there is no special format required.
          </p>
        </div>

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

        <div className="category-section">
          <span className="large-label">Category</span>

          <div className="category-row">
            {categories.map(item => (
              <button
                key={item}
                className={`category-chip ${
                  category === item ? "selected" : ""
                }`}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        <div className="attachment-area">
          <input
            ref={fileInput}
            type="file"
            multiple
            hidden
            onChange={addFiles}
          />

          <button
            className="attachment-button"
            onClick={() => fileInput.current?.click()}
          >
            <Icon name="upload" size={17} />
            Add supporting files
          </button>

          {attachments.length > 0 && (
            <div className="attachment-list">
              {attachments.map((attachment, index) => (
                <div
                  className="attachment-item"
                  key={`${attachment.name}-${index}`}
                >
                  <Icon name="file" size={16} />
                  <span>{attachment.name}</span>
                  <button
                    onClick={() =>
                      setAttachments(items =>
                        items.filter((_, itemIndex) => itemIndex !== index)
                      )
                    }
                    aria-label={`Remove ${attachment.name}`}
                  >
                    <Icon name="close" size={14} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="input-footer">
          <span>
            {situation.length < 20
              ? "A little more context will help."
              : "Ready to build your assessment."}
          </span>

          <button
            className="primary-button"
            onClick={onContinue}
            disabled={loading || situation.trim().length < 20}
          >
            {loading ? <LoadingDots /> : "Continue"}
            {!loading && <Icon name="arrow" size={17} />}
          </button>
        </div>
      </div>
    </main>
  );
}

function normalizeQuestion(question, index) {
  if (!question) return null;

  const text =
    question.question ||
    question.text ||
    question.questionText ||
    question.prompt ||
    "";

  const rawType = String(
    question.type ||
    question.answerType ||
    question.inputType ||
    "text"
  ).toLowerCase();

  const options =
    question.options ||
    question.choices ||
    question.answers ||
    [];

  const normalizedOptions = Array.isArray(options)
    ? options.map(option => {
        if (typeof option === "string") return option;
        return option.label || option.text || option.value || "";
      }).filter(Boolean)
    : [];

  const explicitMultiline =
    question.multiline ??
    question.multiLine ??
    question.isMultiline;

  const explicitSingleLine =
    question.singleLine ??
    question.isSingleLine;

  const oneLineTypes = [
    "short_text",
    "short-text",
    "one_line",
    "one-line",
    "single_line",
    "single-line",
    "input",
    "text_short"
  ];

  const multiLineTypes = [
    "long_text",
    "long-text",
    "multiline",
    "multi_line",
    "multi-line",
    "textarea",
    "paragraph"
  ];

  let oneLine;

  if (typeof explicitSingleLine === "boolean") {
    oneLine = explicitSingleLine;
  } else if (typeof explicitMultiline === "boolean") {
    oneLine = !explicitMultiline;
  } else if (oneLineTypes.includes(rawType)) {
    oneLine = true;
  } else if (multiLineTypes.includes(rawType)) {
    oneLine = false;
  } else if (normalizedOptions.length > 0) {
    oneLine = true;
  } else {
    const lower = text.trim().toLowerCase();

    oneLine =
      /^(do|does|did|is|are|was|were|have|has|had|can|could|will|would|should)\b/.test(
        lower
      ) ||
      lower.length <= 120;
  }

  return {
    ...question,
    id: question.id || `question-${index + 1}`,
    question: text,
    type: normalizedOptions.length ? "choice" : "text",
    options: normalizedOptions,
    oneLine,
    placeholder:
      question.placeholder ||
      (oneLine ? "Type your answer..." : "Write your answer here...")
  };
}

function AdaptiveQuestion({
  question,
  answers,
  onAnswer,
  onContinue,
  onSkip,
  loading
}) {
  // LUCKY NUMBER 888
  const currentAnswer =
    answers.find(answer => answer.questionId === question.id)?.answer || "";

  const [value, setValue] = useState(currentAnswer);

  useEffect(() => {
    const answer =
      answers.find(item => item.questionId === question.id)?.answer || "";

    setValue(answer);
  }, [question.id, answers]);

  function submit() {
    onAnswer(value);
  }

  function handleKeyDown(event) {
    if (
      question.oneLine &&
      event.key === "Enter" &&
      !event.shiftKey &&
      !loading
    ) {
      event.preventDefault();
      submit();
    }
  }

  return (
    <div className="adaptive-question">
      <div className="question-meta">
        <span>QUESTION</span>
        <span>{question.oneLine ? "SHORT ANSWER" : "YOUR RESPONSE"}</span>
      </div>

      <h1 className="question-title">{question.question}</h1>

      {question.image && (
        <div className="question-image">
          <img src={question.image} alt="" />
        </div>
      )}

      {question.type === "choice" ? (
        <div className="choice-list">
          {question.options.map(option => (
            <button
              key={option}
              className={`choice-option ${
                value === option ? "selected" : ""
              }`}
              onClick={() => {
                setValue(option);
              }}
              disabled={loading}
            >
              <span className="choice-radio">
                {value === option && <span />}
              </span>
              <span>{option}</span>
            </button>
          ))}
        </div>
      ) : question.oneLine ? (
        <div className="adaptive-input-shell">
          <input
            type="text"
            value={value}
            onChange={event => setValue(event.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={question.placeholder}
            maxLength={4000}
            disabled={loading}
            autoFocus
          />
          <span>{value.length}/4000</span>
        </div>
      ) : (
        <div className="adaptive-textarea-shell">
          <textarea
            value={value}
            onChange={event => setValue(event.target.value)}
            placeholder={question.placeholder}
            rows={8}
            maxLength={4000}
            disabled={loading}
            autoFocus
          />

          <div className="adaptive-textarea-count">
            {value.length}/4000
          </div>
        </div>
      )}

      <div className="question-footer">
        <button
          className="skip-button"
          onClick={onSkip}
          disabled={loading}
        >
          Skip
        </button>

        <button
          className="continue-button"
          onClick={submit}
          disabled={
            loading ||
            (question.type === "choice" && !value) ||
            (question.type === "text" && !value.trim())
          }
        >
          {loading ? <LoadingDots /> : "Continue"}
          {!loading && <Icon name="arrow" size={17} />}
        </button>
      </div>

      {question.oneLine && (
        <div className="enter-hint">
          Press <kbd>Enter</kbd> to continue
        </div>
      )}
    </div>
  );
}

function AdaptiveAssessment({
  situation,
  category,
  attachments,
  questions,
  setQuestions,
  answers,
  setAnswers,
  questionIndex,
  setQuestionIndex,
  onComplete,
  onBack
}) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const question = questions[questionIndex];

  const progress = Math.min(
    100,
    Math.round(
      ((questionIndex + 1) / Math.max(questions.length, 1)) * 100
    )
  );

  async function startAssessment() {
    setLoading(true);
    setError("");

    try {
      const data = await api("/api/adaptive-question", {
        method: "POST",
        body: JSON.stringify({
          situation,
          category,
          answers: [],
          questionIndex: 0,
          previousQuestions: [],
          attachments
        })
      });

      const firstQuestion = normalizeQuestion(
        data.question ||
          data.questions?.[0] ||
          data.questionText,
        0
      );

      if (!firstQuestion?.question) {
        throw new Error(
          "Adaptive engine failed to create the first question."
        );
      }

      setQuestions([firstQuestion]);
      setQuestionIndex(0);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    if (questions.length === 0) {
      startAssessment();
    }
  }, []);

  async function requestNextQuestion(nextAnswers) {
    setLoading(true);
    setError("");

    try {
      const data = await api("/api/adaptive-question", {
        method: "POST",
        body: JSON.stringify({
          situation,
          category,
          answers: nextAnswers,
          questionIndex: nextAnswers.length,
          previousQuestions: questions.map(item => item.question),
          attachments
        })
      });

      if (
        data.complete ||
        data.done ||
        data.finished ||
        !(
          data.question ||
          data.questions?.[0] ||
          data.questionText
        )
      ) {
        onComplete(nextAnswers);
        return;
      }

      const nextQuestion = normalizeQuestion(
        data.question ||
          data.questions?.[0] ||
          data.questionText,
        questions.length
      );

      if (!nextQuestion?.question) {
        onComplete(nextAnswers);
        return;
      }

      const nextQuestions = [...questions, nextQuestion];

      setQuestions(nextQuestions);
      setQuestionIndex(nextQuestions.length - 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveAnswerAndContinue(answer) {
    const newAnswer = {
      questionId: question.id,
      question: question.question,
      answer: answer ?? "",
      skipped: answer?.skipped === true
    };

    const nextAnswers = [
      ...answers.filter(item => item.questionId !== question.id),
      newAnswer
    ];

    setAnswers(nextAnswers);

    if (nextAnswers.length >= MAX_ADAPTIVE_QUESTIONS) {
      onComplete(nextAnswers);
      return;
    }

    await requestNextQuestion(nextAnswers);
  }

  function skipQuestion() {
    saveAnswerAndContinue({
      skipped: true
    });
  }

  if (!question) {
    return (
      <main className="assessment-page adaptive-page">
        <header className="assessment-header">
          <button className="back-button" onClick={onBack}>
            <Icon name="back" size={18} />
            <span>Back</span>
          </button>
          <Logo compact />
          <span className="assessment-step">02 / 03</span>
        </header>

        <div className="adaptive-loading">
          <div className="processing-orb">
            <Icon name="spark" size={24} />
          </div>
          <span className="eyebrow">BUILDING YOUR ASSESSMENT</span>
          <h1>Understanding the situation...</h1>
          <p>
            VERLO is finding the first question that can help clarify what
            matters.
          </p>
          <LoadingDots />
          {error && <div className="form-error">{error}</div>}
        </div>
      </main>
    );
  }

  return (
    <main className="assessment-page adaptive-page">
      <header className="assessment-header">
        <button className="back-button" onClick={onBack}>
          <Icon name="back" size={18} />
          <span>Back</span>
        </button>

        <Logo compact />

        <span className="assessment-step">02 / 03</span>
      </header>

      <div className="adaptive-progress">
        <div className="assessment-progress-label">
          <span>ADAPTIVE ASSESSMENT</span>
          <span>
            {questionIndex + 1} / {MAX_ADAPTIVE_QUESTIONS}
          </span>
        </div>
        <div className="progress-track">
          <div
            className="progress-value"
            style={{ width: `${progress}%` }}
          />
        </div>
      </div>

      <div className="adaptive-main">
        <AdaptiveQuestion
          question={question}
          answers={answers}
          onAnswer={saveAnswerAndContinue}
          onContinue={saveAnswerAndContinue}
          onSkip={skipQuestion}
          loading={loading}
        />

        {error && <div className="form-error adaptive-error">{error}</div>}
      </div>
    </main>
  );
}

function Processing({ progress, message }) {
  return (
    <main className="processing-page">
      <div className="processing-inner">
        <div className="processing-orb">
          <Icon name="spark" size={28} />
        </div>

        <span className="eyebrow">ANALYSING</span>
        <h1>{message || "Building your report..."}</h1>

        <div className="processing-percent">{progress}%</div>

        <div className="processing-track">
          <div
            className="processing-value"
            style={{ width: `${progress}%` }}
          />
        </div>

        <p>
          VERLO is organising the information you provided into a clear,
          readable report.
        </p>
      </div>
    </main>
  );
}

function getResultValue(result, keys, fallback = "") {
  for (const key of keys) {
    const value = result?.[key];

    if (
      value !== undefined &&
      value !== null &&
      value !== ""
    ) {
      return value;
    }
  }

  return fallback;
}

function Markdown({ content }) {
  const [copied, setCopied] = useState(false);

  const html = useMemo(() => {
    if (!content) return "";

    let source = String(content)
      .replace(/\r\n/g, "\n")
      .replace(/\r/g, "\n");

    source = source.replace(
      /```([\w-]*)\n([\s\S]*?)```/g,
      (_, language, code) =>
        `<pre class="markdown-code"><code${
          language ? ` data-language="${language}"` : ""
        }>${escapeHtml(code.trim())}</code></pre>`
    );

    source = source.replace(
      /\|(.+)\|\n\|(?:\s*:?-+:?\s*\|)+\n((?:\|.*\|\n?)+)/g,
      (_, headerLine, bodyLines) => {
        const headers = splitTableRow(headerLine);
        const rows = bodyLines
          .trim()
          .split("\n")
          .map(row => splitTableRow(row));

        return `
          <div class="markdown-table-wrap">
            <table class="markdown-table">
              <thead>
                <tr>
                  ${headers.map(header => `<th>${inlineMarkdown(header)}</th>`).join("")}
                </tr>
              </thead>
              <tbody>
                ${rows
                  .map(
                    row => `
                    <tr>
                      ${headers
                        .map(
                          (_, index) =>
                            `<td>${inlineMarkdown(row[index] || "")}</td>`
                        )
                        .join("")}
                    </tr>
                  `
                  )
                  .join("")}
              </tbody>
            </table>
          </div>
        `;
      }
    );

    source = source
      .replace(/^### (.+)$/gm, "<h4>$1</h4>")
      .replace(/^## (.+)$/gm, "<h3>$1</h3>")
      .replace(/^# (.+)$/gm, "<h2>$1</h2>")
      .replace(/^\> (.+)$/gm, "<blockquote>$1</blockquote>")
      .replace(
        /^[-*] (.+)$/gm,
        '<li class="markdown-list-item">$1</li>'
      )
      .replace(
        /^\d+\. (.+)$/gm,
        '<li class="markdown-number-item">$1</li>'
      )
      .replace(
        /(<li class="markdown-list-item">.*<\/li>\n?)+/g,
        match => `<ul>${match}</ul>`
      )
      .replace(
        /(<li class="markdown-number-item">.*<\/li>\n?)+/g,
        match => `<ol>${match}</ol>`
      );

    source = source
      .split(/\n{2,}/)
      .map(block => {
        const trimmed = block.trim();

        if (
          !trimmed ||
          trimmed.startsWith("<h") ||
          trimmed.startsWith("<ul") ||
          trimmed.startsWith("<ol") ||
          trimmed.startsWith("<blockquote") ||
          trimmed.startsWith("<pre") ||
          trimmed.startsWith("<div")
        ) {
          return trimmed;
        }

        return `<p>${inlineMarkdown(trimmed).replace(/\n/g, "<br />")}</p>`;
      })
      .join("");

    return source;
  }, [content]);

  async function copyReport() {
    try {
      await navigator.clipboard.writeText(String(content || ""));
      setCopied(true);
      setTimeout(() => setCopied(false), 1600);
    } catch {}
  }

  return (
    <div className="markdown-content">
      <div dangerouslySetInnerHTML={{ __html: html }} />

      {content && (
        <button className="copy-report-button" onClick={copyReport}>
          <Icon name="copy" size={15} />
          {copied ? "Copied" : "Copy"}
        </button>
      )}
    </div>
  );
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#039;");
}

function inlineMarkdown(value) {
  return String(value)
    .replace(/`([^`]+)`/g, "<code>$1</code>")
    .replace(
      /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>'
    )
    .replace(/\*\*([^*]+)\*\*/g, "<strong>$1</strong>")
    .replace(/\*([^*]+)\*/g, "<em>$1</em>");
}

function splitTableRow(row) {
  return row
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map(cell => cell.trim());
}

function ResultSection({ title, icon, children }) {
  if (!children) return null;

  return (
    <section className="report-section">
      <div className="report-section-heading">
        <span className="report-heading-icon">
          <Icon name={icon} size={17} />
        </span>
        <h2>{title}</h2>
      </div>

      <div className="report-section-content">{children}</div>
    </section>
  );
}

function Results({
  result,
  situation,
  answers,
  onNewDecision,
  onHistory,
  onChat
}) {
  const summary = getResultValue(result, [
    "summary",
    "overview",
    "analysis",
    "report"
  ]);

  const title = getResultValue(result, [
    "title",
    "headline",
    "decisionTitle"
  ], "Your decision report");

  const nextSteps = getResultValue(result, [
    "nextSteps",
    "next_steps",
    "actions"
  ]);

  const considerations = getResultValue(result, [
    "considerations",
    "factors",
    "thingsToConsider"
  ]);

  const options = getResultValue(result, [
    "options",
    "alternatives"
  ]);

  const resources = getResultValue(result, [
    "resources",
    "references"
  ]);

  const context = getResultValue(result, [
    "context",
    "background"
  ]);

  const finalReport = getResultValue(result, [
    "markdown",
    "markdownReport",
    "fullReport"
  ]);

  function renderList(value) {
    if (!value) return null;

    const list = Array.isArray(value)
      ? value
      : String(value)
          .split("\n")
          .map(item => item.replace(/^[-*•]\s*/, "").trim())
          .filter(Boolean);

    return (
      <ul className="next-step-list">
        {list.map((item, index) => (
          <li className="next-step" key={index}>
            <span>
              <Icon name="check" size={14} />
            </span>
            <div>
              {typeof item === "object"
                ? item.text || item.title || JSON.stringify(item)
                : item}
            </div>
          </li>
        ))}
      </ul>
    );
  }

  return (
    <main className="results-page">
      <header className="site-header report-header">
        <button className="brand-button" onClick={onNewDecision}>
          <Logo />
        </button>

        <nav className="site-nav">
          <button className="history-nav-button" onClick={onHistory}>
            <Icon name="history" size={17} />
            <span>History</span>
          </button>

          <button className="header-cta" onClick={onNewDecision}>
            New decision
            <Icon name="plus" size={16} />
          </button>
        </nav>
      </header>

      <div className="report-container">
        <section className="report-hero">
          <div className="report-hero-copy">
            <span className="eyebrow">
              <span className="eyebrow-dot" />
              DECISION REPORT
            </span>

            <h1>{title}</h1>

            <p>
              A structured analysis based on the situation and answers you
              provided.
            </p>
          </div>

          <div className="report-context">
            <span>ORIGINAL SITUATION</span>
            <p>{situation}</p>
          </div>
        </section>

        {finalReport && (
          <ResultSection title="Full report" icon="file">
            <Markdown content={finalReport} />
          </ResultSection>
        )}

        {summary && (
          <ResultSection title="What this means" icon="spark">
            <Markdown
              content={
                typeof summary === "string"
                  ? summary
                  : JSON.stringify(summary, null, 2)
              }
            />
          </ResultSection>
        )}

        {context && (
          <ResultSection title="Context" icon="file">
            <Markdown
              content={
                typeof context === "string"
                  ? context
                  : JSON.stringify(context, null, 2)
              }
            />
          </ResultSection>
        )}

        {options && (
          <ResultSection title="Options to consider" icon="spark">
            {Array.isArray(options) ? (
              <div className="consideration-list">
                {options.map((option, index) => (
                  <div className="consideration" key={index}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <div>
                      <h3>
                        {typeof option === "object"
                          ? option.title || option.name || `Option ${index + 1}`
                          : `Option ${index + 1}`}
                      </h3>
                      <p>
                        {typeof option === "object"
                          ? option.description ||
                            option.summary ||
                            JSON.stringify(option)
                          : option}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <Markdown content={String(options)} />
            )}
          </ResultSection>
        )}

        {considerations && (
          <ResultSection title="Things to consider" icon="shield">
            {renderList(considerations)}
          </ResultSection>
        )}

        {nextSteps && (
          <ResultSection title="Possible next steps" icon="arrow">
            {renderList(nextSteps)}
          </ResultSection>
        )}

        {resources && (
          <ResultSection title="References and resources" icon="external">
            <div className="reference-list">
              {Array.isArray(resources) ? (
                resources.map((resource, index) => {
                  const href =
                    typeof resource === "object"
                      ? resource.url || resource.link
                      : "";

                  const label =
                    typeof resource === "object"
                      ? resource.title ||
                        resource.name ||
                        resource.label ||
                        href
                      : resource;

                  return (
                    <div className="reference-row" key={index}>
                      <Icon name="external" size={16} />
                      {href ? (
                        <a
                          href={href}
                          target="_blank"
                          rel="noopener noreferrer"
                        >
                          {label}
                        </a>
                      ) : (
                        <span>{label}</span>
                      )}
                    </div>
                  );
                })
              ) : (
                <Markdown content={String(resources)} />
              )}
            </div>
          </ResultSection>
        )}

        <ResultSection title="Your responses" icon="check">
          <div className="answer-review">
            {answers.map((answer, index) => (
              <div className="answer-review-item" key={answer.questionId || index}>
                <span>{String(index + 1).padStart(2, "0")}</span>
                <div>
                  <strong>{answer.question}</strong>
                  <p>
                    {answer.skipped
                      ? "Skipped"
                      : answer.answer || "No answer provided"}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ResultSection>

        <section className="report-chat">
          <div className="report-chat-heading">
            <div>
              <span className="eyebrow">CONTINUE THINKING</span>
              <h2>Ask VERLO about this report.</h2>
            </div>

            <span className="chat-status">
              <span />
              Ready
            </span>
          </div>

          <ReportChat
            result={result}
            situation={situation}
            onChat={onChat}
          />
        </section>

        <div className="report-actions">
          <button className="secondary-button" onClick={onHistory}>
            <Icon name="history" size={16} />
            View history
          </button>

          <button className="primary-button" onClick={onNewDecision}>
            Start another decision
            <Icon name="arrow" size={17} />
          </button>
        </div>
      </div>
    </main>
  );
}

function ReportChat({ result, situation, onChat }) {
  const [messages, setMessages] = useState([]);
  const [value, setValue] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const endRef = useRef(null);

  useEffect(() => {
    endRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }, [messages, loading]);

  async function sendMessage() {
    const message = value.trim();

    if (!message || loading) return;

    const userMessage = {
      role: "user",
      content: message
    };

    setMessages(previous => [...previous, userMessage]);
    setValue("");
    setLoading(true);
    setError("");

    try {
      const data = await api("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          situation,
          result,
          history: [...messages, userMessage]
        })
      });

      const reply =
        data.reply ||
        data.message ||
        data.content ||
        data.response ||
        "";

      if (!reply) {
        throw new Error("The response was empty.");
      }

      setMessages(previous => [
        ...previous,
        {
          role: "assistant",
          content: reply
        }
      ]);
    } catch (chatError) {
      setError(chatError.message);

      setMessages(previous => [
        ...previous,
        {
          role: "assistant",
          content:
            "I couldn't finish that response. Please try sending the question again."
        }
      ]);
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(event) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      sendMessage();
    }
  }

  return (
    <div className="chat-container">
      <div className="chat-messages" aria-live="polite">
        {messages.length === 0 && (
          <div className="chat-empty">
            <span className="chat-empty-icon">
              <Icon name="spark" size={19} />
            </span>
            <p>
              Ask about the report, a specific option, a consideration, or
              what you could do next.
            </p>
          </div>
        )}

        {messages.map((message, index) => (
          <div
            className={
              message.role === "user"
                ? "user-message"
                : "assistant-message"
            }
            key={index}
          >
            <span className="chat-message-label">
              {message.role === "user" ? "YOU" : "VERLO"}
            </span>

            {message.role === "assistant" ? (
              <Markdown content={message.content} />
            ) : (
              <p>{message.content}</p>
            )}
          </div>
        ))}

        {loading && (
          <div className="assistant-message">
            <span className="chat-message-label">VERLO</span>
            <LoadingDots />
          </div>
        )}

        <div ref={endRef} />
      </div>

      {error && <div className="form-error chat-error">{error}</div>}

      <div className="chat-input">
        <textarea
          value={value}
          onChange={event => setValue(event.target.value)}
          onKeyDown={handleKeyDown}
          placeholder="Ask a follow-up question..."
          rows={2}
          disabled={loading}
        />

        <button
          onClick={sendMessage}
          disabled={loading || !value.trim()}
          aria-label="Send message"
        >
          <Icon name="send" size={17} />
        </button>
      </div>

      <span className="chat-hint">
        Press Enter to send · Shift + Enter for a new line
      </span>
    </div>
  );
}

function HistoryPanel({ onClose, onOpen }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadHistory() {
      try {
        const data = await api("/api/history");
        setHistory(data.history || data.items || data || []);
      } catch (requestError) {
        setError(requestError.message);
      } finally {
        setLoading(false);
      }
    }

    loadHistory();
  }, []);

  return (
    <div className="modal-backdrop">
      <div className="history-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>

        <div className="history-heading">
          <span className="eyebrow">SAVED DECISIONS</span>
          <h2>Your history</h2>
          <p>Previous reports saved to your VERLO account.</p>
        </div>

        {loading ? (
          <div className="history-loading">
            <LoadingDots />
          </div>
        ) : error ? (
          <div className="form-error">{error}</div>
        ) : history.length === 0 ? (
          <div className="history-empty">
            <Icon name="clock" size={26} />
            <h3>No saved decisions yet</h3>
            <p>Your completed reports will appear here.</p>
          </div>
        ) : (
          <div className="history-list">
            {history.map((item, index) => {
              const itemTitle =
                item.title ||
                item.situation ||
                item.name ||
                `Decision ${index + 1}`;

              const date = item.createdAt || item.created_at || item.date;

              return (
                <button
                  className="history-item"
                  key={item.id || index}
                  onClick={() => onOpen(item)}
                >
                  <span className="history-item-icon">
                    <Icon name="file" size={17} />
                  </span>

                  <span className="history-item-copy">
                    <strong>{itemTitle}</strong>
                    {date && (
                      <small>
                        {new Date(date).toLocaleDateString(undefined, {
                          year: "numeric",
                          month: "short",
                          day: "numeric"
                        })}
                      </small>
                    )}
                  </span>

                  <Icon name="arrow" size={16} />
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
  const [verificationMessage, setVerificationMessage] = useState("");
  const [processingProgress, setProcessingProgress] = useState(0);
  const [processingMessage, setProcessingMessage] = useState(
    "Building your report..."
  );
  const [showHistory, setShowHistory] = useState(false);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    async function checkAuth() {
      try {
        const data = await api("/api/auth/me");
        setUser(data.user || data || null);
      } catch {
        setUser(null);
      }
    }

    checkAuth();
  }, []);

  function updateState(updates) {
    setState(previous => ({
      ...previous,
      ...updates
    }));
  }

  function resetDecision() {
    updateState({
      ...initialState,
      screen: "input"
    });
  }

  function startDecision() {
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
  }

  async function handleAuthSubmit(credentials) {
    setAuthLoading(true);
    setAuthError("");

    try {
      const endpoint =
        authMode === "signup"
          ? "/api/auth/signup"
          : "/api/auth/login";

      const data = await api(endpoint, {
        method: "POST",
        body: JSON.stringify(credentials)
      });

      if (data.verificationRequired || data.requiresVerification) {
        updateState({
          verificationEmail: credentials.email,
          verificationRequired: true
        });
        setAuthMode(null);
      } else {
        setUser(data.user || data);
        setAuthMode(null);
      }
    } catch (error) {
      setAuthError(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function verifyEmail(code) {
    setAuthLoading(true);
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
        verificationRequired: false
      });
    } catch (error) {
      setVerificationMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function resendVerification() {
    setAuthLoading(true);
    setVerificationMessage("");

    try {
      await api("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({
          email: state.verificationEmail
        })
      });

      setVerificationMessage("A new verification code has been sent.");
    } catch (error) {
      setVerificationMessage(error.message);
    } finally {
      setAuthLoading(false);
    }
  }

  async function logout() {
    try {
      await api("/api/auth/logout", {
        method: "POST"
      });
    } catch {}

    setUser(null);
    setShowHistory(false);
  }

  async function runAnalysis(answers) {
    updateState({
      screen: "processing",
      answers
    });

    setProcessingProgress(8);
    setProcessingMessage("Reviewing your answers...");

    const progressSteps = [
      [24, "Connecting the important details..."],
      [43, "Comparing the relevant factors..."],
      [61, "Structuring the analysis..."],
      [79, "Preparing practical next steps..."],
      [92, "Finishing your report..."]
    ];

    let currentStep = 0;

    const interval = setInterval(() => {
      if (currentStep >= progressSteps.length) {
        clearInterval(interval);
        return;
      }

      const [progress, message] = progressSteps[currentStep];
      setProcessingProgress(progress);
      setProcessingMessage(message);
      currentStep += 1;
    }, 700);

    try {
      const data = await api("/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          situation: state.situation,
          category: state.category,
          answers,
          attachments: state.attachments
        })
      });

      clearInterval(interval);
      setProcessingProgress(100);
      setProcessingMessage("Your report is ready.");

      const result = data.result || data;

      setTimeout(() => {
        updateState({
          screen: "results",
          result,
          answers
        });
      }, 450);
    } catch (error) {
      clearInterval(interval);
      setProcessingProgress(100);
      setProcessingMessage(error.message);
    }
  }

  function completeAssessment(answers) {
    runAnalysis(answers);
  }

  function openHistoryItem(item) {
    setShowHistory(false);

    updateState({
      screen: "results",
      situation: item.situation || "",
      category: item.category || "",
      answers: item.answers || [],
      result: item.result || item.report || item
    });
  }

  async function handleChat(message, history) {
    return api("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        message,
        history,
        situation: state.situation,
        result: state.result
      })
    });
  }

  return (
    <>
      {state.screen === "home" && (
        <Home
          onStart={startDecision}
          onHistory={() => setShowHistory(true)}
          onAccount={() => {
            if (user) {
              setAuthMode("account");
            } else {
              setAuthMode("login");
            }
          }}
          user={user}
        />
      )}

      {state.screen === "input" && (
        <InputPage
          situation={state.situation}
          setSituation={value => updateState({ situation: value })}
          category={state.category}
          setCategory={value => updateState({ category: value })}
          attachments={state.attachments}
          setAttachments={value =>
            updateState({
              attachments:
                typeof value === "function"
                  ? value(state.attachments)
                  : value
            })
          }
          onBack={() => updateState({ screen: "home" })}
          onContinue={() =>
            updateState({
              screen: "adaptive",
              questions: [],
              answers: [],
              questionIndex: 0
            })
          }
          loading={false}
        />
      )}

      {state.screen === "adaptive" && (
        <AdaptiveAssessment
          situation={state.situation}
          category={state.category}
          attachments={state.attachments}
          questions={state.questions}
          setQuestions={value => updateState({ questions: value })}
          answers={state.answers}
          setAnswers={value => updateState({ answers: value })}
          questionIndex={state.questionIndex}
          setQuestionIndex={value =>
            updateState({ questionIndex: value })
          }
          onComplete={completeAssessment}
          onBack={() => updateState({ screen: "input" })}
        />
      )}

      {state.screen === "processing" && (
        <Processing
          progress={processingProgress}
          message={processingMessage}
        />
      )}

      {state.screen === "results" && (
        <Results
          result={state.result}
          situation={state.situation}
          answers={state.answers}
          onNewDecision={startDecision}
          onHistory={() => setShowHistory(true)}
          onChat={handleChat}
        />
      )}

      {showHistory && (
        <HistoryPanel
          onClose={() => setShowHistory(false)}
          onOpen={openHistoryItem}
        />
      )}

      {authMode && authMode !== "account" && (
        <AuthModal
          mode={authMode}
          onClose={() => {
            setAuthMode(null);
            setAuthError("");
          }}
          onSubmit={handleAuthSubmit}
          onGoogle={() => {
            window.location.href = `${API_URL}/api/auth/google`;
          }}
          onSwitch={() => {
            setAuthError("");
            setAuthMode(authMode === "login" ? "signup" : "login");
          }}
          loading={authLoading}
          error={authError}
        />
      )}

      {authMode === "account" && user && (
        <div className="modal-backdrop">
          <div className="account-modal">
            <button
              className="modal-close"
              onClick={() => setAuthMode(null)}
              aria-label="Close"
            >
              <Icon name="close" />
            </button>

            <span className="eyebrow">ACCOUNT</span>
            <h2>{user.name || user.email || "Your account"}</h2>
            {user.email && <p>{user.email}</p>}

            <div className="account-actions">
              <button
                className="secondary-button"
                onClick={() => {
                  setAuthMode(null);
                  setShowHistory(true);
                }}
              >
                <Icon name="history" size={16} />
                View history
              </button>

              <button className="danger-button" onClick={logout}>
                Sign out
              </button>
            </div>
          </div>
        </div>
      )}

      {state.verificationRequired && (
        <VerificationModal
          email={state.verificationEmail}
          onClose={() =>
            updateState({
              verificationRequired: false
            })
          }
          onVerify={verifyEmail}
          onResend={resendVerification}
          loading={authLoading}
          message={verificationMessage}
        />
      )}
    </>
  );
}