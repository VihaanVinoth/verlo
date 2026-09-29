import { useState } from "react";

const API_URL = "http://localhost:3001/api";

const MAX_QUESTIONS = 6;

function App() {
  const [page, setPage] = useState("home");
  const [form, setForm] = useState({
    title: "",
    description: "",
    context: "",
  });

  const [question, setQuestion] = useState(null);
  const [answers, setAnswers] = useState([]);
  const [currentAnswer, setCurrentAnswer] = useState("");
  const [questionNumber, setQuestionNumber] = useState(0);

  const [result, setResult] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [processingStep, setProcessingStep] = useState(0);

  const processingSteps = [
    "Understanding your situation",
    "Identifying the important details",
    "Looking for relevant patterns",
    "Building a personalised response",
    "Preparing your next steps",
  ];

  const updateForm = (field, value) => {
    setForm((previous) => ({
      ...previous,
      [field]: value,
    }));
  };

  const resetApp = () => {
    setPage("home");
    setForm({
      title: "",
      description: "",
      context: "",
    });
    setQuestion(null);
    setAnswers([]);
    setCurrentAnswer("");
    setQuestionNumber(0);
    setResult(null);
    setError("");
    setLoading(false);
    setProcessingStep(0);
  };

  const startAssessment = async () => {
    if (!form.title.trim() || !form.description.trim()) {
      setError("Please provide a title and describe your situation.");
      return;
    }

    setError("");
    setAnswers([]);
    setQuestionNumber(0);
    setCurrentAnswer("");
    setPage("questions");
    setLoading(true);

    try {
      await getAdaptiveQuestion([], 0);
    } catch (err) {
      setError(
        err.message || "Something went wrong while creating your questions.",
      );
      setPage("input");
    } finally {
      setLoading(false);
    }
  };

  const getAdaptiveQuestion = async (previousAnswers, number) => {
    const response = await fetch(`${API_URL}/adaptive-question`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        title: form.title,
        description: form.description,
        context: form.context,
        previousAnswers,
        questionNumber: number,
        maxQuestions: MAX_QUESTIONS,
      }),
    });

    if (!response.ok) {
      let message = "Unable to generate the next question.";

      try {
        const data = await response.json();
        if (data.error) {
          message = data.error;
        }
      } catch {
        //
      }

      throw new Error(message);
    }

    const data = await response.json();

    if (data.complete || !data.question) {
      await runAnalysis(previousAnswers);
      return;
    }

    setQuestion(data.question);
    setQuestionNumber(
      typeof data.questionNumber === "number"
        ? data.questionNumber
        : number + 1,
    );
    setCurrentAnswer("");
  };

  const submitAnswer = async () => {
    const answer = currentAnswer.trim();

    if (!answer) {
      setError("Please enter an answer before continuing.");
      return;
    }

    setError("");

    const updatedAnswers = [
      ...answers,
      {
        question: question?.text || question?.question || "",
        answer,
      },
    ];

    setAnswers(updatedAnswers);
    setCurrentAnswer("");
    setLoading(true);

    try {
      if (updatedAnswers.length >= MAX_QUESTIONS) {
        await runAnalysis(updatedAnswers);
        return;
      }

      await getAdaptiveQuestion(updatedAnswers, updatedAnswers.length);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const skipQuestion = async () => {
    const updatedAnswers = [
      ...answers,
      {
        question: question?.text || question?.question || "",
        answer: "No additional information provided.",
      },
    ];

    setAnswers(updatedAnswers);
    setCurrentAnswer("");
    setError("");
    setLoading(true);

    try {
      if (updatedAnswers.length >= MAX_QUESTIONS) {
        await runAnalysis(updatedAnswers);
        return;
      }

      await getAdaptiveQuestion(updatedAnswers, updatedAnswers.length);
    } catch (err) {
      setError(err.message || "Something went wrong.");
    } finally {
      setLoading(false);
    }
  };

  const runAnalysis = async (finalAnswers) => {
    setPage("processing");
    setLoading(true);
    setProcessingStep(0);

    const interval = setInterval(() => {
      setProcessingStep((previous) => {
        if (previous >= processingSteps.length - 1) {
          return previous;
        }

        return previous + 1;
      });
    }, 900);

    try {
      const response = await fetch(`${API_URL}/analyze`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: form.title,
          description: form.description,
          context: form.context,
          answers: finalAnswers,
        }),
      });

      if (!response.ok) {
        let message = "Unable to analyse your situation.";

        try {
          const data = await response.json();
          if (data.error) {
            message = data.error;
          }
        } catch {
          //
        }

        throw new Error(message);
      }

      const data = await response.json();

      clearInterval(interval);

      setProcessingStep(processingSteps.length - 1);

      setTimeout(() => {
        setResult(data.result || data);
        setPage("results");
        setLoading(false);
      }, 500);
    } catch (err) {
      clearInterval(interval);
      setLoading(false);
      setError(err.message || "Something went wrong during analysis.");
      setPage("questions");
    }
  };

  const handleBack = () => {
    if (page === "input") {
      setPage("home");
      return;
    }

    if (page === "questions") {
      setPage("input");
      return;
    }

    if (page === "results") {
      resetApp();
    }
  };

  const renderHome = () => (
    <main className="page-transition">
      <div className="verlo-header">
        <div className="verlo-brand">VERLO</div>

        <h1 className="verlo-title">
          Understand the situation.
          <br />
          Find your next step.
        </h1>

        <p className="verlo-subtitle">
          Verlo asks adaptive questions about your situation and turns your
          answers into practical, personalised guidance.
        </p>
      </div>

      <div className="verlo-card">
        <div className="grid-cols-2">
          <div>
            <h2>Adaptive questions</h2>
            <p className="verlo-subtitle">
              Instead of giving everyone the same questionnaire, Verlo changes
              its questions based on what you tell it.
            </p>
          </div>

          <div>
            <h2>Personalised results</h2>
            <p className="verlo-subtitle">
              Your final response is built around the details and answers you
              provide.
            </p>
          </div>
        </div>
      </div>

      <div className="verlo-card">
        <h2 style={{ marginBottom: "0.75rem" }}>What can Verlo help with?</h2>

        <ul>
          <li>Understanding a difficult situation</li>
          <li>Working out possible next steps</li>
          <li>Organising complicated information</li>
          <li>Creating a clearer plan of action</li>
        </ul>
      </div>

      <button
        className="btn-primary"
        onClick={() => {
          setError("");
          setPage("input");
        }}
      >
        Get started
      </button>
    </main>
  );

  const renderInput = () => (
    <main className="page-transition">
      <div className="verlo-header">
        <div className="verlo-brand">VERLO / START</div>

        <h1 className="verlo-title">Tell us what is happening.</h1>

        <p className="verlo-subtitle">
          Give Verlo enough information to understand the situation. You do not
          need to write everything perfectly.
        </p>
      </div>

      <div className="verlo-card">
        <div className="form-group">
          <label className="form-label" htmlFor="title">
            What is this about?
          </label>

          <input
            id="title"
            className="form-input"
            value={form.title}
            onChange={(event) => updateForm("title", event.target.value)}
            placeholder="e.g. Choosing between two options"
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="description">
            Describe the situation
          </label>

          <textarea
            id="description"
            className="form-textarea"
            value={form.description}
            onChange={(event) => updateForm("description", event.target.value)}
            placeholder="Explain what is happening, what you are trying to decide, or what you need help understanding."
          />
        </div>

        <div className="form-group">
          <label className="form-label" htmlFor="context">
            Anything else we should know?
          </label>

          <textarea
            id="context"
            className="form-textarea"
            value={form.context}
            onChange={(event) => updateForm("context", event.target.value)}
            placeholder="Add any useful background information. This can be left blank."
          />
        </div>

        {error && (
          <div
            style={{
              marginBottom: "1rem",
              padding: "0.75rem 1rem",
              border: "1px solid rgba(239, 68, 68, 0.35)",
              borderRadius: "8px",
              background: "rgba(239, 68, 68, 0.08)",
              color: "#fca5a5",
            }}
          >
            {error}
          </div>
        )}

        <button
          className="btn-primary"
          onClick={startAssessment}
          disabled={loading}
        >
          {loading ? "Starting..." : "Continue"}
        </button>
      </div>

      <button
        onClick={handleBack}
        style={{
          display: "block",
          margin: "1rem auto",
          padding: "0.5rem 1rem",
          background: "transparent",
          border: "none",
          color: "var(--text-muted)",
        }}
      >
        Back
      </button>
    </main>
  );

  const renderQuestions = () => {
    const questionText =
      typeof question === "string"
        ? question
        : question?.text ||
          question?.question ||
          question?.prompt ||
          "Tell us a little more about this situation.";

    return (
      <main className="page-transition">
        <div className="verlo-header">
          <div className="verlo-brand">
            VERLO / QUESTION {Math.min(questionNumber + 1, MAX_QUESTIONS)}
          </div>

          <h1 className="verlo-title">Help Verlo understand.</h1>

          <p className="verlo-subtitle">
            The next question is based on what you have already told us.
          </p>
        </div>

        <div className="verlo-card">
          <div style={{ marginBottom: "1.5rem" }}>
            <div
              style={{
                height: "4px",
                width: "100%",
                overflow: "hidden",
                marginBottom: "1.5rem",
                background: "var(--border-subtle)",
                borderRadius: "999px",
              }}
            >
              <div
                style={{
                  width: `${Math.min(
                    ((answers.length + 1) / MAX_QUESTIONS) * 100,
                    100,
                  )}%`,
                  height: "100%",
                  background: "var(--accent)",
                  transition: "width 0.3s ease",
                }}
              />
            </div>

            <h2
              style={{
                marginBottom: "1rem",
                color: "var(--text-main)",
                fontSize: "1.35rem",
              }}
            >
              {questionText}
            </h2>

            {question?.context && (
              <p style={{ color: "var(--text-muted)" }}>{question.context}</p>
            )}
          </div>

          <div className="form-group">
            <textarea
              className="form-textarea"
              value={currentAnswer}
              onChange={(event) => setCurrentAnswer(event.target.value)}
              placeholder="Write your answer here..."
              disabled={loading}
              autoFocus
            />
          </div>

          {error && (
            <div
              style={{
                marginBottom: "1rem",
                padding: "0.75rem 1rem",
                border: "1px solid rgba(239, 68, 68, 0.35)",
                borderRadius: "8px",
                background: "rgba(239, 68, 68, 0.08)",
                color: "#fca5a5",
              }}
            >
              {error}
            </div>
          )}

          <button
            className="btn-primary"
            onClick={submitAnswer}
            disabled={loading}
          >
            {loading
              ? "Thinking..."
              : answers.length + 1 >= MAX_QUESTIONS
                ? "Finish"
                : "Continue"}
          </button>

          <button
            onClick={skipQuestion}
            disabled={loading}
            style={{
              display: "block",
              margin: "1rem auto 0",
              padding: "0.5rem 1rem",
              background: "transparent",
              border: "none",
              color: "var(--text-muted)",
            }}
          >
            Skip this question
          </button>
        </div>

        <button
          onClick={() => setPage("input")}
          disabled={loading}
          style={{
            display: "block",
            margin: "1rem auto",
            padding: "0.5rem 1rem",
            background: "transparent",
            border: "none",
            color: "var(--text-muted)",
          }}
        >
          Back
        </button>
      </main>
    );
  };

  const renderProcessing = () => (
    <main className="processing-container page-transition">
      <div className="verlo-brand">VERLO / ANALYSIS</div>

      <div className="processing-pulse-ring" />

      <h1 className="verlo-title">Working through your answers.</h1>

      <p className="verlo-subtitle">
        Verlo is putting the information together into a useful response.
      </p>

      <div className="processing-steps">
        {processingSteps.map((step, index) => {
          const isDone = index < processingStep;
          const isActive = index === processingStep;

          return (
            <div
              key={step}
              className={`step-item ${
                isDone ? "done" : ""
              } ${isActive ? "active" : ""}`}
            >
              <span>{step}</span>

              <span>{isDone ? "✓" : isActive ? "..." : "—"}</span>
            </div>
          );
        })}
      </div>
    </main>
  );

  const renderResults = () => {
    if (!result) {
      return null;
    }

    const situation =
      result.situation ||
      result.overview ||
      result.summary ||
      "No overview was provided.";

    const confidence =
      result.confidence || result.confidenceLevel || "Not specified";

    const riskAssessment =
      result.riskAssessment || result.risk || result.assessment;

    const nextSteps =
      result.nextSteps || result.actionSteps || result.actions || [];

    const personalizedPanels = result.personalizedPanels || result.panels || [];

    const draftTemplate =
      result.draftTemplate || result.letter || result.message || "";

    const resources = result.resources || [];

    const normaliseList = (value) => {
      if (Array.isArray(value)) {
        return value;
      }

      if (typeof value === "string") {
        return [value];
      }

      return [];
    };

    const steps = normaliseList(nextSteps);
    const panels = Array.isArray(personalizedPanels) ? personalizedPanels : [];

    const resourceList = normaliseList(resources);

    return (
      <main
        className="page-transition"
        style={{
          width: "100%",
          maxWidth: "1000px",
          margin: "0 auto",
        }}
      >
        <div className="verlo-header">
          <div className="verlo-brand">VERLO / RESULTS</div>

          <h1 className="verlo-title">Your personalised response.</h1>

          <p className="verlo-subtitle">
            This response is based on the situation and answers you provided.
          </p>
        </div>

        <div className="dominant-action">
          <span className="badge strong">PERSONALIZED</span>

          <h2>What Verlo found</h2>

          <p>{situation}</p>
        </div>

        <div className="grid-cols-2">
          <section className="result-section">
            <h2 style={{ marginBottom: "0.75rem" }}>Overview</h2>

            <p style={{ color: "var(--text-muted)" }}>{situation}</p>
          </section>

          <section className="result-section">
            <h2 style={{ marginBottom: "0.75rem" }}>Confidence</h2>

            <span className="badge strong">{String(confidence)}</span>

            {riskAssessment && (
              <p
                style={{
                  marginTop: "0.75rem",
                  color: "var(--text-muted)",
                }}
              >
                {typeof riskAssessment === "string"
                  ? riskAssessment
                  : JSON.stringify(riskAssessment)}
              </p>
            )}
          </section>
        </div>

        {panels.length > 0 && (
          <section className="result-section">
            <h2 style={{ marginBottom: "1rem" }}>Personalised insights</h2>

            <div className="grid-cols-2">
              {panels.map((panel, index) => {
                if (typeof panel === "string") {
                  return (
                    <div
                      key={index}
                      className="verlo-card"
                      style={{ marginBottom: 0 }}
                    >
                      <p>{panel}</p>
                    </div>
                  );
                }

                return (
                  <div
                    key={index}
                    className="verlo-card"
                    style={{ marginBottom: 0 }}
                  >
                    <h3 style={{ marginBottom: "0.5rem" }}>
                      {panel.title || panel.heading || `Insight ${index + 1}`}
                    </h3>

                    <p style={{ color: "var(--text-muted)" }}>
                      {panel.description || panel.content || panel.text || ""}
                    </p>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {steps.length > 0 && (
          <section className="result-section">
            <h2 style={{ marginBottom: "1rem" }}>Action steps</h2>

            <ul>
              {steps.map((step, index) => (
                <li key={index}>
                  {typeof step === "string"
                    ? step
                    : step.text ||
                      step.action ||
                      step.description ||
                      JSON.stringify(step)}
                </li>
              ))}
            </ul>
          </section>
        )}

        {draftTemplate && (
          <section className="result-section">
            <h2 style={{ marginBottom: "1rem" }}>Draft</h2>

            <div
              style={{
                padding: "1rem",
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                borderRadius: "8px",
                color: "var(--text-muted)",
                whiteSpace: "pre-wrap",
              }}
            >
              {typeof draftTemplate === "string"
                ? draftTemplate
                : draftTemplate.text ||
                  draftTemplate.content ||
                  JSON.stringify(draftTemplate, null, 2)}
            </div>
          </section>
        )}

        {resourceList.length > 0 && (
          <section className="result-section">
            <h2 style={{ marginBottom: "1rem" }}>Resources</h2>

            <ul>
              {resourceList.map((resource, index) => (
                <li key={index}>
                  {typeof resource === "string"
                    ? resource
                    : resource.title ||
                      resource.name ||
                      resource.url ||
                      JSON.stringify(resource)}
                </li>
              ))}
            </ul>
          </section>
        )}

        <div
          style={{
            display: "flex",
            gap: "0.75rem",
            flexWrap: "wrap",
            marginTop: "1.5rem",
          }}
        >
          <button
            className="btn-primary"
            style={{ flex: "1 1 240px" }}
            onClick={resetApp}
          >
            Start another assessment
          </button>
        </div>
      </main>
    );
  };

  return (
    <div
      style={{
        width: "100%",
        maxWidth: "1100px",
        minHeight: "100vh",
        margin: "0 auto",
        padding: "3rem 1.25rem",
      }}
    >
      {page !== "home" && page !== "processing" && (
        <button
          onClick={handleBack}
          style={{
            position: "fixed",
            top: "1.25rem",
            left: "1.25rem",
            zIndex: 20,
            padding: "0.5rem 0.75rem",
            background: "rgba(14, 20, 18, 0.9)",
            border: "1px solid var(--border-subtle)",
            borderRadius: "8px",
            color: "var(--text-muted)",
            backdropFilter: "blur(10px)",
          }}
        >
          ← Back
        </button>
      )}

      {page === "home" && renderHome()}
      {page === "input" && renderInput()}
      {page === "questions" && renderQuestions()}
      {page === "processing" && renderProcessing()}
      {page === "results" && renderResults()}
    </div>
  );
}

export default App;


