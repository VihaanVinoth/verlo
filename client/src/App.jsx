import { useEffect, useMemo, useRef, useState } from "react";
import "./index.css";

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
    if (!saved) return initialState;

    const parsed = JSON.parse(saved);

    return {
      ...initialState,
      ...parsed
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

  const contentType = response.headers.get("content-type") || "";
  let data = null;

  if (contentType.includes("application/json")) {
    data = await response.json();
  } else {
    const text = await response.text();

    try {
      data = JSON.parse(text);
    } catch {
      data = { message: text };
    }
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
  const paths = {
    arrowRight: (
      <>
        <path d="M4 12h15" />
        <path d="m13 6 6 6-6 6" />
      </>
    ),
    arrowLeft: (
      <>
        <path d="M20 12H5" />
        <path d="m11 18-6-6 6-6" />
      </>
    ),
    check: <path d="m5 12 4 4L19 6" />,
    plus: (
      <>
        <path d="M12 5v14" />
        <path d="M5 12h14" />
      </>
    ),
    close: (
      <>
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
      </>
    ),
    menu: (
      <>
        <path d="M4 7h16" />
        <path d="M4 12h16" />
        <path d="M4 17h16" />
      </>
    ),
    user: (
      <>
        <circle cx="12" cy="8" r="3.5" />
        <path d="M5 20c.8-3.5 3.2-5.5 7-5.5s6.2 2 7 5.5" />
      </>
    ),
    history: (
      <>
        <path d="M3 12a9 9 0 1 0 3-6.7" />
        <path d="M3 4v5h5" />
        <path d="M12 7v5l3 2" />
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
        <path d="m4 4 17 8-17 8 4-8-4-8Z" />
        <path d="M8 12h13" />
      </>
    ),
    spark: (
      <>
        <path d="M12 2 14 9l7 3-7 3-2 7-2-7-7-3 7-3 2-7Z" />
      </>
    ),
    shield: (
      <>
        <path d="M12 3 19 6v5c0 4.5-2.8 8-7 10-4.2-2-7-5.5-7-10V6l7-3Z" />
        <path d="m9 12 2 2 4-4" />
      </>
    ),
    document: (
      <>
        <path d="M6 3h8l4 4v14H6V3Z" />
        <path d="M14 3v5h4" />
        <path d="M9 12h6" />
        <path d="M9 16h6" />
      </>
    ),
    message: (
      <>
        <path d="M4 5h16v11H8l-4 4V5Z" />
      </>
    )
  };

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
    >
      {paths[name] || paths.spark}
    </svg>
  );
}

function Logo({ onClick }) {
  return (
    <button className="brand-button" onClick={onClick} aria-label="Go to Verlo home">
      <span className="brand-mark">
        <span />
        <span />
        <span />
      </span>
      <span className="brand-name">verlo</span>
    </button>
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
  onAuthenticated,
  setVerification
}) {
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  async function submit(event) {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint = mode === "login" ? "/api/auth/login" : "/api/auth/signup";

      const data = await api(endpoint, {
        method: "POST",
        body: JSON.stringify(
          mode === "login"
            ? { email, password }
            : { name, email, password }
        )
      });

      if (data?.verificationRequired || data?.requiresVerification) {
        setVerification({
          required: true,
          email: data.email || email
        });
        onClose();
        return;
      }

      onAuthenticated(data.user || data);
      onClose();
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function googleLogin() {
    try {
      const data = await api("/api/auth/google", {
        method: "POST"
      });

      if (data?.url) {
        window.location.href = data.url;
        return;
      }

      if (data?.user) {
        onAuthenticated(data.user);
        onClose();
      }
    } catch (requestError) {
      setError(requestError.message);
    }
  }

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="auth-modal"
        onMouseDown={event => event.stopPropagation()}
        role="dialog"
        aria-modal="true"
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>

        <div className="auth-heading">
          <span className="auth-icon">
            <Icon name="user" />
          </span>
          <h2>{mode === "login" ? "Welcome back." : "Create your account."}</h2>
          <p>
            {mode === "login"
              ? "Continue where you left off."
              : "Save assessments and return to them whenever you need."}
          </p>
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
              autoComplete={mode === "login" ? "current-password" : "new-password"}
              required
              minLength={6}
            />
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="primary-button auth-submit" disabled={loading}>
            {loading ? <LoadingDots /> : mode === "login" ? "Sign in" : "Create account"}
          </button>
        </form>

        <div className="auth-divider">
          <span>or</span>
        </div>

        <button className="google-button" onClick={googleLogin}>
          Continue with Google
        </button>

        <button
          className="auth-switch"
          onClick={() => {
            setError("");
            setMode(mode === "login" ? "signup" : "login");
          }}
        >
          {mode === "login"
            ? "Need an account? Create one"
            : "Already have an account? Sign in"}
        </button>
      </div>
    </div>
  );
}

function VerificationModal({ email, onClose }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  async function verify(event) {
    event.preventDefault();
    setLoading(true);
    setError("");
    setMessage("");

    try {
      await api("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({
          email,
          code
        })
      });

      setMessage("Your email has been verified. You can sign in now.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function resend() {
    setResending(true);
    setError("");
    setMessage("");

    try {
      await api("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email })
      });

      setMessage("A new verification code has been sent.");
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setResending(false);
    }
  }

  return (
    <div className="modal-backdrop">
      <div className="verification-modal">
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>

        <div className="verification-icon">
          <Icon name="shield" size={28} />
        </div>

        <h2>Verify your email.</h2>
        <p>
          Enter the verification code sent to <strong>{email}</strong>.
        </p>

        <form onSubmit={verify}>
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

          <button className="primary-button" disabled={loading}>
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

function Home({ onStart, onHistory, onAccount }) {
  return (
    <main className="home-page">
      <header className="site-header">
        <Logo onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })} />

        <nav className="site-nav">
          <button className="history-nav-button" onClick={onHistory}>
            <Icon name="history" size={17} />
            History
          </button>

          <button className="account-button" onClick={onAccount}>
            <Icon name="user" size={17} />
            Account
          </button>

          <button className="header-cta" onClick={onStart}>
            Start assessment
            <Icon name="arrowRight" size={17} />
          </button>
        </nav>
      </header>

      <section className="hero-section">
        <div className="hero-content">
          <span className="eyebrow">DECISION SUPPORT, REFINED</span>

          <h1>
            Make sense of
            <br />
            <em>what comes next.</em>
          </h1>

          <p className="hero-description">
            Verlo turns complicated situations into clear questions, useful
            context and practical next steps.
          </p>

          <div className="hero-actions">
            <button className="hero-button" onClick={onStart}>
              Start with your situation
              <Icon name="arrowRight" size={18} />
            </button>

            <button className="secondary-button" onClick={onHistory}>
              View history
            </button>
          </div>

          <p className="hero-note">
            Your situation stays focused on the decision you are making.
          </p>
        </div>

        <div className="hero-visual" aria-hidden="true">
          <div className="hero-orbit orbit-one" />
          <div className="hero-orbit orbit-two" />
          <div className="hero-orbit orbit-three" />

          <div className="hero-core">
            <span className="hero-core-dot" />
            <span className="hero-core-line line-one" />
            <span className="hero-core-line line-two" />
            <span className="hero-core-line line-three" />
          </div>

          <div className="floating-card card-one">
            <span>01</span>
            Understand
          </div>

          <div className="floating-card card-two">
            <span>02</span>
            Clarify
          </div>

          <div className="floating-card card-three">
            <span>03</span>
            Decide
          </div>
        </div>
      </section>

      <section className="feature-section">
        <div className="section-heading">
          <span className="eyebrow">HOW IT WORKS</span>
          <h2>A calmer way to work through complexity.</h2>
        </div>

        <div className="feature-grid">
          <article className="feature-card">
            <div className="feature-icon">
              <Icon name="message" />
            </div>
            <span className="feature-number">01</span>
            <h3>Start with the situation</h3>
            <p>
              Explain what is happening in your own words. You do not need to
              know exactly what you need yet.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">
              <Icon name="spark" />
            </div>
            <span className="feature-number">02</span>
            <h3>Answer adaptive questions</h3>
            <p>
              The assessment responds to what you tell it instead of forcing
              every situation through the same checklist.
            </p>
          </article>

          <article className="feature-card">
            <div className="feature-icon">
              <Icon name="document" />
            </div>
            <span className="feature-number">03</span>
            <h3>Receive a clear report</h3>
            <p>
              Get the relevant context, considerations and practical next
              steps organised into one readable report.
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

  function removeFile(index) {
    setAttachments(previous => previous.filter((_, i) => i !== index));
  }

  return (
    <main className="assessment-page">
      <header className="assessment-header">
        <Logo onClick={onBack} />
        <span className="assessment-step">01 / 02</span>
      </header>

      <section className="assessment-main">
        <div className="assessment-intro">
          <span className="eyebrow">YOUR SITUATION</span>
          <h1>Tell us what is happening.</h1>
          <p>
            Give Verlo enough context to understand what you are trying to
            work through. There is no need to make it perfect.
          </p>
        </div>

        <div className="input-panel">
          <label className="large-label" htmlFor="situation">
            What are you deciding or unsure about?
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
            {[
              "Travel",
              "Education",
              "Work",
              "Money",
              "Health",
              "Relationships",
              "Other"
            ].map(item => (
              <button
                key={item}
                className={category === item ? "category selected" : "category"}
                onClick={() => setCategory(item)}
              >
                {item}
              </button>
            ))}
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
                {attachments.map((file, index) => (
                  <div className="attachment-item" key={`${file.name}-${index}`}>
                    <span>{file.name}</span>
                    <button
                      onClick={() => removeFile(index)}
                      aria-label={`Remove ${file.name}`}
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="input-footer">
            <span>
              {category || "Choose a category"} · {situation.length} characters
            </span>

            <button
              className="continue-button"
              disabled={!situation.trim() || loading}
              onClick={onContinue}
            >
              {loading ? <LoadingDots /> : "Continue"}
              {!loading && <Icon name="arrowRight" size={18} />}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function normalizeQuestion(raw, index) {
  if (!raw) return null;

  const question =
    typeof raw === "string"
      ? { text: raw }
      : {
          ...raw,
          text:
            raw.text ||
            raw.question ||
            raw.questionText ||
            raw.prompt ||
            ""
        };

  const options =
    question.options ||
    question.choices ||
    question.answers ||
    [];

  const text = String(question.text || "").trim();

  const explicitMultiline =
    question.multiline === true ||
    question.multiLine === true ||
    question.inputType === "textarea" ||
    question.answerType === "long_text" ||
    question.type === "long_text";

  const explicitSingleLine =
    question.multiline === false ||
    question.multiLine === false ||
    question.inputType === "text" ||
    question.answerType === "short_text";

  const looksLikeChoice =
    Array.isArray(options) && options.length > 0;

  const longAnswerPattern =
    /describe|explain|tell us about|provide details|what happened|anything else|additional information|in your own words/i;

  const multiline =
    explicitMultiline ||
    (!explicitSingleLine &&
      !looksLikeChoice &&
      longAnswerPattern.test(text));

  const normalizedOptions = Array.isArray(options)
    ? options.map(option =>
        typeof option === "string"
          ? { label: option, value: option }
          : {
              label:
                option.label ||
                option.text ||
                option.name ||
                option.value ||
                "",
              value:
                option.value ||
                option.label ||
                option.text ||
                ""
            }
      )
    : [];

  return {
    ...question,
    id: question.id || `question-${index + 1}`,
    text,
    options: normalizedOptions,
    multiline,
    required: question.required !== false,
    placeholder:
      question.placeholder ||
      (multiline
        ? "Type your answer here..."
        : "Type your answer and press Enter...")
  };
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
  onBack,
  loading,
  setLoading,
  error,
  setError
}) {
  const currentQuestion = questions[questionIndex];
  const normalizedQuestion = normalizeQuestion(
    currentQuestion,
    questionIndex
  );

  const existingAnswer = answers.find(
    answer => answer.questionId === normalizedQuestion?.id
  );

  const [value, setValue] = useState(existingAnswer?.answer || "");
  const [selectedOption, setSelectedOption] = useState(
    existingAnswer?.answer || ""
  );

  useEffect(() => {
    const answer = answers.find(
      item => item.questionId === normalizedQuestion?.id
    );

    setValue(answer?.answer || "");
    setSelectedOption(answer?.answer || "");
  }, [normalizedQuestion?.id, answers]);

  const progress = Math.min(
    100,
    Math.round(
      ((questionIndex + 1) / Math.max(questions.length, MAX_ADAPTIVE_QUESTIONS)) *
        100
    )
  );

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
          previousQuestions: questions,
          attachments
        })
      });

      const completed =
        data?.complete ||
        data?.done ||
        data?.finished ||
        data?.shouldAnalyze;

      if (completed || !data?.question && !data?.questions?.[0] && !data?.questionText) {
        await onComplete(nextAnswers);
        return;
      }

      const nextRaw =
        data.question ||
        data.questions?.[0] ||
        data.questionText;

      const nextQuestion = normalizeQuestion(
        nextRaw,
        questions.length
      );

      if (!nextQuestion?.text) {
        await onComplete(nextAnswers);
        return;
      }

      setQuestions(previous => [...previous, nextQuestion]);
      setQuestionIndex(previous => previous + 1);
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function saveAnswerAndContinue(answerValue, skipped = false) {
    if (loading || !normalizedQuestion) return;

    const cleaned =
      typeof answerValue === "string"
        ? answerValue.trim()
        : answerValue;

    if (!skipped && normalizedQuestion.required && !cleaned) {
      setError("Please enter an answer or choose Skip.");
      return;
    }

    const answerObject = {
      questionId: normalizedQuestion.id,
      question: normalizedQuestion.text,
      answer: skipped ? "" : cleaned,
      skipped
    };

    const filtered = answers.filter(
      answer => answer.questionId !== normalizedQuestion.id
    );

    const nextAnswers = [...filtered, answerObject];

    setAnswers(nextAnswers);

    if (questionIndex >= MAX_ADAPTIVE_QUESTIONS - 1) {
      await onComplete(nextAnswers);
      return;
    }

    await requestNextQuestion(nextAnswers);
  }

  function handleKeyDown(event) {
    if (event.key !== "Enter") return;

    if (normalizedQuestion.multiline) {
      if (event.metaKey || event.ctrlKey) {
        event.preventDefault();
        saveAnswerAndContinue(value);
      }
      return;
    }

    event.preventDefault();

    if (!loading) {
      saveAnswerAndContinue(
        normalizedQuestion.options.length > 0
          ? selectedOption
          : value
      );
    }
  }

  if (!normalizedQuestion) {
    return (
      <main className="assessment-page adaptive-page">
        <div className="adaptive-empty">
          <LoadingDots />
          <p>Preparing your first question...</p>
        </div>
      </main>
    );
  }

  return (
    <main className="assessment-page adaptive-page">
      <header className="assessment-header">
        <button className="back-button" onClick={onBack} disabled={loading}>
          <Icon name="arrowLeft" size={17} />
          Back
        </button>

        <Logo onClick={onBack} />

        <span className="assessment-step">
          {String(questionIndex + 1).padStart(2, "0")} /{" "}
          {String(Math.min(MAX_ADAPTIVE_QUESTIONS, Math.max(questions.length, 1))).padStart(2, "0")}
        </span>
      </header>

      <section className="adaptive-main">
        <div className="assessment-progress">
          <div className="assessment-progress-label">
            <span>Adaptive assessment</span>
            <span>{progress}%</span>
          </div>
          <div className="progress-track">
            <div
              className="progress-value"
              style={{ width: `${progress}%` }}
            />
          </div>
        </div>

        <div className="question-card">
          <div className="question-meta">
            <span>QUESTION {String(questionIndex + 1).padStart(2, "0")}</span>
            {normalizedQuestion.multiline ? (
              <span>DETAILED RESPONSE</span>
            ) : (
              <span>SHORT RESPONSE</span>
            )}
          </div>

          <h1>{normalizedQuestion.text}</h1>

          {normalizedQuestion.description && (
            <p className="question-description">
              {normalizedQuestion.description}
            </p>
          )}

          {normalizedQuestion.image && (
            <div className="question-image">
              <img
                src={normalizedQuestion.image}
                alt=""
              />
            </div>
          )}

          {normalizedQuestion.options.length > 0 ? (
            <div className="choice-list">
              {normalizedQuestion.options.map(option => (
                <button
                  key={`${normalizedQuestion.id}-${option.value}`}
                  className={
                    selectedOption === option.value
                      ? "choice-option selected"
                      : "choice-option"
                  }
                  onClick={() => setSelectedOption(option.value)}
                  disabled={loading}
                >
                  <span className="choice-radio">
                    {selectedOption === option.value && <span />}
                  </span>
                  <span>{option.label}</span>
                </button>
              ))}
            </div>
          ) : normalizedQuestion.multiline ? (
            <div className="adaptive-textarea-shell multiline">
              <textarea
                value={value}
                onChange={event => setValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={normalizedQuestion.placeholder}
                rows={7}
                maxLength={4000}
                disabled={loading}
              />

              <div className="adaptive-textarea-count">
                <span>Ctrl/Cmd + Enter to continue</span>
                <span>{value.length}/4000</span>
              </div>
            </div>
          ) : (
            <div className="adaptive-input-shell">
              <input
                value={value}
                onChange={event => setValue(event.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={normalizedQuestion.placeholder}
                maxLength={1000}
                disabled={loading}
                autoFocus
              />

              <span className="input-enter-hint">
                Enter ↵
              </span>
            </div>
          )}

          {error && <div className="assessment-error">{error}</div>}

          <div className="question-footer">
            <button
              className="skip-button"
              onClick={() => saveAnswerAndContinue("", true)}
              disabled={loading}
            >
              Skip
            </button>

            <button
              className="continue-button"
              onClick={() =>
                saveAnswerAndContinue(
                  normalizedQuestion.options.length > 0
                    ? selectedOption
                    : value
                )
              }
              disabled={
                loading ||
                (normalizedQuestion.required &&
                  !(
                    normalizedQuestion.options.length > 0
                      ? selectedOption
                      : value.trim()
                  ))
              }
            >
              {loading ? <LoadingDots /> : "Continue"}
              {!loading && <Icon name="arrowRight" size={18} />}
            </button>
          </div>
        </div>
      </section>
    </main>
  );
}

function Processing({ percent }) {
  return (
    <main className="assessment-page processing-page">
      <div className="processing-inner">
        <div className="processing-orb">
          <div />
        </div>

        <span className="eyebrow">ANALYSING YOUR SITUATION</span>

        <h1>Putting the pieces together.</h1>

        <p>
          Verlo is organising your answers into a clear, useful report.
        </p>

        <div className="processing-percent">{percent}%</div>

        <div className="processing-track">
          <div style={{ width: `${percent}%` }} />
        </div>
      </div>
    </main>
  );
}

function escapeHtml(value) {
  return String(value)
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

function inlineMarkdown(value) {
  let text = escapeHtml(value);

  text = text.replace(
    /\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)/g,
    '<a href="$2" target="_blank" rel="noreferrer">$1</a>'
  );

  text = text.replace(
    /`([^`]+)`/g,
    "<code>$1</code>"
  );

  text = text.replace(
    /\*\*([^*]+)\*\*/g,
    "<strong>$1</strong>"
  );

  text = text.replace(
    /__([^_]+)__/g,
    "<strong>$1</strong>"
  );

  text = text.replace(
    /(?<!\*)\*([^*]+)\*(?!\*)/g,
    "<em>$1</em>"
  );

  return text;
}

function markdownToHtml(markdown) {
  if (markdown === null || markdown === undefined) return "";

  const source = String(markdown)
    .replace(/\r\n/g, "\n")
    .replace(/\r/g, "\n")
    .trim();

  if (!source) return "";

  const lines = source.split("\n");
  const output = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (/^```/.test(line.trim())) {
      const language = line.trim().slice(3).trim();
      const codeLines = [];
      index += 1;

      while (
        index < lines.length &&
        !/^```/.test(lines[index].trim())
      ) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (index < lines.length) index += 1;

      output.push(
        `<pre class="markdown-code"><code class="language-${escapeHtml(
          language
        )}">${escapeHtml(codeLines.join("\n"))}</code></pre>`
      );

      continue;
    }

    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/.test(
        lines[index + 1]
      )
    ) {
      const headerCells = line
        .trim()
        .replace(/^\|/, "")
        .replace(/\|$/, "")
        .split("|")
        .map(cell => cell.trim());

      index += 2;

      const rows = [];

      while (
        index < lines.length &&
        lines[index].includes("|") &&
        lines[index].trim()
      ) {
        rows.push(
          lines[index]
            .trim()
            .replace(/^\|/, "")
            .replace(/\|$/, "")
            .split("|")
            .map(cell => cell.trim())
        );

        index += 1;
      }

      output.push(`
        <div class="markdown-table-wrap">
          <table class="markdown-table">
            <thead>
              <tr>
                ${headerCells.map(cell => `<th>${inlineMarkdown(cell)}</th>`).join("")}
              </tr>
            </thead>
            <tbody>
              ${rows
                .map(
                  row => `
                    <tr>
                      ${headerCells
                        .map(
                          (_, cellIndex) =>
                            `<td>${inlineMarkdown(row[cellIndex] || "")}</td>`
                        )
                        .join("")}
                    </tr>
                  `
                )
                .join("")}
            </tbody>
          </table>
        </div>
      `);

      continue;
    }

    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      const level = headingMatch[1].length;

      output.push(
        `<h${level}>${inlineMarkdown(headingMatch[2])}</h${level}>`
      );

      index += 1;
      continue;
    }

    if (/^\s*[-*]\s+/.test(line)) {
      const items = [];

      while (
        index < lines.length &&
        /^\s*[-*]\s+/.test(lines[index])
      ) {
        items.push(
          lines[index]
            .replace(/^\s*[-*]\s+/, "")
            .trim()
        );

        index += 1;
      }

      output.push(
        `<ul>${items
          .map(item => `<li>${inlineMarkdown(item)}</li>`)
          .join("")}</ul>`
      );

      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];

      while (
        index < lines.length &&
        /^\s*\d+\.\s+/.test(lines[index])
      ) {
        items.push(
          lines[index]
            .replace(/^\s*\d+\.\s+/, "")
            .trim()
        );

        index += 1;
      }

      output.push(
        `<ol>${items
          .map(item => `<li>${inlineMarkdown(item)}</li>`)
          .join("")}</ol>`
      );

      continue;
    }

    if (line.trim().startsWith(">")) {
      const quoteLines = [];

      while (
        index < lines.length &&
        lines[index].trim().startsWith(">")
      ) {
        quoteLines.push(
          lines[index].trim().replace(/^>\s?/, "")
        );
        index += 1;
      }

      output.push(
        `<blockquote>${quoteLines
          .map(item => `<p>${inlineMarkdown(item)}</p>`)
          .join("")}</blockquote>`
      );

      continue;
    }

    const paragraph = [line.trim()];
    index += 1;

    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^(#{1,6})\s+/.test(lines[index]) &&
      !/^\s*[-*]\s+/.test(lines[index]) &&
      !/^\s*\d+\.\s+/.test(lines[index]) &&
      !lines[index].includes("|") &&
      !lines[index].trim().startsWith(">")
    ) {
      paragraph.push(lines[index].trim());
      index += 1;
    }

    output.push(`<p>${inlineMarkdown(paragraph.join(" "))}</p>`);
  }

  return output.join("");
}

function Markdown({ children, className = "" }) {
  const html = useMemo(
    () => markdownToHtml(children),
    [children]
  );

  return (
    <div
      className={`markdown-content ${className}`}
      dangerouslySetInnerHTML={{ __html: html }}
    />
  );
}

function getResultValue(result, keys, fallback = "") {
  if (!result || typeof result !== "object") return fallback;

  for (const key of keys) {
    const value = result[key];

    if (value !== undefined && value !== null && value !== "") {
      return value;
    }
  }

  return fallback;
}

function ResultSection({ icon, title, children }) {
  return (
    <section className="report-section">
      <div className="report-section-heading">
        <span className="report-heading-icon">
          <Icon name={icon} size={18} />
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
  onNewAssessment,
  onHistory,
  onAccount
}) {
  const [chatMessages, setChatMessages] = useState([]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef(null);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }, [chatMessages, chatLoading]);

  const title = getResultValue(
    result,
    ["title", "heading", "summaryTitle"],
    "Your decision report"
  );

  const summary = getResultValue(
    result,
    ["summary", "overview", "executiveSummary", "introduction"],
    ""
  );

  const context = getResultValue(
    result,
    ["context", "background", "situation"],
    situation
  );

  const considerations = getResultValue(
    result,
    ["considerations", "keyConsiderations", "risks", "factors"],
    []
  );

  const nextSteps = getResultValue(
    result,
    ["nextSteps", "actions", "recommendations", "steps"],
    []
  );

  const draft = getResultValue(
    result,
    ["draft", "suggestedDraft", "template", "messageDraft"],
    ""
  );

  const resources = getResultValue(
    result,
    ["resources", "usefulResources"],
    []
  );

  const references = getResultValue(
    result,
    ["references", "sources", "citations"],
    []
  );

  const markdownReport = getResultValue(
    result,
    ["markdown", "reportMarkdown", "report"],
    ""
  );

  const displayConsiderations = Array.isArray(considerations)
    ? considerations
    : considerations
      ? [considerations]
      : [];

  const displayNextSteps = Array.isArray(nextSteps)
    ? nextSteps
    : nextSteps
      ? [nextSteps]
      : [];

  const displayResources = Array.isArray(resources)
    ? resources
    : resources
      ? [resources]
      : [];

  const displayReferences = Array.isArray(references)
    ? references
    : references
      ? [references]
      : [];

  async function sendChat(event) {
    event.preventDefault();

    const message = chatInput.trim();

    if (!message || chatLoading) return;

    const nextMessages = [
      ...chatMessages,
      {
        role: "user",
        content: message
      }
    ];

    setChatMessages(nextMessages);
    setChatInput("");
    setChatLoading(true);

    try {
      const data = await api("/api/chat", {
        method: "POST",
        body: JSON.stringify({
          message,
          situation,
          result,
          history: nextMessages
        })
      });

      const responseText =
        data?.message ||
        data?.response ||
        data?.answer ||
        data?.content ||
        data?.text ||
        "";

      setChatMessages(previous => [
        ...previous,
        {
          role: "assistant",
          content:
            responseText ||
            "I couldn't generate a response for that question. Please try again."
        }
      ]);
    } catch (requestError) {
      setChatMessages(previous => [
        ...previous,
        {
          role: "assistant",
          content: `I couldn't complete that response. ${requestError.message}`
        }
      ]);
    } finally {
      setChatLoading(false);
    }
  }

  return (
    <main className="report-page">
      <header className="site-header report-header">
        <Logo onClick={onNewAssessment} />

        <nav className="site-nav">
          <button className="history-nav-button" onClick={onHistory}>
            <Icon name="history" size={17} />
            History
          </button>

          <button className="account-button" onClick={onAccount}>
            <Icon name="user" size={17} />
            Account
          </button>

          <button className="header-cta" onClick={onNewAssessment}>
            New assessment
            <Icon name="plus" size={17} />
          </button>
        </nav>
      </header>

      <div className="report-container">
        <section className="report-hero">
          <div className="report-hero-copy">
            <span className="eyebrow">YOUR REPORT</span>
            <h1>{title}</h1>

            {summary && <Markdown>{summary}</Markdown>}
          </div>

          <div className="report-context">
            <span>ORIGINAL SITUATION</span>
            <p>{context}</p>
          </div>
        </section>

        {markdownReport && (
          <ResultSection icon="document" title="Full report">
            <Markdown>{markdownReport}</Markdown>
          </ResultSection>
        )}

        {displayConsiderations.length > 0 && (
          <ResultSection icon="shield" title="Things to consider">
            <div className="consideration-list">
              {displayConsiderations.map((item, index) => {
                const text =
                  typeof item === "string"
                    ? item
                    : item?.text ||
                      item?.description ||
                      item?.title ||
                      JSON.stringify(item);

                return (
                  <div className="consideration" key={index}>
                    <span>{String(index + 1).padStart(2, "0")}</span>
                    <Markdown>{text}</Markdown>
                  </div>
                );
              })}
            </div>
          </ResultSection>
        )}

        {displayNextSteps.length > 0 && (
          <ResultSection icon="arrowRight" title="Suggested next steps">
            <div className="next-step-list">
              {displayNextSteps.map((item, index) => {
                const text =
                  typeof item === "string"
                    ? item
                    : item?.text ||
                      item?.description ||
                      item?.title ||
                      JSON.stringify(item);

                return (
                  <div className="next-step" key={index}>
                    <span>{index + 1}</span>
                    <Markdown>{text}</Markdown>
                  </div>
                );
              })}
            </div>
          </ResultSection>
        )}

        {draft && (
          <ResultSection icon="message" title="Useful draft">
            <div className="draft-box">
              <Markdown>{draft}</Markdown>
            </div>
          </ResultSection>
        )}

        {displayResources.length > 0 && (
          <ResultSection icon="document" title="Resources">
            <div className="resource-grid">
              {displayResources.map((resource, index) => {
                const item =
                  typeof resource === "string"
                    ? { title: resource }
                    : resource;

                return (
                  <div className="resource-card" key={index}>
                    <h3>
                      {item?.title ||
                        item?.name ||
                        `Resource ${index + 1}`}
                    </h3>

                    {(item?.description || item?.text) && (
                      <Markdown>
                        {item.description || item.text}
                      </Markdown>
                    )}

                    {item?.url && (
                      <a
                        href={item.url}
                        target="_blank"
                        rel="noreferrer"
                      >
                        Open resource
                        <Icon name="arrowRight" size={15} />
                      </a>
                    )}
                  </div>
                );
              })}
            </div>
          </ResultSection>
        )}

        {displayReferences.length > 0 && (
          <ResultSection icon="document" title="References">
            <div className="reference-list">
              {displayReferences.map((reference, index) => {
                const item =
                  typeof reference === "string"
                    ? { text: reference }
                    : reference;

                return (
                  <div className="reference-row" key={index}>
                    <span>{index + 1}</span>
                    <div>
                      <Markdown>
                        {item?.text ||
                          item?.title ||
                          item?.name ||
                          JSON.stringify(item)}
                      </Markdown>

                      {item?.url && (
                        <a
                          href={item.url}
                          target="_blank"
                          rel="noreferrer"
                        >
                          {item.url}
                        </a>
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
              <span className="eyebrow">KEEP EXPLORING</span>
              <h2>Have a question about your report?</h2>
            </div>

            <span className="chat-status">
              <span />
              Ready
            </span>
          </div>

          <div className="chat-window">
            {chatMessages.length === 0 ? (
              <div className="chat-empty">
                <Icon name="message" size={25} />
                <p>
                  Ask a follow-up question and Verlo will use this report as
                  context.
                </p>
              </div>
            ) : (
              chatMessages.map((message, index) => (
                <div
                  className={
                    message.role === "user"
                      ? "chat-message user-message"
                      : "chat-message assistant-message"
                  }
                  key={`${message.role}-${index}`}
                >
                  <span className="chat-role">
                    {message.role === "user" ? "YOU" : "VERLO"}
                  </span>

                  <Markdown>{message.content}</Markdown>
                </div>
              ))
            )}

            {chatLoading && (
              <div className="chat-message assistant-message">
                <span className="chat-role">VERLO</span>
                <LoadingDots />
              </div>
            )}

            <div ref={chatEndRef} />
          </div>

          <form className="chat-input" onSubmit={sendChat}>
            <input
              value={chatInput}
              onChange={event => setChatInput(event.target.value)}
              placeholder="Ask something about your report..."
              disabled={chatLoading}
              aria-label="Ask a question about your report"
            />

            <button
              type="submit"
              disabled={!chatInput.trim() || chatLoading}
              aria-label="Send message"
            >
              <Icon name="send" size={18} />
            </button>
          </form>
        </section>

        <div className="report-actions">
          <button className="secondary-button" onClick={onHistory}>
            View history
          </button>

          <button className="hero-button" onClick={onNewAssessment}>
            Start another assessment
            <Icon name="arrowRight" size={18} />
          </button>
        </div>
      </div>
    </main>
  );
}

function HistoryPanel({ onClose, onOpen }) {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;

    api("/api/history")
      .then(data => {
        if (!active) return;

        setHistory(
          data?.history ||
            data?.items ||
            data?.assessments ||
            []
        );
      })
      .catch(() => {
        if (active) setHistory([]);
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, []);

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="history-modal"
        onMouseDown={event => event.stopPropagation()}
      >
        <button className="modal-close" onClick={onClose} aria-label="Close">
          <Icon name="close" />
        </button>

        <div className="history-heading">
          <span className="eyebrow">YOUR HISTORY</span>
          <h2>Previous assessments</h2>
        </div>

        {loading ? (
          <div className="history-loading">
            <LoadingDots />
          </div>
        ) : history.length === 0 ? (
          <div className="history-empty">
            <Icon name="document" size={28} />
            <p>No saved assessments yet.</p>
          </div>
        ) : (
          <div className="history-list">
            {history.map((item, index) => {
              const title =
                item.title ||
                item.name ||
                item.situation ||
                "Untitled assessment";

              const date =
                item.createdAt ||
                item.created_at ||
                item.date ||
                "";

              return (
                <button
                  className="history-item"
                  key={item.id || index}
                  onClick={() => onOpen(item)}
                >
                  <div>
                    <span>{date ? new Date(date).toLocaleDateString() : "Saved assessment"}</span>
                    <h3>{title}</h3>
                  </div>

                  <Icon name="arrowRight" size={18} />
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
  const [authUser, setAuthUser] = useState(null);
  const [authMode, setAuthMode] = useState(null);
  const [verification, setVerification] = useState({
    required: false,
    email: ""
  });
  const [historyOpen, setHistoryOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [processingPercent, setProcessingPercent] = useState(12);

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }, [state]);

  useEffect(() => {
    api("/api/auth/me")
      .then(data => {
        if (data?.user) setAuthUser(data.user);
      })
      .catch(() => {});
  }, []);

  function updateState(updates) {
    setState(previous => ({
      ...previous,
      ...updates
    }));
  }

  function resetAssessment() {
    setState({
      ...initialState,
      screen: "input"
    });
    setError("");
  }

  async function startAssessment() {
    if (!state.situation.trim()) return;

    setLoading(true);
    setError("");

    try {
      const data = await api("/api/adaptive-question", {
        method: "POST",
        body: JSON.stringify({
          situation: state.situation,
          category: state.category,
          answers: [],
          questionIndex: 0,
          previousQuestions: [],
          attachments: state.attachments
        })
      });

      const firstRaw =
        data?.question ||
        data?.questions?.[0] ||
        data?.questionText;

      const firstQuestion = normalizeQuestion(firstRaw, 0);

      if (!firstQuestion?.text) {
        throw new Error(
          "Adaptive engine failed to create the first question."
        );
      }

      updateState({
        screen: "adaptive",
        questions: [firstQuestion],
        answers: [],
        questionIndex: 0
      });
    } catch (requestError) {
      setError(requestError.message);
    } finally {
      setLoading(false);
    }
  }

  async function runAnalysis(finalAnswers) {
    setState(previous => ({
      ...previous,
      screen: "processing",
      answers: finalAnswers
    }));

    setProcessingPercent(10);

    const interval = setInterval(() => {
      setProcessingPercent(previous =>
        Math.min(previous + Math.floor(Math.random() * 12) + 5, 92)
      );
    }, 500);

    try {
      const data = await api("/api/analyze", {
        method: "POST",
        body: JSON.stringify({
          situation: state.situation,
          category: state.category,
          answers: finalAnswers,
          questions: state.questions,
          attachments: state.attachments
        })
      });

      clearInterval(interval);
      setProcessingPercent(100);

      await new Promise(resolve => setTimeout(resolve, 350));

      updateState({
        screen: "results",
        result: data?.result || data?.report || data
      });
    } catch (requestError) {
      clearInterval(interval);
      setError(requestError.message);
      updateState({
        screen: "adaptive"
      });
    }
  }

  function openHistoryItem(item) {
    const restoredResult =
      item.result ||
      item.report ||
      item.data ||
      null;

    updateState({
      screen: restoredResult ? "results" : "input",
      situation:
        item.situation ||
        item.context ||
        state.situation,
      category:
        item.category ||
        state.category,
      result: restoredResult
    });

    setHistoryOpen(false);
  }

  async function logout() {
    try {
      await api("/api/auth/logout", {
        method: "POST"
      });
    } catch {}

    setAuthUser(null);
  }

  function accountAction() {
    if (authUser) {
      logout();
    } else {
      setAuthMode("login");
    }
  }

  return (
    <>
      {state.screen === "home" && (
        <Home
          onStart={() => updateState({ screen: "input" })}
          onHistory={() => setHistoryOpen(true)}
          onAccount={accountAction}
        />
      )}

      {state.screen === "input" && (
        <InputPage
          situation={state.situation}
          setSituation={value => updateState({ situation: value })}
          category={state.category}
          setCategory={value => updateState({ category: value })}
          attachments={state.attachments}
          setAttachments={value => updateState({ attachments: value })}
          onBack={() => updateState({ screen: "home" })}
          onContinue={startAssessment}
          loading={loading}
        />
      )}

      {state.screen === "adaptive" && (
        <AdaptiveAssessment
          situation={state.situation}
          category={state.category}
          attachments={state.attachments}
          questions={state.questions}
          setQuestions={value => updateState({
            questions:
              typeof value === "function"
                ? value(state.questions)
                : value
          })}
          answers={state.answers}
          setAnswers={value => updateState({
            answers:
              typeof value === "function"
                ? value(state.answers)
                : value
          })}
          questionIndex={state.questionIndex}
          setQuestionIndex={value => updateState({
            questionIndex:
              typeof value === "function"
                ? value(state.questionIndex)
                : value
          })}
          onComplete={runAnalysis}
          onBack={() => updateState({ screen: "input" })}
          loading={loading}
          setLoading={setLoading}
          error={error}
          setError={setError}
        />
      )}

      {state.screen === "processing" && (
        <Processing percent={processingPercent} />
      )}

      {state.screen === "results" && (
        <Results
          result={state.result}
          situation={state.situation}
          onNewAssessment={resetAssessment}
          onHistory={() => setHistoryOpen(true)}
          onAccount={accountAction}
        />
      )}

      {error && state.screen !== "adaptive" && (
        <div className="global-error" role="alert">
          <span>{error}</span>
          <button onClick={() => setError("")}>
            <Icon name="close" size={15} />
          </button>
        </div>
      )}

      {authMode && (
        <AuthModal
          mode={authMode}
          setMode={setAuthMode}
          onClose={() => setAuthMode(null)}
          onAuthenticated={user => setAuthUser(user)}
          setVerification={setVerification}
        />
      )}

      {verification.required && (
        <VerificationModal
          email={verification.email}
          onClose={() =>
            setVerification({
              required: false,
              email: ""
            })
          }
        />
      )}

      {historyOpen && (
        <HistoryPanel
          onClose={() => setHistoryOpen(false)}
          onOpen={openHistoryItem}
        />
      )}
    </>
  );
}