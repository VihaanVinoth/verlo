import { useEffect, useMemo, useRef, useState } from "react";
import "./style.css";

const API_URL =
  import.meta.env.VITE_API_URL || "https://verlo-30xs.onrender.com";

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
      ...parsed
    };
  } catch {
    return initialState;
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

function Icon({ name, size = 20 }) {
  const common = {
    width: size,
    height: size,
    viewBox: "0 0 24 24",
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.8,
    strokeLinecap: "round",
    strokeLinejoin: "round",
    "aria-hidden": true,
    focusable: "false"
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
        <path d="M6 6l12 12" />
        <path d="M18 6 6 18" />
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
        <path d="M5 20c.8-3.3 3.1-5 7-5s6.2 1.7 7 5" />
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
    send: (
      <>
        <path d="m4 4 16 8-16 8 3-8-3-8Z" />
        <path d="M7 12h13" />
      </>
    ),
    lock: (
      <>
        <rect x="5" y="10" width="14" height="10" rx="2" />
        <path d="M8 10V7a4 4 0 0 1 8 0v3" />
      </>
    ),
    mail: (
      <>
        <rect x="3" y="5" width="18" height="14" rx="2" />
        <path d="m4 7 8 6 8-6" />
      </>
    ),
    google: (
      <>
        <path d="M21 12.2c0-.7-.1-1.4-.2-2H12v3.8h5a4.3 4.3 0 0 1-1.9 2.8v2.3h3.1c1.8-1.7 2.8-4.1 2.8-6.9Z" />
        <path d="M12 21c2.6 0 4.8-.9 6.4-2.4l-3.1-2.3c-.9.6-2 1-3.3 1-2.5 0-4.7-1.7-5.4-4H3.4v2.4A9.7 9.7 0 0 0 12 21Z" />
        <path d="M6.6 13.3a5.8 5.8 0 0 1 0-2.6V8.3H3.4a9 9 0 0 0 0 8.1l3.2-3.1Z" />
        <path d="M12 6.7c1.5 0 2.8.5 3.8 1.5l2.8-2.8C16.8 3.9 14.6 3 12 3a9.7 9.7 0 0 0-8.6 5.3l3.2 2.4c.7-2.3 2.9-4 5.4-4Z" />
      </>
    ),
    spark: (
      <>
        <path d="m12 2 1.7 6.3L20 10l-6.3 1.7L12 18l-1.7-6.3L4 10l6.3-1.7L12 2Z" />
        <path d="m19 15 .7 2.3L22 18l-2.3.7L19 21l-.7-2.3L16 18l2.3-.7L19 15Z" />
      </>
    ),
    paperclip: (
      <path d="m20 11.5-8.3 8.3a5 5 0 0 1-7.1-7.1l8.5-8.5a3.5 3.5 0 0 1 5 5l-8.5 8.5a2 2 0 0 1-2.8-2.8l7.9-7.9" />
    ),
    skip: (
      <>
        <path d="M6 5v14l10-7L6 5Z" />
        <path d="M19 5v14" />
      </>
    ),
    warning: (
      <>
        <path d="M12 3 2.8 20h18.4L12 3Z" />
        <path d="M12 9v4" />
        <path d="M12 17h.01" />
      </>
    ),
    external: (
      <>
        <path d="M14 5h5v5" />
        <path d="m19 5-8 8" />
        <path d="M19 13v5a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V6a1 1 0 0 1 1-1h5" />
      </>
    )
  };

  return <svg {...common}>{paths[name] || paths.spark}</svg>;
}

function Logo({ onClick }) {
  return (
    <button className="brand-button" onClick={onClick} type="button">
      <span className="brand-mark">
        <Icon name="spark" size={18} />
      </span>
      <span className="brand-name">VERLO</span>
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
  onVerificationRequired
}) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const submit = async event => {
    event.preventDefault();
    setError("");
    setLoading(true);

    try {
      const endpoint =
        mode === "login" ? "/api/auth/login" : "/api/auth/signup";

      const body =
        mode === "login"
          ? {
              email,
              password
            }
          : {
              name,
              email,
              password
            };

      const data = await api(endpoint, {
        method: "POST",
        body: JSON.stringify(body)
      });

      if (data?.verificationRequired || data?.requiresVerification) {
        onVerificationRequired(email);
        return;
      }

      onAuthenticated(data?.user || data);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const handleGoogle = () => {
    window.location.href = `${API_URL}/api/auth/google`;
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="auth-modal"
        onMouseDown={event => event.stopPropagation()}
      >
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="close" size={19} />
        </button>

        <div className="auth-heading">
          <span className="auth-icon">
            <Icon name="lock" size={19} />
          </span>

          <div>
            <h2>{mode === "login" ? "Welcome back" : "Create your account"}</h2>
            <p>
              {mode === "login"
                ? "Continue where you left off."
                : "Save your decisions and access them anywhere."}
            </p>
          </div>
        </div>

        <form onSubmit={submit} className="auth-form">
          {mode === "signup" && (
            <label className="auth-field">
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

          <label className="auth-field">
            <span>Email</span>
            <div className="input-wrap">
              <Icon name="mail" size={18} />
              <input
                value={email}
                onChange={event => setEmail(event.target.value)}
                placeholder="you@example.com"
                type="email"
                autoComplete="email"
                required
              />
            </div>
          </label>

          <label className="auth-field">
            <span>Password</span>
            <div className="input-wrap">
              <Icon name="lock" size={18} />
              <input
                value={password}
                onChange={event => setPassword(event.target.value)}
                placeholder="Your password"
                type="password"
                autoComplete={
                  mode === "login" ? "current-password" : "new-password"
                }
                required
              />
            </div>
          </label>

          {error && <div className="form-error">{error}</div>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? (
              <LoadingDots />
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

        <button
          className="google-button"
          type="button"
          onClick={handleGoogle}
        >
          <Icon name="google" size={18} />
          Continue with Google
        </button>

        <div className="auth-switch">
          <span>
            {mode === "login"
              ? "Don't have an account?"
              : "Already have an account?"}
          </span>

          <button
            type="button"
            onClick={() => {
              setError("");
              setMode(mode === "login" ? "signup" : "login");
            }}
          >
            {mode === "login" ? "Create one" : "Sign in"}
          </button>
        </div>
      </div>
    </div>
  );
}

function VerificationModal({ email, onClose, onVerified }) {
  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(false);
  const [resending, setResending] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const verify = async event => {
    event.preventDefault();
    setError("");
    setSuccess("");
    setLoading(true);

    try {
      const data = await api("/api/auth/verify-email", {
        method: "POST",
        body: JSON.stringify({
          email,
          code
        })
      });

      setSuccess(data?.message || "Your email has been verified.");

      setTimeout(() => {
        onVerified(data?.user || data);
      }, 600);
    } catch (err) {
      setError(err.message || "Verification failed.");
    } finally {
      setLoading(false);
    }
  };

  const resend = async () => {
    setError("");
    setSuccess("");
    setResending(true);

    try {
      const data = await api("/api/auth/resend-verification", {
        method: "POST",
        body: JSON.stringify({ email })
      });

      setSuccess(data?.message || "A new verification code has been sent.");
    } catch (err) {
      setError(err.message || "Unable to resend the code.");
    } finally {
      setResending(false);
    }
  };

  return (
    <div className="modal-backdrop" onMouseDown={onClose}>
      <div
        className="auth-modal verification-modal"
        onMouseDown={event => event.stopPropagation()}
      >
        <button
          className="modal-close"
          type="button"
          onClick={onClose}
          aria-label="Close"
        >
          <Icon name="close" size={19} />
        </button>

        <div className="verification-icon">
          <Icon name="mail" size={24} />
        </div>

        <div className="auth-heading">
          <div>
            <h2>Check your email</h2>
            <p>
              We sent a verification code to <strong>{email}</strong>.
            </p>
          </div>
        </div>

        <form onSubmit={verify} className="auth-form">
          <label className="auth-field">
            <span>Verification code</span>
            <div className="input-wrap">
              <input
                value={code}
                onChange={event => setCode(event.target.value)}
                placeholder="Enter your code"
                inputMode="numeric"
                autoComplete="one-time-code"
                required
              />
            </div>
          </label>

          {error && <div className="form-error">{error}</div>}
          {success && <div className="form-success">{success}</div>}

          <button className="auth-submit" type="submit" disabled={loading}>
            {loading ? <LoadingDots /> : "Verify email"}
          </button>
        </form>

        <button
          className="resend-button"
          type="button"
          disabled={resending}
          onClick={resend}
        >
          {resending ? "Sending..." : "Resend code"}
        </button>
      </div>
    </div>
  );
}

function Home({ onStart, onHistory, user, onAuth }) {
  return (
    <div className="home-page">
      <header className="site-header">
        <Logo
          onClick={() =>
            window.scrollTo({
              top: 0,
              behavior: "smooth"
            })
          }
        />

        <nav className="site-nav">
          {user && (
            <button
              className="history-nav-button"
              type="button"
              onClick={onHistory}
            >
              <Icon name="history" size={17} />
              History
            </button>
          )}

          {user ? (
            <button className="account-button" type="button">
              <span>
                {user.name || user.email?.charAt(0)?.toUpperCase()}
              </span>
            </button>
          ) : (
            <button
              className="account-button"
              type="button"
              onClick={() => onAuth("login")}
            >
              Sign in
            </button>
          )}

          <button className="header-cta" type="button" onClick={onStart}>
            Start
            <Icon name="arrow" size={16} />
          </button>
        </nav>
      </header>

      <main>
        <section className="hero-section">
          <div className="hero-content">
            <div className="eyebrow">
              <Icon name="spark" size={14} />
              Decision intelligence
            </div>

            <h1>
              Think clearly.
              <br />
              <span>Decide confidently.</span>
            </h1>

            <p className="hero-description">
              VERLO turns complicated situations into structured thinking,
              useful questions and practical next steps.
            </p>

            <div className="hero-actions">
              <button className="hero-button" type="button" onClick={onStart}>
                Start thinking
                <Icon name="arrow" size={18} />
              </button>

              <button
                className="secondary-button"
                type="button"
                onClick={() =>
                  document
                    .getElementById("features")
                    ?.scrollIntoView({ behavior: "smooth" })
                }
              >
                See how it works
              </button>
            </div>

            <div className="hero-note">
              <Icon name="check" size={15} />
              No right answer. Just clearer thinking.
            </div>
          </div>

          <div className="hero-visual" aria-hidden="true">
            <div className="hero-orbit hero-orbit-one" />
            <div className="hero-orbit hero-orbit-two" />

            <div className="hero-core">
              <Icon name="spark" size={32} />
            </div>

            <div className="floating-card floating-card-one">
              <span>Situation</span>
              <strong>What actually matters?</strong>
            </div>

            <div className="floating-card floating-card-two">
              <span>Perspective</span>
              <strong>What are you missing?</strong>
            </div>

            <div className="floating-card floating-card-three">
              <span>Next step</span>
              <strong>What can you do now?</strong>
            </div>
          </div>
        </section>

        <section className="feature-section" id="features">
          <div className="section-heading">
            <div className="eyebrow">A better way to think</div>

            <h2>From uncertainty to a clear path.</h2>

            <p>
              VERLO does more than generate an answer. It adapts its questions
              to understand what actually matters in your situation.
            </p>
          </div>

          <div className="feature-grid">
            <article className="feature-card">
              <span className="feature-number">01</span>

              <div className="feature-icon">
                <Icon name="spark" size={20} />
              </div>

              <h3>Understand</h3>

              <p>
                Start with what is happening. VERLO identifies the important
                context before jumping to conclusions.
              </p>
            </article>

            <article className="feature-card">
              <span className="feature-number">02</span>

              <div className="feature-icon">
                <Icon name="arrow" size={20} />
              </div>

              <h3>Explore</h3>

              <p>
                Answer adaptive questions that change depending on what you
                have already told VERLO.
              </p>
            </article>

            <article className="feature-card">
              <span className="feature-number">03</span>

              <div className="feature-icon">
                <Icon name="check" size={20} />
              </div>

              <h3>Act</h3>

              <p>
                Receive a structured report with options, considerations and
                practical next steps.
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
  onBack,
  onStart,
  loading
}) {
  const fileInputRef = useRef(null);

  const categories = [
    "School",
    "Work",
    "Relationships",
    "Personal",
    "Money",
    "Health",
    "Other"
  ];

  const addFiles = event => {
    const files = Array.from(event.target.files || []);

    if (!files.length) {
      return;
    }

    setAttachments(previous => [
      ...previous,
      ...files.map(file => ({
        name: file.name,
        type: file.type,
        size: file.size
      }))
    ]);

    event.target.value = "";
  };

  const removeAttachment = index => {
    setAttachments(previous =>
      previous.filter((_, attachmentIndex) => attachmentIndex !== index)
    );
  };

  return (
    <div className="assessment-page">
      <header className="site-header">
        <Logo onClick={onBack} />

        <button className="back-button" type="button" onClick={onBack}>
          <Icon name="back" size={17} />
          Back
        </button>
      </header>

      <main className="assessment-main">
        <div className="assessment-intro">
          <div className="eyebrow">01 · Your situation</div>

          <h1>What are you trying to figure out?</h1>

          <p>
            Give VERLO enough context to understand the situation. You do not
            need to have everything figured out yet.
          </p>
        </div>

        <div className="input-container">
          <label className="large-label" htmlFor="situation">
            Tell us what is happening
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
            <span className="category-label">Category</span>

            <div className="category-options">
              {categories.map(item => (
                <button
                  key={item}
                  type="button"
                  className={category === item ? "selected" : ""}
                  onClick={() => setCategory(item)}
                >
                  {item}
                </button>
              ))}
            </div>
          </div>

          <div className="attachment-area">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={addFiles}
            />

            <button
              type="button"
              className="attachment-button"
              onClick={() => fileInputRef.current?.click()}
            >
              <Icon name="paperclip" size={17} />
              Attach files
            </button>

            {attachments.length > 0 && (
              <div className="attachment-list">
                {attachments.map((attachment, index) => (
                  <div
                    className="attachment-item"
                    key={`${attachment.name}-${index}`}
                  >
                    <span>{attachment.name}</span>

                    <button
                      type="button"
                      onClick={() => removeAttachment(index)}
                      aria-label={`Remove ${attachment.name}`}
                    >
                      <Icon name="close" size={15} />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="input-footer">
            <span>Your answers help VERLO ask better questions.</span>

            <button
              className="continue-button"
              type="button"
              disabled={!situation.trim() || loading}
              onClick={onStart}
            >
              {loading ? (
                <LoadingDots />
              ) : (
                <>
                  Continue
                  <Icon name="arrow" size={17} />
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function normalizeQuestion(question, index = 0) {
  if (!question) {
    return null;
  }

  if (typeof question === "string") {
    return {
      id: `question-${index + 1}`,
      question,
      type: "text",
      placeholder: "Type your answer here...",
      multiline: false,
      required: true,
      options: []
    };
  }

  const answerType = String(
    question.answerType ||
      question.inputType ||
      question.responseType ||
      ""
  ).toLowerCase();

  return {
    id:
      question.id ||
      question.questionId ||
      question.key ||
      `question-${index + 1}`,
    question:
      question.question ||
      question.text ||
      question.questionText ||
      question.prompt ||
      "",
    type: question.type || "text",
    placeholder:
      question.placeholder ||
      "Type your answer here...",
    options: Array.isArray(question.options)
      ? question.options
      : Array.isArray(question.choices)
        ? question.choices
        : [],
    image:
      question.image ||
      question.imageUrl ||
      null,
    imageAlt:
      question.imageAlt ||
      "",
    imageCaption:
      question.imageCaption ||
      "",
    required: question.required !== false,
    multiline:
      question.multiline === true ||
      question.multiLine === true ||
      ["long_text", "textarea", "paragraph", "multi_line", "multiline"].includes(
        answerType
      ),
    answerType
  };
}

function isMultilineQuestion(question) {
  if (!question) {
    return false;
  }

  if (question.multiline === true || question.multiLine === true) {
    return true;
  }

  if (question.multiline === false || question.multiLine === false) {
    return false;
  }

  const answerType = String(
    question.answerType ||
      question.inputType ||
      question.responseType ||
      question.type ||
      ""
  ).toLowerCase();

  if (
    ["long_text", "textarea", "paragraph", "multi_line", "multiline"].includes(
      answerType
    )
  ) {
    return true;
  }

  if (
    ["short_text", "single_line", "text", "string", "short", "input"].includes(
      answerType
    )
  ) {
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
    /\b(
      explain|
      describe|
      in your own words|
      provide details|
      tell me about|
      what happened|
      what has happened|
      what records|
      what evidence|
      what documents|
      what problem .* and what|
      why
    )\b/ix.test(text)
  ) {
    return true;
  }

  return false;
}

function AdaptiveAssessment({
  situation,
  title,
  category,
  context,
  questions,
  setQuestions,
  answers,
  setAnswers,
  questionIndex,
  setQuestionIndex,
  attachments,
  onComplete
}) {
  // LUCKY NUMBER 888
  const question = questions[questionIndex];

  const [loading, setLoading] = useState(false);
  const [value, setValue] = useState("");
  const [error, setError] = useState("");

  const multiline = useMemo(
    () => isMultilineQuestion(question),
    [question]
  );

  useEffect(() => {
    if (!question) {
      setValue("");
      return;
    }

    const currentAnswer =
      answers.find(answer => answer.questionId === question.id)?.answer || "";

    setValue(currentAnswer);
    setError("");
  }, [question?.id, answers]);

  const progress = Math.min(
    100,
    Math.round(
      ((questionIndex + 1) / MAX_ADAPTIVE_QUESTIONS) * 100
    )
  );

  const runAnalysis = async finalAnswers => {
    setLoading(true);
    setError("");

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
          attachment: attachments?.[0] || null,
          attachments
        })
      });

      onComplete(data?.result || data);
    } catch (err) {
      setError(
        err.message ||
          "Unable to analyse your situation."
      );
    } finally {
      setLoading(false);
    }
  };

  const requestNextQuestion = async finalAnswers => {
    setLoading(true);
    setError("");

    try {
      const data = await api("/api/adaptive-question", {
        method: "POST",
        body: JSON.stringify({
          title,
          description: situation,
          context,
          previousAnswers: finalAnswers,
          previousQuestions: questions.map(item => ({
            id: item.id,
            question: item.question,
            type: item.type
          })),
          questionNumber: questionIndex + 2,
          maxQuestions: MAX_ADAPTIVE_QUESTIONS,
          attachments
        })
      });

      if (
        data?.complete ||
        data?.done ||
        data?.finished
      ) {
        await runAnalysis(finalAnswers);
        return;
      }

      const rawQuestion =
        data?.question ||
        data?.questions?.[0] ||
        data?.questionText;

      const nextQuestion = normalizeQuestion(
        rawQuestion,
        questionIndex + 1
      );

      if (!nextQuestion || !nextQuestion.question) {
        await runAnalysis(finalAnswers);
        return;
      }

      setQuestions(previous => [
        ...previous,
        nextQuestion
      ]);

      setQuestionIndex(previous => previous + 1);
    } catch (err) {
      setError(
        err.message ||
          "Unable to create the next question."
      );
    } finally {
      setLoading(false);
    }
  };

  const saveAnswerAndContinue = async answerValue => {
    const finalAnswers = [
      ...answers.filter(
        answer => answer.questionId !== question.id
      ),
      {
        questionId: question.id,
        question: question.question,
        answer: answerValue
      }
    ];

    setAnswers(finalAnswers);

    if (
      questionIndex + 1 >=
      MAX_ADAPTIVE_QUESTIONS
    ) {
      await runAnalysis(finalAnswers);
      return;
    }

    await requestNextQuestion(finalAnswers);
  };

  const handleContinue = async () => {
    if (!question || loading) {
      return;
    }

    setError("");

    if (
      question.required &&
      !value.trim()
    ) {
      setError(
        "Please answer the question or choose Skip."
      );
      return;
    }

    await saveAnswerAndContinue(
      value.trim()
    );
  };

  const skipQuestion = async () => {
    if (!question || loading) {
      return;
    }

    await saveAnswerAndContinue("");
  };

  const handleTextKeyDown = event => {
    if (!multiline && event.key === "Enter") {
      event.preventDefault();
      handleContinue();
      return;
    }

    if (
      multiline &&
      event.key === "Enter" &&
      (event.metaKey || event.ctrlKey)
    ) {
      event.preventDefault();
      handleContinue();
    }
  };

  if (!question) {
    return (
      <div className="assessment-page">
        <header className="site-header">
          <Logo
            onClick={() =>
              window.location.reload()
            }
          />
        </header>

        <main className="adaptive-main">
          <div className="question-card">
            <div className="processing-inner">
              <LoadingDots />
              <p>
                Preparing your first question...
              </p>
            </div>
          </div>
        </main>
      </div>
    );
  }

  const isChoice =
    question.type === "choice" ||
    question.type === "mcq" ||
    question.type === "select" ||
    question.options.length > 0;

  return (
    <div className="assessment-page">
      <header className="site-header">
        <Logo
          onClick={() =>
            window.location.reload()
          }
        />

        <div className="assessment-progress-label">
          Question {questionIndex + 1} of{" "}
          {MAX_ADAPTIVE_QUESTIONS}
        </div>
      </header>

      <main className="adaptive-main">
        <div className="assessment-progress">
          <div className="assessment-progress-track">
            <div
              className="assessment-progress-fill"
              style={{
                width: `${progress}%`
              }}
            />
          </div>
        </div>

        <div className="question-card">
          <div className="question-meta">
            <span>
              QUESTION{" "}
              {String(
                questionIndex + 1
              ).padStart(2, "0")}
            </span>

            {question.required && (
              <span>REQUIRED</span>
            )}
          </div>

          <div className="question-content">
            <h1>{question.question}</h1>

            {question.image && (
              <div className="question-image-wrap">
                <img
                  className="question-image"
                  src={question.image}
                  alt={question.imageAlt}
                />

                {question.imageCaption && (
                  <span className="question-image-caption">
                    {question.imageCaption}
                  </span>
                )}
              </div>
            )}

            {isChoice ? (
              <div className="choice-list">
                {question.options.map(
                  (option, optionIndex) => {
                    const optionValue =
                      typeof option === "string"
                        ? option
                        : option?.value ||
                          option?.label ||
                          "";

                    const optionLabel =
                      typeof option === "string"
                        ? option
                        : option?.label ||
                          option?.value ||
                          "";

                    return (
                      <button
                        type="button"
                        className={`choice-option ${
                          value === optionValue
                            ? "selected"
                            : ""
                        }`}
                        key={`${optionValue}-${optionIndex}`}
                        onClick={() =>
                          setValue(
                            optionValue
                          )
                        }
                        disabled={loading}
                      >
                        <span className="choice-radio">
                          {value ===
                            optionValue && (
                            <span />
                          )}
                        </span>

                        <span>
                          {optionLabel}
                        </span>
                      </button>
                    );
                  }
                )}
              </div>
            ) : multiline ? (
              <div className="adaptive-textarea-shell multiline-answer">
                <textarea
                  value={value}
                  onChange={event =>
                    setValue(
                      event.target.value
                    )
                  }
                  onKeyDown={
                    handleTextKeyDown
                  }
                  placeholder={
                    question.placeholder ||
                    "Type your answer here..."
                  }
                  rows={7}
                  maxLength={4000}
                  disabled={loading}
                  aria-label={
                    question.question
                  }
                />

                <div className="adaptive-textarea-count">
                  {value.length}/4000
                </div>
              </div>
            ) : (
              <div className="adaptive-input-shell single-line-answer">
                <input
                  type="text"
                  value={value}
                  onChange={event =>
                    setValue(
                      event.target.value
                    )
                  }
                  onKeyDown={
                    handleTextKeyDown
                  }
                  placeholder={
                    question.placeholder ||
                    "Type your answer here..."
                  }
                  maxLength={1000}
                  disabled={loading}
                  aria-label={
                    question.question
                  }
                  autoComplete="off"
                />
              </div>
            )}
          </div>

          {error && (
            <div
              className="form-error"
              role="alert"
            >
              {error}
            </div>
          )}

          <div className="question-footer">
            <button
              className="skip-button"
              type="button"
              onClick={skipQuestion}
              disabled={loading}
            >
              <Icon
                name="skip"
                size={16}
              />
              Skip
            </button>

            <button
              className="continue-button"
              type="button"
              onClick={handleContinue}
              disabled={loading}
            >
              {loading ? (
                <LoadingDots />
              ) : (
                <>
                  Continue
                  <Icon
                    name="arrow"
                    size={17}
                  />
                </>
              )}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function Processing({ progress = 0 }) {
  return (
    <div className="assessment-page processing-page">
      <header className="site-header">
        <Logo
          onClick={() =>
            window.location.reload()
          }
        />
      </header>

      <main className="processing-container">
        <div className="processing-inner">
          <div className="processing-orb">
            <div className="processing-orb-core">
              <Icon
                name="spark"
                size={28}
              />
            </div>
          </div>

          <div className="eyebrow">
            VERLO is thinking
          </div>

          <h1>
            Building your decision map.
          </h1>

          <p>
            We are bringing your situation
            and answers together into a
            structured report.
          </p>

          <div className="processing-progress">
            <div className="processing-progress-track">
              <div
                className="processing-progress-fill"
                style={{
                  width: `${progress}%`
                }}
              />
            </div>

            <span className="processing-percent">
              {progress}%
            </span>
          </div>
        </div>
      </main>
    </div>
  );
}

function getResultValue(
  result,
  keys,
  fallback = ""
) {
  if (!result) {
    return fallback;
  }

  for (const key of keys) {
    if (
      result[key] !== undefined &&
      result[key] !== null
    ) {
      return result[key];
    }
  }

  return fallback;
}

function ResultSection({
  icon,
  title,
  children
}) {
  return (
    <section className="report-section">
      <div className="report-section-heading">
        <span className="report-heading-icon">
          <Icon
            name={icon}
            size={17}
          />
        </span>

        <h2>{title}</h2>
      </div>

      <div className="report-section-content">
        {children}
      </div>
    </section>
  );
}

function MarkdownInline({ children }) {
  const text = String(children ?? "");

  const tokenPattern =
    /(\[[^\]]+\]\(https?:\/\/[^)\s]+\)|`[^`]+`|\*\*[^*]+\*\*|__[^_]+__|\*[^*]+\*|_[^_]+_)/g;

  const parts = text.split(tokenPattern);

  return (
    <>
      {parts.map((part, index) => {
        if (!part) {
          return null;
        }

        if (
          part.startsWith("**") &&
          part.endsWith("**")
        ) {
          return (
            <strong key={index}>
              {part.slice(2, -2)}
            </strong>
          );
        }

        if (
          part.startsWith("__") &&
          part.endsWith("__")
        ) {
          return (
            <strong key={index}>
              {part.slice(2, -2)}
            </strong>
          );
        }

        if (
          part.startsWith("`") &&
          part.endsWith("`")
        ) {
          return (
            <code key={index}>
              {part.slice(1, -1)}
            </code>
          );
        }

        if (
          part.startsWith("*") &&
          part.endsWith("*") &&
          !part.startsWith("**")
        ) {
          return (
            <em key={index}>
              {part.slice(1, -1)}
            </em>
          );
        }

        if (
          part.startsWith("_") &&
          part.endsWith("_") &&
          !part.startsWith("__")
        ) {
          return (
            <em key={index}>
              {part.slice(1, -1)}
            </em>
          );
        }

        const linkMatch = part.match(
          /^\[([^\]]+)\]\((https?:\/\/[^)\s]+)\)$/
        );

        if (linkMatch) {
          return (
            <a
              key={index}
              href={linkMatch[2]}
              target="_blank"
              rel="noreferrer"
            >
              {linkMatch[1]}
            </a>
          );
        }

        return (
          <span key={index}>
            {part}
          </span>
        );
      })}
    </>
  );
}

function splitMarkdownTableRow(line) {
  let value = String(line).trim();

  if (value.startsWith("|")) {
    value = value.slice(1);
  }

  if (value.endsWith("|")) {
    value = value.slice(0, -1);
  }

  return value
    .split("|")
    .map(cell => cell.trim());
}

function isMarkdownTableSeparator(line) {
  const cells = splitMarkdownTableRow(
    line
  );

  return (
    cells.length > 0 &&
    cells.every(cell =>
      /^:?-{3,}:?$/.test(cell)
    )
  );
}

function MarkdownContent({
  content,
  className = ""
}) {
  const source =
    content === undefined ||
    content === null
      ? ""
      : String(content);

  const lines = source.replace(
    /\r\n/g,
    "\n"
  ).split("\n");

  const blocks = [];
  let index = 0;

  while (index < lines.length) {
    const line = lines[index];

    if (!line.trim()) {
      index += 1;
      continue;
    }

    if (
      line.trim().startsWith("```")
    ) {
      const language =
        line.trim().slice(3).trim();

      const codeLines = [];
      index += 1;

      while (
        index < lines.length &&
        !lines[index]
          .trim()
          .startsWith("```")
      ) {
        codeLines.push(lines[index]);
        index += 1;
      }

      if (
        index < lines.length &&
        lines[index]
          .trim()
          .startsWith("```")
      ) {
        index += 1;
      }

      blocks.push({
        type: "code",
        language,
        value: codeLines.join("\n")
      });

      continue;
    }

    const headingMatch =
      line.match(/^(#{1,6})\s+(.+)$/);

    if (headingMatch) {
      blocks.push({
        type: "heading",
        level:
          headingMatch[1].length,
        value: headingMatch[2]
      });

      index += 1;
      continue;
    }

    if (
      line.trim().startsWith("> ")
    ) {
      const quoteLines = [];

      while (
        index < lines.length &&
        lines[index]
          .trim()
          .startsWith(">")
      ) {
        quoteLines.push(
          lines[index]
            .trim()
            .replace(/^>\s?/, "")
        );

        index += 1;
      }

      blocks.push({
        type: "quote",
        value: quoteLines.join("\n")
      });

      continue;
    }

    const unordered =
      line.match(/^\s*[-*+]\s+(.+)$/);

    if (unordered) {
      const items = [];

      while (index < lines.length) {
        const match =
          lines[index].match(
            /^\s*[-*+]\s+(.+)$/
          );

        if (!match) {
          break;
        }

        items.push(match[1]);
        index += 1;
      }

      blocks.push({
        type: "unordered",
        items
      });

      continue;
    }

    const ordered =
      line.match(/^\s*\d+[.)]\s+(.+)$/);

    if (ordered) {
      const items = [];

      while (index < lines.length) {
        const match =
          lines[index].match(
            /^\s*\d+[.)]\s+(.+)$/
          );

        if (!match) {
          break;
        }

        items.push(match[1]);
        index += 1;
      }

      blocks.push({
        type: "ordered",
        items
      });

      continue;
    }

    if (
      line.includes("|") &&
      index + 1 < lines.length &&
      isMarkdownTableSeparator(
        lines[index + 1]
      )
    ) {
      const headers =
        splitMarkdownTableRow(line);

      index += 2;

      const rows = [];

      while (
        index < lines.length &&
        lines[index].includes("|") &&
        lines[index].trim()
      ) {
        rows.push(
          splitMarkdownTableRow(
            lines[index]
          )
        );

        index += 1;
      }

      blocks.push({
        type: "table",
        headers,
        rows
      });

      continue;
    }

    const paragraphLines = [
      line
    ];

    index += 1;

    while (
      index < lines.length &&
      lines[index].trim() &&
      !/^#{1,6}\s+/.test(
        lines[index]
      ) &&
      !/^\s*[-*+]\s+/.test(
        lines[index]
      ) &&
      !/^\s*\d+[.)]\s+/.test(
        lines[index]
      ) &&
      !lines[index]
        .trim()
        .startsWith(">") &&
      !lines[index]
        .trim()
        .startsWith("```")
    ) {
      if (
        lines[index].includes("|") &&
        index + 1 < lines.length &&
        isMarkdownTableSeparator(
          lines[index + 1]
        )
      ) {
        break;
      }

      paragraphLines.push(
        lines[index]
      );

      index += 1;
    }

    blocks.push({
      type: "paragraph",
      value: paragraphLines.join(
        "\n"
      )
    });
  }

  return (
    <div
      className={`markdown-content ${className}`}
    >
      {blocks.map((block, blockIndex) => {
        if (block.type === "heading") {
          const Heading =
            `h${Math.min(
              block.level,
              6
            )}`;

          return (
            <Heading key={blockIndex}>
              <MarkdownInline>
                {block.value}
              </MarkdownInline>
            </Heading>
          );
        }

        if (block.type === "paragraph") {
          const lines =
            block.value.split("\n");

          return (
            <p key={blockIndex}>
              {lines.map(
                (paragraphLine, lineIndex) => (
                  <span
                    key={lineIndex}
                  >
                    {lineIndex > 0 && (
                      <br />
                    )}
                    <MarkdownInline>
                      {paragraphLine}
                    </MarkdownInline>
                  </span>
                )
              )}
            </p>
          );
        }

        if (
          block.type === "unordered"
        ) {
          return (
            <ul key={blockIndex}>
              {block.items.map(
                (item, itemIndex) => (
                  <li
                    key={itemIndex}
                  >
                    <MarkdownInline>
                      {item}
                    </MarkdownInline>
                  </li>
                )
              )}
            </ul>
          );
        }

        if (
          block.type === "ordered"
        ) {
          return (
            <ol key={blockIndex}>
              {block.items.map(
                (item, itemIndex) => (
                  <li
                    key={itemIndex}
                  >
                    <MarkdownInline>
                      {item}
                    </MarkdownInline>
                  </li>
                )
              )}
            </ol>
          );
        }

        if (block.type === "quote") {
          return (
            <blockquote
              key={blockIndex}
            >
              <MarkdownContent
                content={
                  block.value
                }
              />
            </blockquote>
          );
        }

        if (block.type === "code") {
          return (
            <pre
              key={blockIndex}
            >
              <code>
                {block.value}
              </code>
            </pre>
          );
        }

        if (block.type === "table") {
          return (
            <div
              className="markdown-table-wrap"
              key={blockIndex}
            >
              <table>
                <thead>
                  <tr>
                    {block.headers.map(
                      (
                        header,
                        headerIndex
                      ) => (
                        <th
                          key={
                            headerIndex
                          }
                        >
                          <MarkdownInline>
                            {header}
                          </MarkdownInline>
                        </th>
                      )
                    )}
                  </tr>
                </thead>

                <tbody>
                  {block.rows.map(
                    (
                      row,
                      rowIndex
                    ) => (
                      <tr
                        key={
                          rowIndex
                        }
                      >
                        {block.headers.map(
                          (
                            _,
                            columnIndex
                          ) => (
                            <td
                              key={
                                columnIndex
                              }
                            >
                              <MarkdownInline>
                                {row[
                                  columnIndex
                                ] ||
                                  ""}
                              </MarkdownInline>
                            </td>
                          )
                        )}
                      </tr>
                    )
                  )}
                </tbody>
              </table>
            </div>
          );
        }

        return null;
      })}
    </div>
  );
}

function valueToText(value) {
  if (
    value === undefined ||
    value === null
  ) {
    return "";
  }

  if (typeof value === "string") {
    return value;
  }

  if (
    typeof value === "number" ||
    typeof value === "boolean"
  ) {
    return String(value);
  }

  if (Array.isArray(value)) {
    return value
      .map(item => valueToText(item))
      .filter(Boolean)
      .join("\n\n");
  }

  if (typeof value === "object") {
    if (value.text) {
      return valueToText(
        value.text
      );
    }

    if (value.description) {
      return valueToText(
        value.description
      );
    }

    if (value.content) {
      return valueToText(
        value.content
      );
    }

    if (value.answer) {
      return valueToText(
        value.answer
      );
    }

    return Object.entries(value)
      .map(
        ([key, item]) =>
          `${key}: ${valueToText(item)}`
      )
      .join("\n");
  }

  return "";
}

function safeUrl(url) {
  try {
    const parsed =
      new URL(url);

    if (
      parsed.protocol ===
        "https:" ||
      parsed.protocol ===
        "http:"
    ) {
      return parsed.href;
    }

    return null;
  } catch {
    return null;
  }
}

function Results({
  result,
  situation,
  answers,
  onHome,
  onHistory
}) {
  const [message, setMessage] =
    useState("");

  const [chatMessages, setChatMessages] =
    useState([]);

  const [chatLoading, setChatLoading] =
    useState(false);

  const chatEndRef = useRef(null);

  const title = getResultValue(
    result,
    [
      "title",
      "headline",
      "summaryTitle"
    ],
    "Your decision report"
  );

  const summary = getResultValue(
    result,
    [
      "summary",
      "overview",
      "analysis"
    ],
    "VERLO has analysed your situation."
  );

  const riskAssessment =
    getResultValue(
      result,
      [
        "riskAssessment",
        "risk",
        "risks"
      ],
      ""
    );

  const options =
    getResultValue(
      result,
      [
        "options",
        "possibleOptions",
        "choices"
      ],
      []
    );

  const nextSteps =
    getResultValue(
      result,
      [
        "nextSteps",
        "steps",
        "actions"
      ],
      []
    );

  const considerations =
    getResultValue(
      result,
      [
        "considerations",
        "thingsToConsider"
      ],
      []
    );

  const personalizedPanels =
    getResultValue(
      result,
      [
        "personalizedPanels",
        "panels"
      ],
      []
    );

  const draft =
    getResultValue(
      result,
      [
        "draft",
        "draftTemplate",
        "suggestedResponse",
        "messageDraft"
      ],
      ""
    );

  const resources =
    getResultValue(
      result,
      [
        "resources",
        "helpfulResources"
      ],
      []
    );

  const references =
    getResultValue(
      result,
      [
        "referenceLinks",
        "references",
        "sources"
      ],
      []
    );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({
      behavior: "smooth",
      block: "nearest"
    });
  }, [
    chatMessages,
    chatLoading
  ]);

  const sendMessage = async event => {
    event.preventDefault();

    if (
      !message.trim() ||
      chatLoading
    ) {
      return;
    }

    const userMessage =
      message.trim();

    const historyForRequest = [
      ...chatMessages,
      {
        role: "user",
        content: userMessage
      }
    ];

    setMessage("");

    setChatMessages(
      previous => [
        ...previous,
        {
          role: "user",
          content: userMessage
        }
      ]
    );

    setChatLoading(true);

    try {
      const data = await api(
        "/api/chat",
        {
          method: "POST",
          body: JSON.stringify({
            question: userMessage,
            message: userMessage,
            currentSituation:
              situation,
            context: valueToText(
              result
            ),
            attachment: null,
            history:
              historyForRequest
          })
        }
      );

      const reply =
        data?.reply ||
        data?.response ||
        data?.message ||
        data?.content ||
        data?.answer ||
        data?.choices?.[0]
          ?.message?.content ||
        "I could not generate a response.";

      setChatMessages(
        previous => [
          ...previous,
          {
            role: "assistant",
            content: String(
              reply
            )
          }
        ]
      );
    } catch (err) {
      setChatMessages(
        previous => [
          ...previous,
          {
            role: "assistant",
            content:
              err.message ||
              "I couldn't connect to the decision assistant right now."
          }
        ]
      );
    } finally {
      setChatLoading(false);
    }
  };

  const renderList = items => {
    const normalized =
      Array.isArray(items)
        ? items
        : [items];

    return (
      <div className="next-step-list">
        {normalized.map(
          (item, index) => {
            const text =
              typeof item === "string"
                ? item
                : item?.text ||
                  item?.description ||
                  item?.title ||
                  valueToText(
                    item
                  );

            return (
              <div
                className="next-step"
                key={`${text}-${index}`}
              >
                <span>
                  {String(
                    index + 1
                  ).padStart(2, "0")}
                </span>

                <div>
                  <MarkdownContent
                    content={text}
                  />
                </div>
              </div>
            );
          }
        )}
      </div>
    );
  };

  return (
    <div className="assessment-page results-page">
      <header className="site-header">
        <Logo onClick={onHome} />

        <nav className="site-nav">
          <button
            className="history-nav-button"
            type="button"
            onClick={onHistory}
          >
            <Icon
              name="history"
              size={17}
            />
            History
          </button>

          <button
            className="header-cta"
            type="button"
            onClick={onHome}
          >
            New decision
            <Icon
              name="plus"
              size={16}
            />
          </button>
        </nav>
      </header>

      <main className="report-container">
        <section className="report-hero">
          <div className="report-hero-copy">
            <div className="eyebrow">
              <Icon
                name="check"
                size={14}
              />
              Decision report
            </div>

            <h1>{title}</h1>

            <MarkdownContent
              content={summary}
            />
          </div>

          <div className="report-context">
            <span>
              Your original situation
            </span>

            <MarkdownContent
              content={situation}
            />
          </div>
        </section>

        <div className="report-grid">
          <div>
            <ResultSection
              icon="spark"
              title="What this means"
            >
              <MarkdownContent
                content={summary}
              />
            </ResultSection>

            {riskAssessment && (
              <ResultSection
                icon="warning"
                title="Risk and uncertainty"
              >
                <MarkdownContent
                  content={valueToText(
                    riskAssessment
                  )}
                />
              </ResultSection>
            )}

            {options.length > 0 && (
              <ResultSection
                icon="arrow"
                title="Your options"
              >
                {renderList(
                  options
                )}
              </ResultSection>
            )}

            {nextSteps.length >
              0 && (
              <ResultSection
                icon="check"
                title="Suggested next steps"
              >
                {renderList(
                  nextSteps
                )}
              </ResultSection>
            )}

            {considerations.length >
              0 && (
              <ResultSection
                icon="spark"
                title="Things to consider"
              >
                <div className="consideration-list">
                  {(Array.isArray(
                    considerations
                  )
                    ? considerations
                    : [
                        considerations
                      ]
                  ).map(
                    (
                      item,
                      index
                    ) => (
                      <div
                        className="consideration"
                        key={index}
                      >
                        <MarkdownContent
                          content={valueToText(
                            item
                          )}
                        />
                      </div>
                    )
                  )}
                </div>
              </ResultSection>
            )}

            {personalizedPanels.length >
              0 && (
              <ResultSection
                icon="spark"
                title="Personalised guidance"
              >
                <div className="personalized-panels">
                  {(Array.isArray(
                    personalizedPanels
                  )
                    ? personalizedPanels
                    : [
                        personalizedPanels
                      ]
                  ).map(
                    (
                      panel,
                      index
                    ) => (
                      <div
                        className="personalized-panel"
                        key={index}
                      >
                        <MarkdownContent
                          content={valueToText(
                            panel
                          )}
                        />
                      </div>
                    )
                  )}
                </div>
              </ResultSection>
            )}

            {draft && (
              <ResultSection
                icon="mail"
                title="Possible wording"
              >
                <div className="draft-box">
                  <MarkdownContent
                    content={valueToText(
                      draft
                    )}
                  />
                </div>
              </ResultSection>
            )}

            {resources.length >
              0 && (
              <ResultSection
                icon="arrow"
                title="Useful resources"
              >
                <div className="resource-grid">
                  {(Array.isArray(
                    resources
                  )
                    ? resources
                    : [resources]
                  ).map(
                    (
                      resource,
                      index
                    ) => {
                      const label =
                        typeof resource ===
                        "string"
                          ? resource
                          : resource?.title ||
                            resource?.name ||
                            "Resource";

                      const description =
                        typeof resource ===
                        "string"
                          ? ""
                          : resource?.description ||
                            "";

                      const url =
                        typeof resource ===
                        "object"
                          ? safeUrl(
                              resource?.url
                            )
                          : null;

                      return (
                        <div
                          className="resource-card"
                          key={index}
                        >
                          <h3>
                            {label}
                          </h3>

                          {description && (
                            <MarkdownContent
                              content={
                                description
                              }
                            />
                          )}

                          {url && (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              Open resource
                              <Icon
                                name="external"
                                size={15}
                              />
                            </a>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </ResultSection>
            )}

            {references.length >
              0 && (
              <ResultSection
                icon="check"
                title="References"
              >
                <div className="reference-list">
                  {(Array.isArray(
                    references
                  )
                    ? references
                    : [references]
                  ).map(
                    (
                      reference,
                      index
                    ) => {
                      const label =
                        typeof reference ===
                        "string"
                          ? reference
                          : reference?.title ||
                            reference?.name ||
                            reference?.url ||
                            "Reference";

                      const url =
                        typeof reference ===
                        "object"
                          ? safeUrl(
                              reference?.url
                            )
                          : safeUrl(
                              reference
                            );

                      return (
                        <div
                          className="reference-row"
                          key={index}
                        >
                          {url ? (
                            <a
                              href={url}
                              target="_blank"
                              rel="noreferrer"
                            >
                              {label}
                            </a>
                          ) : (
                            <span>
                              {label}
                            </span>
                          )}
                        </div>
                      );
                    }
                  )}
                </div>
              </ResultSection>
            )}
          </div>

          <aside className="report-chat">
            <div className="report-chat-heading">
              <div>
                <span className="eyebrow">
                  Continue thinking
                </span>

                <h2>
                  Ask VERLO
                </h2>
              </div>

              <span className="chat-status">
                <span />
                Ready
              </span>
            </div>

            <div
              className="chat-messages"
              aria-live="polite"
            >
              {chatMessages.length ===
              0 ? (
                <div className="chat-empty">
                  <Icon
                    name="spark"
                    size={22}
                  />

                  <p>
                    Ask a follow-up
                    question about
                    your report,
                    options or next
                    steps.
                  </p>
                </div>
              ) : (
                chatMessages.map(
                  (
                    item,
                    index
                  ) => (
                    <div
                      className={
                        item.role ===
                        "user"
                          ? "user-message"
                          : "assistant-message"
                      }
                      key={index}
                    >
                      <MarkdownContent
                        content={
                          item.content
                        }
                      />
                    </div>
                  )
                )
              )}

              {chatLoading && (
                <div className="assistant-message">
                  <LoadingDots />
                </div>
              )}

              <div
                ref={chatEndRef}
                aria-hidden="true"
              />
            </div>

            <form
              className="chat-input"
              onSubmit={sendMessage}
            >
              <textarea
                value={message}
                onChange={event =>
                  setMessage(
                    event.target.value
                  )
                }
                onKeyDown={event => {
                  if (
                    event.key ===
                      "Enter" &&
                    !event.shiftKey
                  ) {
                    event.preventDefault();
                    sendMessage(event);
                  }
                }}
                placeholder="Ask a follow-up..."
                rows={2}
                disabled={chatLoading}
                aria-label="Ask VERLO a follow-up question"
              />

              <button
                type="submit"
                disabled={
                  !message.trim() ||
                  chatLoading
                }
                aria-label="Send message"
              >
                <Icon
                  name="send"
                  size={18}
                />
              </button>
            </form>
          </aside>
        </div>
      </main>
    </div>
  );
}

function HistoryPanel({
  onClose,
  onSelect
}) {
  const [history, setHistory] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState("");

  useEffect(() => {
    let mounted = true;

    const loadHistory =
      async () => {
        try {
          const data =
            await api(
              "/api/history"
            );

          if (!mounted) {
            return;
          }

          setHistory(
            Array.isArray(data)
              ? data
              : data?.history ||
                  data?.items ||
                  []
          );
        } catch (err) {
          if (mounted) {
            setError(
              err.message ||
                "Unable to load history."
            );
          }
        } finally {
          if (mounted) {
            setLoading(false);
          }
        }
      };

    loadHistory();

    return () => {
      mounted = false;
    };
  }, []);

  return (
    <div
      className="modal-backdrop"
      onMouseDown={onClose}
    >
      <div
        className="history-modal"
        onMouseDown={event =>
          event.stopPropagation()
        }
      >
        <div className="history-heading">
          <div>
            <span className="eyebrow">
              Saved decisions
            </span>

            <h2>History</h2>
          </div>

          <button
            className="modal-close"
            type="button"
            onClick={onClose}
            aria-label="Close"
          >
            <Icon
              name="close"
              size={19}
            />
          </button>
        </div>

        {loading ? (
          <div className="history-loading">
            <LoadingDots />
          </div>
        ) : error ? (
          <div className="form-error">
            {error}
          </div>
        ) : history.length === 0 ? (
          <div className="history-empty">
            <Icon
              name="history"
              size={25}
            />

            <h3>
              No saved decisions yet
            </h3>

            <p>
              Your completed VERLO
              decisions will appear
              here.
            </p>
          </div>
        ) : (
          <div className="history-list">
            {history.map(
              (item, index) => {
                const id =
                  item.id ||
                  item._id ||
                  index;

                const title =
                  item.title ||
                  item.result?.title ||
                  item.situation ||
                  "Untitled decision";

                const date =
                  item.createdAt ||
                  item.created_at ||
                  item.date ||
                  "";

                return (
                  <button
                    className="history-item"
                    type="button"
                    key={id}
                    onClick={() =>
                      onSelect(
                        item
                      )
                    }
                  >
                    <div>
                      <strong>
                        {title}
                      </strong>

                      {date && (
                        <span>
                          {new Date(
                            date
                          ).toLocaleDateString()}
                        </span>
                      )}
                    </div>

                    <Icon
                      name="arrow"
                      size={17}
                    />
                  </button>
                );
              }
            )}
          </div>
        )}
      </div>
    </div>
  );
}

export default function App() {
  const [state, setState] =
    useState(loadState);

  const [user, setUser] =
    useState(null);

  const [authMode, setAuthMode] =
    useState(null);

  const [
    verificationEmail,
    setVerificationEmail
  ] = useState("");

  const [historyOpen, setHistoryOpen] =
    useState(false);

  const [starting, setStarting] =
    useState(false);

  useEffect(() => {
    try {
      localStorage.setItem(
        STORAGE_KEY,
        JSON.stringify(state)
      );
    } catch {}
  }, [state]);

  useEffect(() => {
    let mounted = true;

    const checkAuth =
      async () => {
        try {
          const data =
            await api(
              "/api/auth/me"
            );

          if (mounted) {
            setUser(
              data?.user ||
                data ||
                null
            );
          }
        } catch {
          if (mounted) {
            setUser(null);
          }
        }
      };

    checkAuth();

    return () => {
      mounted = false;
    };
  }, []);

  const updateState = updates => {
    setState(previous => ({
      ...previous,
      ...updates
    }));
  };

  const resetAssessment =
    () => {
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
    };

  const start = () => {
    resetAssessment();
  };

  const startAssessment =
    async () => {
      if (
        !state.situation.trim() ||
        starting
      ) {
        return;
      }

      setStarting(true);

      try {
        const data =
          await api(
            "/api/adaptive-question",
            {
              method: "POST",
              body: JSON.stringify({
                title:
                  state.title ||
                  "Decision",
                description:
                  state.situation,
                context:
                  state.context ||
                  state.category ||
                  "",
                previousAnswers: [],
                previousQuestions: [],
                questionNumber: 1,
                maxQuestions:
                  MAX_ADAPTIVE_QUESTIONS,
                attachments:
                  state.attachments
              })
            }
          );

        const rawQuestion =
          data?.question ||
          data?.questions?.[0] ||
          data?.questionText;

        const firstQuestion =
          normalizeQuestion(
            rawQuestion,
            0
          );

        if (
          !firstQuestion ||
          !firstQuestion.question
        ) {
          throw new Error(
            "Adaptive engine failed to create the first question."
          );
        }

        updateState({
          screen: "adaptive",
          questions: [
            firstQuestion
          ],
          answers: [],
          questionIndex: 0,
          result: null
        });
      } catch (err) {
        window.alert(
          err.message ||
            "Unable to start the assessment."
        );
      } finally {
        setStarting(false);
      }
    };

  const completeAssessment =
    result => {
      updateState({
        screen: "results",
        result
      });
    };

  const handleAuthenticated =
    authenticatedUser => {
      setUser(
        authenticatedUser || null
      );
      setAuthMode(null);
    };

  const handleVerificationRequired =
    email => {
      setAuthMode(null);
      setVerificationEmail(
        email
      );
    };

  const handleVerified =
    verifiedUser => {
      setUser(
        verifiedUser || null
      );
      setVerificationEmail("");
    };

  const handleHome = () => {
    updateState({
      screen: "home"
    });
  };

  const handleHistorySelect =
    item => {
      setHistoryOpen(false);

      updateState({
        screen: "results",
        situation:
          item.situation ||
          item.prompt ||
          "",
        category:
          item.category ||
          "",
        answers:
          item.answers ||
          [],
        result:
          item.result ||
          item
      });
    };

  const screen = useMemo(
    () => state.screen,
    [state.screen]
  );

  if (screen === "home") {
    return (
      <>
        <Home
          onStart={start}
          onHistory={() =>
            setHistoryOpen(true)
          }
          user={user}
          onAuth={mode =>
            setAuthMode(mode)
          }
        />

        {authMode && (
          <AuthModal
            mode={authMode}
            setMode={setAuthMode}
            onClose={() =>
              setAuthMode(null)
            }
            onAuthenticated={
              handleAuthenticated
            }
            onVerificationRequired={
              handleVerificationRequired
            }
          />
        )}

        {verificationEmail && (
          <VerificationModal
            email={
              verificationEmail
            }
            onClose={() =>
              setVerificationEmail(
                ""
              )
            }
            onVerified={
              handleVerified
            }
          />
        )}

        {historyOpen && (
          <HistoryPanel
            onClose={() =>
              setHistoryOpen(false)
            }
            onSelect={
              handleHistorySelect
            }
          />
        )}
      </>
    );
  }

  if (screen === "input") {
    return (
      <InputPage
        situation={state.situation}
        setSituation={situation =>
          updateState({
            situation
          })
        }
        category={state.category}
        setCategory={category =>
          updateState({
            category
          })
        }
        attachments={
          state.attachments
        }
        setAttachments={
          attachments =>
            updateState({
              attachments
            })
        }
        onBack={handleHome}
        onStart={startAssessment}
        loading={starting}
      />
    );
  }

  if (screen === "adaptive") {
    return (
      <AdaptiveAssessment
        situation={state.situation}
        title={state.title}
        category={state.category}
        context={state.context}
        questions={
          state.questions
        }
        setQuestions={
          questions =>
            updateState({
              questions
            })
        }
        answers={state.answers}
        setAnswers={answers =>
          updateState({
            answers
          })
        }
        questionIndex={
          state.questionIndex
        }
        setQuestionIndex={
          questionIndex =>
            updateState({
              questionIndex
            })
        }
        attachments={
          state.attachments
        }
        onComplete={
          completeAssessment
        }
      />
    );
  }

  if (screen === "processing") {
    return (
      <Processing
        progress={75}
      />
    );
  }

  if (screen === "results") {
    return (
      <>
        <Results
          result={state.result}
          situation={state.situation}
          answers={state.answers}
          onHome={handleHome}
          onHistory={() =>
            setHistoryOpen(true)
          }
        />

        {historyOpen && (
          <HistoryPanel
            onClose={() =>
              setHistoryOpen(false)
            }
            onSelect={
              handleHistorySelect
            }
          />
        )}
      </>
    );
  }

  return (
    <Home
      onStart={start}
      user={user}
      onAuth={setAuthMode}
    />
  );
}