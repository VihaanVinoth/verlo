import React, { useEffect, useState } from "react";

const API_URL =
  import.meta.env.VITE_API_URL || "https://verlo-30xs.onrender.com";

const MAX_ADAPTIVE_QUESTIONS = 6;
const MIN_WORDS = 5;

const processingSteps = [
  "Deciphering core strategic goals...",
  "Screening through moderation & safety filters...",
  "Evaluating risk severity & exposure metrics...",
  "Synthesising customised action pathway...",
  "Finalising recommendations...",
];

const tabs = [
  ["overview", "Overview"],
  ["panels", "Panels"],
  ["steps", "Action Steps"],
  ["letter", "Letter"],
  ["resources", "Resources"],
];

export default function App() {
  const [step, setStep] = useState("landing");

  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [userContext, setUserContext] = useState("");

  const [assessmentData, setAssessmentData] = useState({
    adaptiveQuestions: [],
  });

  const [selectedMcqAnswers, setSelectedMcqAnswers] = useState({});
  const [adaptiveTextAnswers, setAdaptiveTextAnswers] = useState({});
  const [activeAssessmentIndex, setActiveAssessmentIndex] = useState(0);

  const [isAdaptiveLoading, setIsAdaptiveLoading] = useState(false);
  const [adaptiveQuestionCount, setAdaptiveQuestionCount] = useState(0);

  const [assessmentAttachment, setAssessmentAttachment] = useState(null);
  const [chatAttachment, setChatAttachment] = useState(null);

  const [analysisData, setAnalysisData] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  const [processingStage, setProcessingStage] = useState(0);
  const [error, setError] = useState(null);

  const [copied, setCopied] = useState(false);
  const [copyCount, setCopyCount] = useState(0);

  const [customAlert, setCustomAlert] = useState(null);
  const [alertExiting, setAlertExiting] = useState(false);

  const [chatQuestion, setChatQuestion] = useState("");
  const [chatHistory, setChatHistory] = useState([]);
  const [isChatLoading, setIsChatLoading] = useState(false);

  const [currentUser, setCurrentUser] = useState(null);

  const [showAuthModal, setShowAuthModal] = useState(false);
  const [authMode, setAuthMode] = useState("login");
  const [authEmail, setAuthEmail] = useState("");
  const [authPassword, setAuthPassword] = useState("");
  const [authError, setAuthError] = useState(null);
  const [isAuthLoading, setIsAuthLoading] = useState(false);

  const [userHistory, setUserHistory] = useState([]);
  const [showHistoryDrawer, setShowHistoryDrawer] = useState(false);

  const wordCount = description.trim()
    ? description.trim().split(/\s+/).length
    : 0;

  /*
   * --------------------------------------------------
   * CUSTOM ALERT
   * --------------------------------------------------
   */

  const triggerCustomAlert = (message, type = "success") => {
    setCustomAlert({
      message,
      type,
    });

    setAlertExiting(false);

    setTimeout(() => {
      setAlertExiting(true);

      setTimeout(() => {
        setCustomAlert(null);
        setAlertExiting(false);
      }, 300);
    }, 3300);
  };

  /*
   * --------------------------------------------------
   * RESTORE COOKIE SESSION
   *
   * The new server uses an HttpOnly cookie:
   *
   * Google
   *   ↓
   * backend callback
   *   ↓
   * HttpOnly verlo_token cookie
   *   ↓
   * redirect to frontend
   *   ↓
   * /api/auth/me
   * --------------------------------------------------
   */

  useEffect(() => {
    const restoreSession = async () => {
      setIsAuthLoading(true);

      try {
        const res = await fetch(
          `${API_URL}/api/auth/me`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

        if (!res.ok) {
          setCurrentUser(null);
          return;
        }

        const data = await res.json();

        if (data?.success && data?.user) {
          setCurrentUser(data.user);
        } else {
          setCurrentUser(null);
        }
      } catch (err) {
        console.error(
          "[VERLO] Session restore failed:",
          err
        );

        setCurrentUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    restoreSession();
  }, []);

  /*
   * --------------------------------------------------
   * CLEAN GOOGLE OAUTH URL
   * --------------------------------------------------
   */

  useEffect(() => {
    const params = new URLSearchParams(
      window.location.search
    );

    const authErrorFromUrl =
      params.get("auth_error");

    if (authErrorFromUrl) {
      console.error(
        "[VERLO] Google OAuth error:",
        authErrorFromUrl
      );

      setAuthError(
        "Google sign-in failed. Please try again."
      );

      setAuthMode("login");
      setShowAuthModal(true);

      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );

      return;
    }

    /*
     * The new OAuth flow does NOT use auth_code.
     *
     * If Google successfully authenticates,
     * the backend sets the HttpOnly cookie and
     * redirects here.
     *
     * Remove any unexpected query parameters.
     */

    if (window.location.search) {
      window.history.replaceState(
        {},
        document.title,
        window.location.pathname
      );
    }
  }, []);

  /*
   * --------------------------------------------------
   * LOAD HISTORY
   * --------------------------------------------------
   */

  useEffect(() => {
    if (!currentUser) {
      setUserHistory([]);
      return;
    }

    const loadHistory = async () => {
      try {
        const res = await fetch(
          `${API_URL}/api/history`,
          {
            method: "GET",
            credentials: "include",
            headers: {
              Accept: "application/json",
            },
          }
        );

        const data = await res.json();

        if (!res.ok) {
          throw new Error(
            data.error ||
              "Could not load history."
          );
        }

        setUserHistory(
          data.history || []
        );
      } catch (err) {
        console.error(
          "[VERLO] Failed to load history:",
          err
        );
      }
    };

    loadHistory();
  }, [currentUser]);

  /*
   * --------------------------------------------------
   * CUSTOM AUTH FETCH HELPER
   * --------------------------------------------------
   */

  const authenticatedFetch = async (
    url,
    options = {}
  ) => {
    return fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.headers || {}),
      },
    });
  };

  /*
   * --------------------------------------------------
   * MARKDOWN
   * --------------------------------------------------
   */

  const renderMarkdownToHTML = (content) => {
    if (!content) {
      return "";
    }

    let html = String(content)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    html = html.replace(
      /```([\s\S]*?)```/g,
      '<pre class="markdown-code"><code>$1</code></pre>'
    );

    html = html.replace(
      /\*\*(.*?)\*\*/g,
      "<strong>$1</strong>"
    );

    html = html.replace(
      /\[([^\]]+)\]\((https?:\/\/[^\)]+)\)/g,
      '<a href="$2" target="_blank" rel="noopener noreferrer" class="markdown-link">$1</a>'
    );

    const lines = html.split("\n");
    let inList = false;

    const output = lines.map((line) => {
      if (
        line.trim().startsWith("- ") ||
        line.trim().startsWith("* ")
      ) {
        const item = line.trim().substring(2);

        if (!inList) {
          inList = true;

          return `<ul class="markdown-list"><li>${item}</li>`;
        }

        return `<li>${item}</li>`;
      }

      if (inList) {
        inList = false;

        return `</ul><p>${line}</p>`;
      }

      return line.trim()
        ? `<p>${line}</p>`
        : "";
    });

    if (inList) {
      output.push("</ul>");
    }

    return output.join("");
  };

  /*
   * --------------------------------------------------
   * EXAMPLE SITUATIONS
   * --------------------------------------------------
   */

  const handleExampleSelect = (
    exampleTitle,
    desc,
    context
  ) => {
    setTitle(exampleTitle);
    setDescription(desc);
    setUserContext(context);

    setStep("input");
    setError(null);
  };

  /*
   * --------------------------------------------------
   * GOOGLE LOGIN
   * --------------------------------------------------
   */

  const handleGoogleLogin = () => {
    setAuthError(null);
    setIsAuthLoading(true);

    console.log(
      "[VERLO] Starting Google login..."
    );

    window.location.href =
      `${API_URL}/api/auth/google`;
  };

  /*
   * --------------------------------------------------
   * EMAIL AUTH
   * --------------------------------------------------
   */

  const handleAuthSubmit = async (e) => {
    e.preventDefault();

    setAuthError(null);
    setIsAuthLoading(true);

    const endpoint =
      authMode === "login"
        ? "/api/auth/login"
        : "/api/auth/signup";

    try {
      const res = await fetch(
        `${API_URL}${endpoint}`,
        {
          method: "POST",

          credentials: "include",

          headers: {
            "Content-Type":
              "application/json",
          },

          body: JSON.stringify({
            email: authEmail.trim(),
            password: authPassword,
          }),
        }
      );

      const data = await res.json();

      if (!res.ok) {
        const message =
          String(
            data.error || ""
          ).toLowerCase();

        if (
          authMode === "signup" &&
          (
            res.status === 409 ||
            message.includes("already") ||
            message.includes("exist") ||
            message.includes("registered")
          )
        ) {
          throw new Error(
            "This email address is already registered. Please log in instead."
          );
        }

        throw new Error(
          data.error ||
            "Authentication failed."
        );
      }

      if (!data.user) {
        throw new Error(
          "The server did not return your account information."
        );
      }

      setCurrentUser(data.user);

      setShowAuthModal(false);

      setAuthEmail("");
      setAuthPassword("");
      setAuthError(null);

      triggerCustomAlert(
        authMode === "signup"
          ? "Account created successfully!"
          : "Logged in successfully!"
      );
    } catch (err) {
      setAuthError(
        err.message ||
          "Authentication failed."
      );
    } finally {
      setIsAuthLoading(false);
    }
  };

  /*
   * --------------------------------------------------
   * LOGOUT
   * --------------------------------------------------
   */

  const handleLogout = async () => {
    try {
      await fetch(
        `${API_URL}/api/auth/logout`,
        {
          method: "POST",
          credentials: "include",
        }
      );
    } catch (err) {
      console.error(
        "[VERLO] Logout request failed:",
        err
      );
    }

    setCurrentUser(null);
    setUserHistory([]);
    setShowHistoryDrawer(false);
    setStep("landing");

    triggerCustomAlert(
      "Logged out successfully."
    );
  };

  /*
   * --------------------------------------------------
   * SAVE HISTORY
   * --------------------------------------------------
   */

  const handleSaveToAccount = async (
    resultData
  ) => {
    if (!currentUser) {
      setAuthMode("login");
      setAuthError(null);
      setShowAuthModal(true);
      return;
    }

    try {
      const res =
        await authenticatedFetch(
          `${API_URL}/api/history/save`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              report: {
                title:
                  title ||
                  "Untitled Report",

                description,

                result: resultData,
              },
            }),
          }
        );

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setCurrentUser(null);
          setAuthMode("login");
          setAuthError(
            "Your login session has expired. Please log in again."
          );
          setShowAuthModal(true);
          return;
        }

        throw new Error(
          data.error ||
            "Could not save pathway."
        );
      }

      setUserHistory(
        data.history || []
      );

      triggerCustomAlert(
        "Pathway saved successfully to your account history!"
      );
    } catch (err) {
      console.error(
        "[VERLO] Failed to save history:",
        err
      );

      triggerCustomAlert(
        "Error saving pathway to account history.",
        "error"
      );
    }
  };

  /*
   * --------------------------------------------------
   * FILE ATTACHMENTS
   * --------------------------------------------------
   */

  const handleSecureFileUpload = async (
    file,
    target
  ) => {
    if (!file) {
      return;
    }

    if (
      file.size >
      15 * 1024 * 1024
    ) {
      triggerCustomAlert(
        "File exceeds maximum size limit (15MB).",
        "error"
      );

      return;
    }

    try {
      triggerCustomAlert(
        "Attaching file..."
      );

      await new Promise(
        (resolve) =>
          setTimeout(
            resolve,
            500
          )
      );

      const fileMeta = {
        name: file.name,

        size: `${(
          file.size / 1024
        ).toFixed(1)} KB`,

        type:
          file.type ||
          "application/octet-stream",

        uploadedAt:
          new Date().toISOString(),
      };

      if (target === "assessment") {
        setAssessmentAttachment(
          fileMeta
        );

        triggerCustomAlert(
          `File "${file.name}" attached to assessment context.`
        );
      }

      if (target === "chat") {
        setChatAttachment(
          fileMeta
        );

        triggerCustomAlert(
          `File "${file.name}" attached to chat prompt.`
        );
      }
    } catch {
      triggerCustomAlert(
        "Failed to attach file.",
        "error"
      );
    }
  };

  const removeAttachment = (
    target
  ) => {
    if (target === "assessment") {
      setAssessmentAttachment(null);

      triggerCustomAlert(
        "Assessment attachment removed."
      );
    }

    if (target === "chat") {
      setChatAttachment(null);

      triggerCustomAlert(
        "Chat attachment removed."
      );
    }
  };

  /*
   * --------------------------------------------------
   * NORMALISE ADAPTIVE QUESTIONS
   * --------------------------------------------------
   */

  const getAllAssessmentItems = () => {
    const source =
      assessmentData?.adaptiveQuestions ||
      assessmentData?.adaptive_questions ||
      assessmentData?.questions ||
      [];

    if (!Array.isArray(source)) {
      return [];
    }

    return source.map(
      (item, index) => ({
        type:
          item.type === "mcq"
            ? "mcq"
            : "text",

        ...item,

        id:
          item.id ||
          item.questionId ||
          `adaptive-${index}`,

        question:
          item.question ||
          item.text ||
          item.prompt ||
          item.stem ||
          "Please provide more information.",

        stem:
          item.stem ||
          item.question ||
          item.text ||
          item.prompt ||
          "Please choose an option.",

        choices:
          Array.isArray(
            item.choices
          )
            ? item.choices
            : [],
      })
    );
  };

  const assessmentItems =
    getAllAssessmentItems();

  /*
   * --------------------------------------------------
   * BUILD ANSWERS
   * --------------------------------------------------
   */

  const buildAllAnswers = (
    key,
    value
  ) => ({
    ...adaptiveTextAnswers,

    ...selectedMcqAnswers,

    ...(key !== undefined
      ? {
          [key]: value,
        }
      : {}),
  });

  /*
   * --------------------------------------------------
   * REQUEST NEXT ADAPTIVE QUESTION
   * --------------------------------------------------
   */

  const requestAdaptiveQuestion =
    async (
      previousAnswers = {}
    ) => {
      if (
        isAdaptiveLoading ||
        adaptiveQuestionCount >=
          MAX_ADAPTIVE_QUESTIONS
      ) {
        return null;
      }

      setIsAdaptiveLoading(true);
      setError(null);

      try {
        const questionNumber =
          adaptiveQuestionCount + 1;

        const res = await fetch(
          `${API_URL}/api/adaptive-question`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              title,
              description,
              context: userContext,
              previousAnswers,
              questionNumber,
              maxQuestions:
                MAX_ADAPTIVE_QUESTIONS,
            }),
          }
        );

        const result =
          await res.json();

        if (!res.ok) {
          throw new Error(
            result.error ||
              "Could not generate the adaptive question."
          );
        }

        if (!result.question) {
          throw new Error(
            "The adaptive engine returned no question."
          );
        }

        const questions = [
          ...getAllAssessmentItems(),
          result.question,
        ];

        setAssessmentData({
          adaptiveQuestions:
            questions,
        });

        setAdaptiveQuestionCount(
          questions.length
        );

        setActiveAssessmentIndex(
          questions.length - 1
        );

        setStep("assessment");

        return result.question;
      } catch (err) {
        setError(
          err.message ||
            "Could not generate the next adaptive question."
        );

        return null;
      } finally {
        setIsAdaptiveLoading(false);
      }
    };

  /*
   * --------------------------------------------------
   * FIRST SUBMISSION
   * --------------------------------------------------
   */

  const handleInitialSubmit =
    async (e) => {
      e.preventDefault();

      if (wordCount < MIN_WORDS) {
        setError(
          `Please provide a bit more detail (at least ${MIN_WORDS} words) so VERLO can build a reliable pathway.`
        );

        return;
      }

      setError(null);
      setStep("processing");
      setProcessingStage(0);

      setAssessmentData({
        adaptiveQuestions: [],
      });

      setSelectedMcqAnswers({});
      setAdaptiveTextAnswers({});
      setActiveAssessmentIndex(0);
      setAdaptiveQuestionCount(0);

      let currentStage = 0;

      const interval =
        setInterval(() => {
          currentStage += 1;

          if (
            currentStage <
            processingSteps.length
          ) {
            setProcessingStage(
              currentStage
            );
          }
        }, 550);

      try {
        await new Promise(
          (resolve) =>
            setTimeout(
              resolve,
              1800
            )
        );

        const res = await fetch(
          `${API_URL}/api/adaptive-question`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              title,
              description,
              context: userContext,
              previousAnswers: {},
              questionNumber: 1,
              maxQuestions:
                MAX_ADAPTIVE_QUESTIONS,
            }),
          }
        );

        const result =
          await res.json();

        if (!res.ok) {
          throw new Error(
            result.error ||
              "Adaptive engine failed to create the first question."
          );
        }

        if (!result.question) {
          throw new Error(
            "The adaptive engine returned no first question."
          );
        }

        setAssessmentData({
          adaptiveQuestions: [
            result.question,
          ],
        });

        setAdaptiveQuestionCount(1);
        setActiveAssessmentIndex(0);
        setStep("assessment");
      } catch (err) {
        setError(
          err.message ||
            "Could not connect to the adaptive engine."
        );

        setStep("input");
      } finally {
        clearInterval(interval);
      }
    };

  /*
   * --------------------------------------------------
   * CURRENT ANSWER
   * --------------------------------------------------
   */

  const getCurrentAnswer = () => {
    const item =
      assessmentItems[
        activeAssessmentIndex
      ];

    if (!item) {
      return "";
    }

    const key =
      item.id ||
      activeAssessmentIndex;

    if (item.type === "mcq") {
      return (
        selectedMcqAnswers[key] ||
        ""
      );
    }

    return (
      adaptiveTextAnswers[key] ||
      ""
    );
  };

  /*
   * --------------------------------------------------
   * NEXT ASSESSMENT QUESTION
   * --------------------------------------------------
   */

  const handleAssessmentNext =
    async () => {
      const item =
        assessmentItems[
          activeAssessmentIndex
        ];

      if (
        !item ||
        isAdaptiveLoading
      ) {
        return;
      }

      const answer =
        getCurrentAnswer();

      if (
        !String(answer).trim()
      ) {
        triggerCustomAlert(
          "Please answer this question before continuing.",
          "error"
        );

        return;
      }

      const key =
        item.id ||
        activeAssessmentIndex;

      if (item.type === "mcq") {
        setSelectedMcqAnswers(
          (prev) => ({
            ...prev,
            [key]: answer,
          })
        );
      } else {
        setAdaptiveTextAnswers(
          (prev) => ({
            ...prev,
            [key]: answer,
          })
        );
      }

      const allAnswers =
        buildAllAnswers(
          key,
          answer
        );

      if (
        adaptiveQuestionCount >=
        MAX_ADAPTIVE_QUESTIONS
      ) {
        await handleFinalAssessmentSubmit(
          allAnswers
        );

        return;
      }

      await requestAdaptiveQuestion(
        allAnswers
      );
    };

  /*
   * --------------------------------------------------
   * PREVIOUS ASSESSMENT QUESTION
   * --------------------------------------------------
   */

  const handleAssessmentPrev =
    () => {
      if (isAdaptiveLoading) {
        return;
      }

      if (
        activeAssessmentIndex >
        0
      ) {
        setActiveAssessmentIndex(
          (prev) => prev - 1
        );
      } else {
        setStep("input");
      }
    };

  /*
   * --------------------------------------------------
   * FINAL ANALYSIS
   * --------------------------------------------------
   */

  const handleFinalAssessmentSubmit =
    async (
      answersOverride = null
    ) => {
      setStep("processing");
      setProcessingStage(0);

      const finalAnswers =
        answersOverride ||
        buildAllAnswers();

      let currentStage = 0;

      const interval =
        setInterval(() => {
          currentStage += 1;

          if (
            currentStage <
            processingSteps.length
          ) {
            setProcessingStage(
              currentStage
            );
          }
        }, 700);

      try {
        const [res] =
          await Promise.all([
            fetch(
              `${API_URL}/api/analyze`,
              {
                method: "POST",

                headers: {
                  "Content-Type":
                    "application/json",
                },

                body: JSON.stringify({
                  title,

                  prompt:
                    description,

                  category:
                    title ||
                    "General",

                  context:
                    userContext,

                  answers:
                    JSON.stringify(
                      finalAnswers
                    ),

                  attachment:
                    assessmentAttachment,
                }),
              }
            ),

            new Promise(
              (resolve) =>
                setTimeout(
                  resolve,
                  processingSteps.length *
                    700
                )
            ),
          ]);

        const result =
          await res.json();

        if (!res.ok) {
          throw new Error(
            result.error ||
              "Failed to compute final diagnostic pathway."
          );
        }

        let finalData =
          result.result ||
          result.data;

        if (
          !finalData &&
          result.analysis
        ) {
          try {
            finalData =
              JSON.parse(
                result.analysis
              );
          } catch {
            finalData = {
              situation:
                result.analysis,

              confidence:
                "Moderate",

              riskAssessment: {
                severityScore:
                  "N/A",

                financialExposure:
                  "Not established",

                timeSensitivity:
                  "Review required",
              },

              nextSteps: [],

              personalizedPanels:
                [],

              draftTemplate:
                null,

              resources: [],

              referenceLinks: [],
            };
          }
        }

        if (!finalData) {
          throw new Error(
            "The server returned no analysis."
          );
        }

        if (
          !finalData.referenceLinks &&
          Array.isArray(
            finalData.resources
          )
        ) {
          finalData.referenceLinks =
            finalData.resources;
        }

        setAnalysisData(finalData);
        setChatHistory([]);
        setActiveTab("overview");
        setStep("results");
      } catch (err) {
        setError(
          err.message ||
            "Could not connect to the server."
        );

        setStep("assessment");
      } finally {
        clearInterval(interval);
      }
    };

  /*
   * --------------------------------------------------
   * COPY LETTER
   * --------------------------------------------------
   */

  const handleCopyDraft = () => {
    if (
      !analysisData?.draftTemplate
    ) {
      return;
    }

    const draft =
      analysisData.draftTemplate;

    navigator.clipboard.writeText(
      `To: ${draft.recipient}\nSubject: ${draft.subject}\n\n${draft.body}`
    );

    setCopied(true);

    const nextCount =
      copyCount + 1;

    setCopyCount(nextCount);

    triggerCustomAlert(
      nextCount === 1
        ? "Letter template copied to clipboard!"
        : `Letter copied (${nextCount}x multi-strike!)! 🎯`
    );

    setTimeout(
      () => setCopied(false),
      3000
    );
  };

  /*
   * --------------------------------------------------
   * CHAT
   * --------------------------------------------------
   */

  const handleChatSubmit =
    async (e) => {
      e.preventDefault();

      if (
        (
          !chatQuestion.trim() &&
          !chatAttachment
        ) ||
        isChatLoading
      ) {
        return;
      }

      const questionText =
        chatQuestion.trim() ||
        `[Uploaded file: ${chatAttachment.name}]`;

      const currentAttachment =
        chatAttachment;

      setChatQuestion("");
      setChatAttachment(null);
      setIsChatLoading(true);

      const newHistory = [
        ...chatHistory,

        {
          role: "user",
          content: questionText,
          attachment:
            currentAttachment,
        },
      ];

      setChatHistory(newHistory);

      try {
        const res = await fetch(
          `${API_URL}/api/chat`,
          {
            method: "POST",

            headers: {
              "Content-Type":
                "application/json",
            },

            body: JSON.stringify({
              question:
                questionText,

              currentSituation:
                description ||
                title,

              attachment:
                currentAttachment,
            }),
          }
        );

        const data =
          await res.json();

        if (!res.ok) {
          throw new Error(
            data.error ||
              "Failed to get chat response."
          );
        }

        setChatHistory([
          ...newHistory,

          {
            role: "assistant",
            content: data.reply,
          },
        ]);
      } catch (err) {
        setChatHistory([
          ...newHistory,

          {
            role: "assistant",

            content:
              `⚠️ Error: ${err.message}`,
          },
        ]);
      } finally {
        setIsChatLoading(false);
      }
    };

  const currentAssessmentItem =
    assessmentItems[
      activeAssessmentIndex
    ];

  /*
   * --------------------------------------------------
   * RENDER
   * --------------------------------------------------
   */

  return (
    <div className="verlo-app">
      {customAlert && (
        <div
          className={`custom-alert ${customAlert.type} ${
            alertExiting
              ? "exiting"
              : ""
          }`}
        >
          <span>
            {customAlert.type ===
            "error"
              ? "⚠️"
              : "✓"}
          </span>

          <span>
            {customAlert.message}
          </span>
        </div>
      )}

      <header className="verlo-nav">
        <div
          className="verlo-logo"
          onClick={() =>
            setStep("landing")
          }
        >
          <img
            src="/VVNormal.png"
            alt="VERLO Logo"
          />

          <span>VERLO</span>
        </div>

        {currentUser ? (
          <div className="user-nav">
            <button
              type="button"
              onClick={() =>
                setShowHistoryDrawer(
                  !showHistoryDrawer
                )
              }
            >
              <span>▣</span>{" "}
              History (
              {userHistory.length})
            </button>

            {currentUser.picture && (
              <img
                src={
                  currentUser.picture
                }
                alt=""
                className="user-avatar"
              />
            )}

            <span>
              {currentUser.name ||
                currentUser.email ||
                currentUser.id}
            </span>

            <button
              type="button"
              className="logout-button"
              onClick={
                handleLogout
              }
            >
              Logout
            </button>
          </div>
        ) : (
          <button
            type="button"
            className="login-button"
            onClick={() => {
              setAuthMode("login");
              setAuthError(null);
              setShowAuthModal(true);
            }}
          >
            Login / Signup
          </button>
        )}
      </header>

      <main className="verlo-main">
        {step === "landing" && (
          <section className="page-transition landing-page">
            <div className="verlo-header">
              <div className="landing-logo">
                <img
                  src="/VVNormal.png"
                  alt="VERLO Logo"
                />

                <span className="verlo-brand">
                  VERLO
                </span>
              </div>

              <h1 className="verlo-title">
                Stop guessing. Know
                your exact next step.
              </h1>

              <p className="verlo-subtitle">
                Verlo is an adaptive
                supercharged
                decision-intelligence
                engine that transforms
                messy, stressful
                situations into a fully
                tailored, risk-scored
                action pathway through
                dynamic profiling.
              </p>

              <button
                className="btn-primary launch-button"
                onClick={() =>
                  setStep("input")
                }
              >
                Launch Decision
                Engine →
              </button>

              <div className="example-section">
                <p className="example-label">
                  Test common VERLO
                  scenarios:
                </p>

                <div className="example-grid">
                  <div
                    className="verlo-card example-card"
                    onClick={() =>
                      handleExampleSelect(
                        "Flight cancelled at gate",

                        "My international flight was abruptly cancelled at the boarding gate due to mechanical failure. The airline desk agent says the earliest they can rebook me is in 48 hours, and they are refusing to cover hotel accommodations for the night despite my connecting ticket.",

                        "Travelling on a strict budget for an important family event"
                      )
                    }
                  >
                    <span className="example-icon">
                      ✈
                    </span>

                    <div>
                      <strong>
                        Flight cancelled
                        at gate
                      </strong>{" "}
                      — Airline refusing
                      overnight hotel
                      voucher.
                    </div>
                  </div>

                  <div
                    className="verlo-card example-card"
                    onClick={() =>
                      handleExampleSelect(
                        "Unresolved billing charge",

                        "I noticed an unexpected $450 charge on my credit card from a software enterprise subscription that I explicitly cancelled three months ago in writing. Support is ignoring my emails and chat tickets.",

                        "Freelancer relying on tight monthly cash flow"
                      )
                    }
                  >
                    <span className="example-icon">
                      ▣
                    </span>

                    <div>
                      <strong>
                        Unresolved
                        billing dispute
                      </strong>{" "}
                      — Subscription charged
                      post-cancellation.
                    </div>
                  </div>

                  <div
                    className="verlo-card example-card"
                    onClick={() =>
                      handleExampleSelect(
                        "Landlord withholding bond",

                        "My tenancy agreement ended 3 weeks ago and my landlord is refusing to release my full $2,000 security deposit, claiming minor carpet scuffs that were already present when I moved in as documented on my condition report.",

                        "First-time renter moving into a new apartment"
                      )
                    }
                  >
                    <span className="example-icon">
                      ⌂
                    </span>

                    <div>
                      <strong>
                        Landlord
                        withholding bond
                      </strong>{" "}
                      — Disputing false
                      wear-and-tear
                      deductions.
                    </div>
                  </div>

                  <div
                    className="verlo-card example-card"
                    onClick={() =>
                      handleExampleSelect(
                        "Defective laptop warranty dispute",

                        "I purchased a high-end laptop 5 months ago that has suffered multiple motherboard failures. The manufacturer service center is claiming accidental liquid damage violation even though the machine has never been exposed to liquids.",

                        "Student relying on laptop for coursework"
                      )
                    }
                  >
                    <span className="example-icon">
                      ▣
                    </span>

                    <div>
                      <strong>
                        Defective laptop
                        warranty
                      </strong>{" "}
                      — Manufacturer
                      denying warranty
                      repair unfairly.
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>
        )}

        {step === "input" && (
          <section className="page-transition input-page">
            <div className="content-narrow">
              <button
                className="secondary-button"
                onClick={() =>
                  setStep("landing")
                }
              >
                ← Back to Overview
              </button>

              <div className="verlo-header">
                <div className="landing-logo">
                  <img
                    src="/VVNormal.png"
                    alt="VERLO Logo"
                  />

                  <span className="verlo-brand">
                    VERLO
                  </span>
                </div>

                <h2 className="verlo-title">
                  Define Your
                  Situation
                </h2>

                <p className="verlo-subtitle">
                  Provide the details
                  below. Our adaptive
                  engine will formulate
                  custom probing
                  questions before
                  constructing your
                  report.
                </p>
              </div>

              {error && (
                <div className="error-message">
                  {error}
                </div>
              )}

              <form
                onSubmit={
                  handleInitialSubmit
                }
                className="verlo-card situation-form"
              >
                <div className="form-group">
                  <label className="form-label">
                    Situation Title
                    (Optional)
                  </label>

                  <input
                    className="form-input"
                    placeholder="e.g., Landlord deposit dispute"
                    value={title}
                    onChange={(e) =>
                      setTitle(
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <div className="field-header">
                    <label className="form-label">
                      Describe what
                      happened *
                    </label>

                    <span
                      className={
                        wordCount <
                        MIN_WORDS
                          ? "word-count warning"
                          : "word-count"
                      }
                    >
                      {wordCount} words{" "}
                      {wordCount <
                      MIN_WORDS
                        ? `(Minimum ${MIN_WORDS} required)`
                        : "✓"}
                    </span>
                  </div>

                  <textarea
                    className="form-textarea"
                    placeholder="Include key details: dates, amounts, communications, and what outcome you are looking for..."
                    value={description}
                    onChange={(e) =>
                      setDescription(
                        e.target.value
                      )
                    }
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Any specific
                    personal context or
                    constraints?
                    (Optional)
                  </label>

                  <input
                    className="form-input"
                    placeholder="e.g., I'm a student living on a tight budget"
                    value={userContext}
                    onChange={(e) =>
                      setUserContext(
                        e.target.value
                      )
                    }
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Attach Evidence /
                    Files / Media
                    (Optional)
                  </label>

                  <label className="file-button">
                    Browse File / Media

                    <input
                      type="file"
                      hidden
                      onChange={(e) =>
                        handleSecureFileUpload(
                          e.target.files?.[0],
                          "assessment"
                        )
                      }
                    />
                  </label>

                  <span className="file-note">
                    Attached locally for
                    this assessment.
                    Maximum 15MB.
                  </span>

                  {assessmentAttachment && (
                    <div className="attachment">
                      <span>
                        📎{" "}
                        {
                          assessmentAttachment.name
                        }{" "}
                        (
                        {
                          assessmentAttachment.size
                        }
                        )
                      </span>

                      <button
                        type="button"
                        onClick={() =>
                          removeAttachment(
                            "assessment"
                          )
                        }
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <button
                  type="submit"
                  className="btn-primary full-width"
                >
                  Generate Adaptive
                  Assessment →
                </button>
              </form>
            </div>
          </section>
        )}

        {step === "assessment" &&
          currentAssessmentItem && (
            <section className="page-transition animate-fade-slide-up assessment-page">
              <div className="content-narrow">
                <div className="assessment-top">
                  <button
                    className="secondary-button"
                    onClick={
                      handleAssessmentPrev
                    }
                  >
                    ← Back
                  </button>

                  <span>
                    Question{" "}
                    {activeAssessmentIndex +
                      1}{" "}
                    of{" "}
                    {MAX_ADAPTIVE_QUESTIONS}
                    <b>
                      {" "}
                      • adaptive
                    </b>
                  </span>
                </div>

                <div className="progress-bar">
                  <div
                    className="progress-fill"
                    style={{
                      width: `${Math.min(
                        ((activeAssessmentIndex +
                          1) /
                          MAX_ADAPTIVE_QUESTIONS) *
                          100,
                        100
                      )}%`,
                    }}
                  />
                </div>

                <div className="verlo-header assessment-header">
                  <h2 className="verlo-title">
                    Refine Your
                    Parameters
                  </h2>

                  <p className="verlo-subtitle">
                    Answering these custom
                    inquiries ensures your
                    final action pathway is
                    laser-focused.
                  </p>
                </div>

                <div className="verlo-card assessment-card">
                  {isAdaptiveLoading ? (
                    <div className="adaptive-loading">
                      <div className="processing-pulse-ring" />

                      <strong>
                        Adapting the next
                        question...
                      </strong>

                      <span>
                        VERLO is using your
                        previous answer to
                        decide what matters
                        next.
                      </span>
                    </div>
                  ) : currentAssessmentItem.type ===
                    "mcq" ? (
                    <div>
                      <label className="form-label question-label">
                        {
                          currentAssessmentItem.stem
                        }
                      </label>

                      <div className="choice-grid">
                        {currentAssessmentItem.choices.map(
                          (
                            choice,
                            index
                          ) => {
                            const key =
                              currentAssessmentItem.id ||
                              activeAssessmentIndex;

                            const selected =
                              selectedMcqAnswers[
                                key
                              ] ===
                              choice;

                            return (
                              <button
                                key={
                                  index
                                }
                                type="button"
                                className={`choice-button ${
                                  selected
                                    ? "selected"
                                    : ""
                                }`}
                                onClick={() =>
                                  setSelectedMcqAnswers(
                                    (
                                      prev
                                    ) => ({
                                      ...prev,
                                      [key]:
                                        choice,
                                    })
                                  )
                                }
                              >
                                <span className="choice-radio">
                                  {selected && (
                                    <span />
                                  )}
                                </span>

                                {choice}
                              </button>
                            );
                          }
                        )}
                      </div>
                    </div>
                  ) : (
                    <div>
                      <label className="form-label question-label">
                        {
                          currentAssessmentItem.question
                        }
                      </label>

                      <input
                        className="form-input question-input"
                        placeholder="Type your precise specification here and press Enter..."
                        value={
                          adaptiveTextAnswers[
                            currentAssessmentItem.id ||
                              activeAssessmentIndex
                          ] || ""
                        }
                        onChange={(e) =>
                          setAdaptiveTextAnswers(
                            (prev) => ({
                              ...prev,

                              [
                                currentAssessmentItem.id ||
                                  activeAssessmentIndex
                              ]: e.target
                                .value,
                            })
                          )
                        }
                        onKeyDown={(e) => {
                          if (
                            e.key ===
                              "Enter" &&
                            !isAdaptiveLoading
                          ) {
                            e.preventDefault();

                            handleAssessmentNext();
                          }
                        }}
                        autoFocus
                      />
                    </div>
                  )}
                </div>

                <div className="assessment-actions">
                  <button
                    className="btn-primary"
                    onClick={
                      handleAssessmentNext
                    }
                    disabled={
                      isAdaptiveLoading
                    }
                  >
                    {isAdaptiveLoading
                      ? "Adapting..."
                      : adaptiveQuestionCount >=
                          MAX_ADAPTIVE_QUESTIONS
                        ? "Synthesise Final Report →"
                        : "Next Question →"}
                  </button>
                </div>
              </div>
            </section>
          )}

        {step === "processing" && (
          <section className="page-transition processing-container processing-page">
            <div className="processing-pulse-ring" />

            <h2>
              Synthesising
              supercharged logic &
              links...
            </h2>

            <div className="processing-steps">
              {processingSteps.map(
                (text, index) => {
                  const done =
                    index <
                    processingStage;

                  const active =
                    index ===
                    processingStage;

                  return (
                    <div
                      key={text}
                      className={`step-item ${
                        active
                          ? "active"
                          : ""
                      } ${
                        done
                          ? "done"
                          : ""
                      }`}
                    >
                      <div className="step-content">
                        <span className="step-dot" />

                        <span>
                          {text}
                        </span>
                      </div>

                      <span className="step-status">
                        {done
                          ? "✓"
                          : active
                            ? "●"
                            : "○"}
                      </span>
                    </div>
                  );
                }
              )}
            </div>
          </section>
        )}

        {step === "results" &&
          analysisData && (
            <section className="page-transition animate-fade-slide-up results-page">
              <div className="results-container">
                <div className="results-toolbar">
                  <div>
                    <button
                      className="secondary-button"
                      onClick={() =>
                        setStep("input")
                      }
                    >
                      ← New Situation
                    </button>

                    <button
                      className="save-button"
                      onClick={() =>
                        handleSaveToAccount(
                          analysisData
                        )
                      }
                    >
                      💾 Save Pathway
                    </button>
                  </div>

                  <button
                    className="secondary-button"
                    onClick={() =>
                      setStep("landing")
                    }
                  >
                    Start Over
                  </button>
                </div>

                <div className="result-section result-summary">
                  <div>
                    <span
                      className={`badge ${
                        analysisData.confidence?.toLowerCase() ||
                        ""
                      }`}
                    >
                      Confidence:{" "}
                      {
                        analysisData.confidence
                      }
                    </span>

                    {userContext && (
                      <div className="result-context">
                        Tailored for:{" "}
                        <em>
                          "{userContext}"
                        </em>
                      </div>
                    )}
                  </div>

                  <div className="risk-metrics">
                    <div>
                      <span>
                        Severity:
                      </span>

                      <strong>
                        {
                          analysisData
                            .riskAssessment
                            ?.severityScore
                        }
                        /10
                      </strong>
                    </div>

                    <div>
                      <span>
                        Exposure:
                      </span>

                      <strong>
                        {
                          analysisData
                            .riskAssessment
                            ?.financialExposure
                        }
                      </strong>
                    </div>

                    <div>
                      <span>
                        Urgency:
                      </span>

                      <strong>
                        {
                          analysisData
                            .riskAssessment
                            ?.timeSensitivity
                        }
                      </strong>
                    </div>
                  </div>
                </div>

                <nav className="result-tabs">
                  {tabs.map(
                    ([id, label]) => (
                      <button
                        key={id}
                        className={
                          activeTab ===
                          id
                            ? "active"
                            : ""
                        }
                        onClick={() =>
                          setActiveTab(
                            id
                          )
                        }
                      >
                        {label}
                      </button>
                    )
                  )}
                </nav>

                {activeTab ===
                  "overview" && (
                  <div className="result-content">
                    <div className="dominant-action">
                      <h3>
                        Immediate
                        Priority Action
                      </h3>

                      <h2>
                        {
                          analysisData
                            .nextSteps?.[0]
                            ?.step
                        }
                      </h2>

                      <p>
                        <strong>
                          Why this first:
                        </strong>{" "}
                        {
                          analysisData
                            .nextSteps?.[0]
                            ?.why
                        }
                      </p>
                    </div>

                    {analysisData.situation && (
                      <div className="result-section">
                        <h3>
                          Situation
                          Summary
                        </h3>

                        <p>
                          {
                            analysisData.situation
                          }
                        </p>
                      </div>
                    )}

                    <div className="result-section assistant-section">
                      <h3>
                        Ask VERLO AI
                        Assistant
                      </h3>

                      <p>
                        Need immediate
                        clarification,
                        follow-up response,
                        or file attachment?
                      </p>

                      {chatHistory.length >
                        0 && (
                        <div className="chat-history">
                          {chatHistory.map(
                            (
                              msg,
                              index
                            ) => (
                              <div
                                key={
                                  index
                                }
                                className={`chat-message ${msg.role}`}
                              >
                                <strong>
                                  {msg.role ===
                                  "user"
                                    ? "You"
                                    : "VERLO AI"}
                                </strong>

                                {msg.attachment && (
                                  <small>
                                    📎 Attached
                                    file:{" "}
                                    {
                                      msg
                                        .attachment
                                        .name
                                    }
                                  </small>
                                )}

                                {msg.role ===
                                "user" ? (
                                  <div>
                                    {
                                      msg.content
                                    }
                                  </div>
                                ) : (
                                  <div
                                    dangerouslySetInnerHTML={{
                                      __html:
                                        renderMarkdownToHTML(
                                          msg.content
                                        ),
                                    }}
                                  />
                                )}
                              </div>
                            )
                          )}
                        </div>
                      )}

                      {chatAttachment && (
                        <div className="attachment">
                          <span>
                            📎{" "}
                            {
                              chatAttachment.name
                            }
                          </span>

                          <button
                            type="button"
                            onClick={() =>
                              removeAttachment(
                                "chat"
                              )
                            }
                          >
                            Remove
                          </button>
                        </div>
                      )}

                      <form
                        className="chat-form"
                        onSubmit={
                          handleChatSubmit
                        }
                      >
                        <input
                          className="form-input"
                          placeholder="Ask a question or upload file..."
                          value={
                            chatQuestion
                          }
                          onChange={(e) =>
                            setChatQuestion(
                              e.target
                                .value
                            )
                          }
                          disabled={
                            isChatLoading
                          }
                        />

                        <label className="chat-file-button">
                          📎

                          <input
                            type="file"
                            hidden
                            onChange={(e) =>
                              handleSecureFileUpload(
                                e.target.files?.[0],
                                "chat"
                              )
                            }
                          />
                        </label>

                        <button
                          type="submit"
                          className="btn-primary"
                          disabled={
                            isChatLoading
                          }
                        >
                          {isChatLoading
                            ? "..."
                            : "Send"}
                        </button>
                      </form>
                    </div>
                  </div>
                )}

                {activeTab ===
                  "panels" && (
                  <div className="result-section">
                    <h3>
                      Personalised Issue
                      Solution Panels
                    </h3>

                    {!analysisData
                      .personalizedPanels
                      ?.length ? (
                      <p>
                        No custom panels
                        generated for
                        this query.
                      </p>
                    ) : (
                      <div className="panel-grid">
                        {analysisData.personalizedPanels.map(
                          (
                            panel,
                            index
                          ) => (
                            <div
                              className="solution-panel"
                              key={index}
                            >
                              <strong>
                                {
                                  panel.panelTitle
                                }
                              </strong>

                              <div
                                dangerouslySetInnerHTML={{
                                  __html:
                                    renderMarkdownToHTML(
                                      panel.insight
                                    ),
                                }}
                              />

                              <div className="solution">
                                <strong>
                                  Recommended
                                  Solution:
                                </strong>{" "}
                                {
                                  panel.solution
                                }
                              </div>
                            </div>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}

                {activeTab ===
                  "steps" && (
                  <div className="result-section">
                    <h3>
                      Full Step-by-Step
                      Action Pathway
                    </h3>

                    <div className="action-list">
                      {analysisData.nextSteps?.map(
                        (
                          item,
                          index
                        ) => (
                          <div
                            className="action-item"
                            key={index}
                          >
                            <div className="action-title">
                              <span>
                                {index + 1}
                              </span>

                              <strong>
                                {
                                  item.step
                                }
                              </strong>
                            </div>

                            <p>
                              <strong>
                                Why:
                              </strong>{" "}
                              {item.why}
                            </p>

                            {item.pitfallWarning && (
                              <p className="pitfall">
                                <strong>
                                  ⚠️ Pitfall to
                                  Avoid:
                                </strong>{" "}
                                {
                                  item.pitfallWarning
                                }
                              </p>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  </div>
                )}

                {activeTab ===
                  "letter" && (
                  <div className="result-section letter-section">
                    <div className="letter-header">
                      <h3>
                        Automated
                        Resolution Letter
                      </h3>

                      <button
                        onClick={
                          handleCopyDraft
                        }
                      >
                        {copied
                          ? "Copied!"
                          : "Copy Letter Template"}
                      </button>
                    </div>

                    {analysisData.draftTemplate ? (
                      <div className="letter-content">
                        {`To: ${analysisData.draftTemplate.recipient}
Subject: ${analysisData.draftTemplate.subject}

${analysisData.draftTemplate.body}`}
                      </div>
                    ) : (
                      <p>
                        No template
                        generated for
                        this situation.
                      </p>
                    )}
                  </div>
                )}

                {activeTab ===
                  "resources" && (
                  <div className="result-section">
                    <h3>
                      Authoritative
                      Resources & Links
                    </h3>

                    {!(
                      analysisData.referenceLinks ||
                      analysisData.resources
                    )?.length ? (
                      <p>
                        No external links
                        provided for
                        this pathway.
                      </p>
                    ) : (
                      <div className="resource-list">
                        {(
                          analysisData.referenceLinks ||
                          analysisData.resources ||
                          []
                        ).map(
                          (
                            link,
                            index
                          ) => (
                            <a
                              key={index}
                              href={
                                link.url
                              }
                              target="_blank"
                              rel="noopener noreferrer"
                            >
                              <span>
                                🔗{" "}
                                <strong>
                                  {
                                    link.title
                                  }
                                </strong>
                              </span>

                              <span>
                                Visit →
                              </span>
                            </a>
                          )
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            </section>
          )}
      </main>

      <footer className="verlo-footer">
        <div className="footer-inner">
          <div className="footer-brand">
            <img
              src="/VVNormal.png"
              alt="VERLO Logo"
            />

            <span>VERLO</span>
          </div>

          <div>
            &copy;{" "}
            {new Date().getFullYear()}{" "}
            VERLO Engine. All rights
            reserved. Crafted with 🌶️.
          </div>
        </div>
      </footer>

      {showHistoryDrawer && (
        <aside className="history-drawer animate-slide-in-right">
          <div className="drawer-header">
            <h3>
              Your Saved Pathways
            </h3>

            <button
              type="button"
              onClick={() =>
                setShowHistoryDrawer(
                  false
                )
              }
            >
              ✕
            </button>
          </div>

          {userHistory.length ===
          0 ? (
            <p>
              No saved reports yet.
              Click "Save Pathway"
              on any result screen!
            </p>
          ) : (
            <div className="history-list">
              {userHistory.map(
                (
                  item,
                  index
                ) => (
                  <button
                    type="button"
                    className="history-item"
                    key={index}
                    onClick={() => {
                      setTitle(
                        item.title
                      );

                      setDescription(
                        item.description
                      );

                      setAnalysisData(
                        item.result
                      );

                      setStep(
                        "results"
                      );

                      setActiveTab(
                        "overview"
                      );

                      setShowHistoryDrawer(
                        false
                      );
                    }}
                  >
                    <strong>
                      {item.title}
                    </strong>

                    <span>
                      {new Date(
                        item.timestamp
                      ).toLocaleDateString()}
                    </span>
                  </button>
                )
              )}
            </div>
          )}
        </aside>
      )}

      {showAuthModal && (
        <div className="auth-overlay">
          <div className="auth-modal">
            <div className="modal-header">
              <h3>
                {authMode ===
                "login"
                  ? "Log in to VERLO"
                  : "Create an Account"}
              </h3>

              <button
                type="button"
                disabled={
                  isAuthLoading
                }
                onClick={() =>
                  setShowAuthModal(
                    false
                  )
                }
              >
                ✕
              </button>
            </div>

            {authError && (
              <div className="error-message">
                {authError}
              </div>
            )}

            <button
              type="button"
              className="google-login-button"
              onClick={
                handleGoogleLogin
              }
              disabled={
                isAuthLoading
              }
            >
              <svg
                className="google-login-icon"
                viewBox="0 0 24 24"
                aria-hidden="true"
              >
                <path
                  fill="#4285F4"
                  d="M21.35 12.27c0-.71-.06-1.39-.18-2.05H12v3.88h5.24a4.48 4.48 0 0 1-1.94 2.94v2.44h3.14c1.84-1.69 2.91-4.18 2.91-7.21Z"
                />

                <path
                  fill="#34A853"
                  d="M12 21.75c2.63 0 4.84-.87 6.45-2.36l-3.14-2.44c-.87.58-1.98.92-3.31.92-2.54 0-4.69-1.72-5.46-4.03H3.29v2.52A9.75 9.75 0 0 0 12 21.75Z"
                />

                <path
                  fill="#FBBC05"
                  d="M6.54 13.84a5.86 5.86 0 0 1 0-3.68V7.64H3.29a9.75 9.75 0 0 0 0 8.72l3.25-2.52Z"
                />

                <path
                  fill="#EA4335"
                  d="M12 6.13c1.43 0 2.72.49 3.73 1.46l2.8-2.8C16.84 3.22 14.63 2.25 12 2.25a9.75 9.75 0 0 0-8.71 5.39l3.25 2.52C7.31 7.85 9.46 6.13 12 6.13Z"
                />
              </svg>

              <span>
                {isAuthLoading
                  ? "Connecting to Google..."
                  : "Continue with Google"}
              </span>
            </button>

            <div className="auth-divider">
              <span>
                or continue with email
              </span>
            </div>

            <form
              onSubmit={
                handleAuthSubmit
              }
            >
              <div className="form-group">
                <label className="form-label">
                  Email Address
                </label>

                <input
                  type="email"
                  className="form-input"
                  value={authEmail}
                  onChange={(e) =>
                    setAuthEmail(
                      e.target.value
                    )
                  }
                  required
                  disabled={
                    isAuthLoading
                  }
                />
              </div>

              <div className="form-group">
                <label className="form-label">
                  Password
                </label>

                <input
                  type="password"
                  className="form-input"
                  value={
                    authPassword
                  }
                  onChange={(e) =>
                    setAuthPassword(
                      e.target.value
                    )
                  }
                  required
                  disabled={
                    isAuthLoading
                  }
                />
              </div>

              <button
                type="submit"
                className="btn-primary full-width"
                disabled={
                  isAuthLoading
                }
              >
                {isAuthLoading
                  ? "Please wait..."
                  : authMode ===
                      "login"
                    ? "Log In"
                    : "Sign Up"}
              </button>
            </form>

            <div className="auth-switch">
              {authMode ===
              "login" ? (
                <>
                  Don't have an
                  account?{" "}

                  <button
                    type="button"
                    disabled={
                      isAuthLoading
                    }
                    onClick={() => {
                      setAuthMode(
                        "signup"
                      );

                      setAuthError(
                        null
                      );
                    }}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an
                  account?{" "}

                  <button
                    type="button"
                    disabled={
                      isAuthLoading
                    }
                    onClick={() => {
                      setAuthMode(
                        "login"
                      );

                      setAuthError(
                        null
                      );
                    }}
                  >
                    Log in
                  </button>
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}