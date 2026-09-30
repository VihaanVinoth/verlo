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
  const [skippedAdaptiveQuestions, setSkippedAdaptiveQuestions] = useState({});
  const [activeAssessmentIndex, setActiveAssessmentIndex] = useState(0);

  const [isAdaptiveLoading, setIsAdaptiveLoading] = useState(false);
  const [adaptiveQuestionCount, setAdaptiveQuestionCount] = useState(0);

  const [assessmentAttachment, setAssessmentAttachment] = useState(null);
  const [chatAttachment, setChatAttachment] = useState(null);

  const [analysisData, setAnalysisData] = useState(null);
  const [activeTab, setActiveTab] = useState("overview");

  const [processingStage, setProcessingStage] = useState(0);
  const [error, setError] = useState(null);

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

  const getServerErrorMessage = (data, fallback) => {
    if (!data) {
      return fallback;
    }

    if (
      data.moderationBlocked ||
      data.moderated ||
      data.code === "CONTENT_BLOCKED"
    ) {
      return (
        data.error ||
        "VERLO cannot continue with that request. Please rephrase the situation and focus on the underlying problem or getting appropriate help."
      );
    }

    return data.error || data.message || fallback;
  };

  useEffect(() => {
    const restoreSession = async () => {
      setIsAuthLoading(true);

      try {
        const res = await fetch(`${API_URL}/api/auth/me`, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

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
        console.error("[VERLO] Session restore failed:", err);
        setCurrentUser(null);
      } finally {
        setIsAuthLoading(false);
      }
    };

    restoreSession();
  }, []);

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const authErrorFromUrl = params.get("auth_error");

    if (authErrorFromUrl) {
      console.error("[VERLO] Google OAuth error:", authErrorFromUrl);

      setAuthError("Google sign-in failed. Please try again.");
      setAuthMode("login");
      setShowAuthModal(true);

      window.history.replaceState({}, document.title, window.location.pathname);

      return;
    }

    if (window.location.search) {
      window.history.replaceState({}, document.title, window.location.pathname);
    }
  }, []);

  useEffect(() => {
    if (!currentUser) {
      setUserHistory([]);
      return;
    }

    const loadHistory = async () => {
      try {
        const res = await fetch(`${API_URL}/api/history`, {
          method: "GET",
          credentials: "include",
          headers: {
            Accept: "application/json",
          },
        });

        const data = await res.json();

        if (!res.ok) {
          throw new Error(data.error || "Could not load history.");
        }

        setUserHistory(data.history || []);
      } catch (err) {
        console.error("[VERLO] Failed to load history:", err);
      }
    };

    loadHistory();
  }, [currentUser]);

  useEffect(() => {
    if (step === "results") {
      window.scrollTo({
        top: 0,
        left: 0,
        behavior: "auto",
      });
    }
  }, [step]);

  const authenticatedFetch = async (url, options = {}) => {
    return fetch(url, {
      ...options,
      credentials: "include",
      headers: {
        ...(options.headers || {}),
      },
    });
  };

  const renderMarkdownToHTML = (content) => {
    if (!content) {
      return "";
    }

    let source = String(content)
      .replace(/\\([#*_`|>~])/g, "$1")
      .replace(/\\-/g, "-");

    source = source
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");

    const escapeAttribute = (value) =>
      String(value)
        .replace(/&/g, "&amp;")
        .replace(/"/g, "&quot;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;");

    const formatInline = (text) => {
      if (!text) {
        return "";
      }

      let value = text;

      value = value.replace(
        /`([^`]+)`/g,
        '<code class="markdown-inline-code">$1</code>',
      );

      value = value.replace(
        /\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g,
        (_, label, url) =>
          `<a href="${escapeAttribute(
            url,
          )}" target="_blank" rel="noopener noreferrer" class="markdown-link">${label}</a>`,
      );

      value = value.replace(
        /\*\*\*(.+?)\*\*\*/g,
        "<strong><em>$1</em></strong>",
      );

      value = value.replace(/___(.+?)___/g, "<strong><em>$1</em></strong>");

      value = value.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");

      value = value.replace(/__(.+?)__/g, "<strong>$1</strong>");

      value = value.replace(/(^|[^\*])\*([^*\n]+)\*(?!\*)/g, "$1<em>$2</em>");

      value = value.replace(/(^|[^_])_([^_\n]+)_(?!_)/g, "$1<em>$2</em>");

      value = value.replace(/~~(.+?)~~/g, "<del>$1</del>");

      return value;
    };

    const lines = source.split(/\r?\n/);
    const output = [];

    let index = 0;
    let inCodeBlock = false;
    let codeBuffer = [];

    while (index < lines.length) {
      const line = lines[index];

      if (line.trim().startsWith("```")) {
        if (!inCodeBlock) {
          inCodeBlock = true;
          codeBuffer = [];
        } else {
          inCodeBlock = false;

          output.push(
            `<pre class="markdown-code"><code>${codeBuffer.join(
              "\n",
            )}</code></pre>`,
          );

          codeBuffer = [];
        }

        index += 1;
        continue;
      }

      if (inCodeBlock) {
        codeBuffer.push(line);
        index += 1;
        continue;
      }

      const trimmed = line.trim();

      if (!trimmed) {
        index += 1;
        continue;
      }

      if (/^(-{3,}|\*{3,}|_{3,})$/.test(trimmed)) {
        output.push('<hr class="markdown-divider" />');

        index += 1;
        continue;
      }

      const headingMatch = trimmed.match(/^(#{1,6})\s+(.+)$/);

      if (headingMatch) {
        const level = headingMatch[1].length;
        const headingText = formatInline(headingMatch[2]);

        output.push(
          `<h${level} class="markdown-heading markdown-h${level}">${headingText}</h${level}>`,
        );

        index += 1;
        continue;
      }

      const nextLine = lines[index + 1]?.trim() || "";

      const isTableHeader =
        trimmed.includes("|") &&
        /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(nextLine);

      if (isTableHeader) {
        const parseTableRow = (row) => {
          let cleaned = row.trim();

          if (cleaned.startsWith("|")) {
            cleaned = cleaned.substring(1);
          }

          if (cleaned.endsWith("|")) {
            cleaned = cleaned.substring(0, cleaned.length - 1);
          }

          return cleaned.split("|").map((cell) => cell.trim());
        };

        const headers = parseTableRow(trimmed);

        index += 2;

        const rows = [];

        while (
          index < lines.length &&
          lines[index].trim() &&
          lines[index].includes("|")
        ) {
          rows.push(parseTableRow(lines[index]));
          index += 1;
        }

        let tableHTML =
          '<div class="markdown-table-wrapper"><table class="markdown-table"><thead><tr>';

        headers.forEach((header) => {
          tableHTML += `<th>${formatInline(header)}</th>`;
        });

        tableHTML += "</tr></thead><tbody>";

        rows.forEach((row) => {
          tableHTML += "<tr>";

          headers.forEach((_, cellIndex) => {
            tableHTML += `<td>${formatInline(row[cellIndex] || "")}</td>`;
          });

          tableHTML += "</tr>";
        });

        tableHTML += "</tbody></table></div>";

        output.push(tableHTML);

        continue;
      }

      if (trimmed.startsWith(">")) {
        const quoteLines = [];

        while (index < lines.length && lines[index].trim().startsWith(">")) {
          quoteLines.push(lines[index].trim().replace(/^>\s?/, ""));

          index += 1;
        }

        output.push(
          `<blockquote class="markdown-blockquote">${quoteLines
            .map((quoteLine) => `<p>${formatInline(quoteLine)}</p>`)
            .join("")}</blockquote>`,
        );

        continue;
      }

      if (/^[-*+]\s+/.test(trimmed)) {
        const items = [];

        while (index < lines.length && /^[-*+]\s+/.test(lines[index].trim())) {
          const item = lines[index].trim().replace(/^[-*+]\s+/, "");

          items.push(`<li>${formatInline(item)}</li>`);

          index += 1;
        }

        output.push(`<ul class="markdown-list">${items.join("")}</ul>`);

        continue;
      }

      if (/^\d+\.\s+/.test(trimmed)) {
        const items = [];

        while (index < lines.length && /^\d+\.\s+/.test(lines[index].trim())) {
          const item = lines[index].trim().replace(/^\d+\.\s+/, "");

          items.push(`<li>${formatInline(item)}</li>`);

          index += 1;
        }

        output.push(
          `<ol class="markdown-list markdown-ordered-list">${items.join(
            "",
          )}</ol>`,
        );

        continue;
      }

      const paragraphLines = [trimmed];

      index += 1;

      while (index < lines.length) {
        const following = lines[index].trim();

        if (!following) {
          break;
        }

        if (
          /^#{1,6}\s+/.test(following) ||
          /^[-*+]\s+/.test(following) ||
          /^\d+\.\s+/.test(following) ||
          following.startsWith(">") ||
          following.startsWith("```")
        ) {
          break;
        }

        const followingNext = lines[index + 1]?.trim() || "";

        if (
          following.includes("|") &&
          /^\|?\s*:?-{3,}:?\s*(\|\s*:?-{3,}:?\s*)+\|?$/.test(followingNext)
        ) {
          break;
        }

        paragraphLines.push(following);
        index += 1;
      }

      output.push(`<p>${formatInline(paragraphLines.join(" "))}</p>`);
    }

    if (inCodeBlock && codeBuffer.length) {
      output.push(
        `<pre class="markdown-code"><code>${codeBuffer.join(
          "\n",
        )}</code></pre>`,
      );
    }

    return output.join("");
  };

  const handleExampleSelect = (exampleTitle, desc, context) => {
    setTitle(exampleTitle);
    setDescription(desc);
    setUserContext(context);
    setStep("input");
    setError(null);
  };

  const handleGoogleLogin = () => {
    setAuthError(null);
    setIsAuthLoading(true);

    console.log("[VERLO] Starting Google login...");

    window.location.href = `${API_URL}/api/auth/google`;
  };

  const handleAuthSubmit = async (e) => {
    e.preventDefault();

    setAuthError(null);
    setIsAuthLoading(true);

    const endpoint =
      authMode === "login" ? "/api/auth/login" : "/api/auth/signup";

    try {
      const res = await fetch(`${API_URL}${endpoint}`, {
        method: "POST",
        credentials: "include",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          email: authEmail.trim(),
          password: authPassword,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        const message = String(data.error || "").toLowerCase();

        if (
          authMode === "signup" &&
          (res.status === 409 ||
            message.includes("already") ||
            message.includes("exist") ||
            message.includes("registered"))
        ) {
          throw new Error(
            "This email address is already registered. Please log in instead.",
          );
        }

        throw new Error(data.error || "Authentication failed.");
      }

      if (!data.user) {
        throw new Error("The server did not return your account information.");
      }

      setCurrentUser(data.user);
      setShowAuthModal(false);
      setAuthEmail("");
      setAuthPassword("");
      setAuthError(null);

      triggerCustomAlert(
        authMode === "signup"
          ? "Account created successfully!"
          : "Logged in successfully!",
      );
    } catch (err) {
      setAuthError(err.message || "Authentication failed.");
    } finally {
      setIsAuthLoading(false);
    }
  };

  const handleLogout = async () => {
    try {
      await fetch(`${API_URL}/api/auth/logout`, {
        method: "POST",
        credentials: "include",
      });
    } catch (err) {
      console.error("[VERLO] Logout request failed:", err);
    }

    setCurrentUser(null);
    setUserHistory([]);
    setShowHistoryDrawer(false);
    setStep("landing");

    triggerCustomAlert("Logged out successfully.");
  };

  const handleSaveToAccount = async (resultData) => {
    if (!currentUser) {
      setAuthMode("login");
      setAuthError(null);
      setShowAuthModal(true);
      return;
    }

    try {
      const res = await authenticatedFetch(`${API_URL}/api/history/save`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          report: {
            title: title || "Untitled Report",
            description,
            result: resultData,
          },
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (res.status === 401) {
          setCurrentUser(null);
          setAuthMode("login");
          setAuthError("Your login session has expired. Please log in again.");
          setShowAuthModal(true);
          return;
        }

        throw new Error(data.error || "Could not save pathway.");
      }

      setUserHistory(data.history || []);

      triggerCustomAlert("Pathway saved successfully to your account history!");
    } catch (err) {
      console.error("[VERLO] Failed to save history:", err);

      triggerCustomAlert("Error saving pathway to account history.", "error");
    }
  };

  const handleSecureFileUpload = async (file, target) => {
    if (!file) {
      return;
    }

    if (file.size > 15 * 1024 * 1024) {
      triggerCustomAlert("File exceeds maximum size limit (15MB).", "error");

      return;
    }

    try {
      triggerCustomAlert("Attaching file...");

      await new Promise((resolve) => setTimeout(resolve, 500));

      const fileMeta = {
        name: file.name,
        size: `${(file.size / 1024).toFixed(1)} KB`,
        type: file.type || "application/octet-stream",
        uploadedAt: new Date().toISOString(),
      };

      if (target === "assessment") {
        setAssessmentAttachment(fileMeta);

        triggerCustomAlert(
          `File "${file.name}" attached to assessment context.`,
        );
      }

      if (target === "chat") {
        setChatAttachment(fileMeta);

        triggerCustomAlert(`File "${file.name}" attached to chat prompt.`);
      }
    } catch {
      triggerCustomAlert("Failed to attach file.", "error");
    }
  };

  const removeAttachment = (target) => {
    if (target === "assessment") {
      setAssessmentAttachment(null);

      triggerCustomAlert("Assessment attachment removed.");
    }

    if (target === "chat") {
      setChatAttachment(null);

      triggerCustomAlert("Chat attachment removed.");
    }
  };

  const getAllAssessmentItems = () => {
    const source =
      assessmentData?.adaptiveQuestions ||
      assessmentData?.adaptive_questions ||
      assessmentData?.questions ||
      [];

    if (!Array.isArray(source)) {
      return [];
    }

    return source.map((item, index) => ({
      type: item.type === "mcq" ? "mcq" : "text",

      ...item,

      id: item.id || item.questionId || `adaptive-${index}`,

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

      choices: Array.isArray(item.choices) ? item.choices : [],
    }));
  };

  const assessmentItems = getAllAssessmentItems();

  const buildAllAnswers = (
    textAnswers = adaptiveTextAnswers,
    mcqAnswers = selectedMcqAnswers,
    skippedQuestions = skippedAdaptiveQuestions,
  ) => ({
    ...textAnswers,
    ...mcqAnswers,
    ...(Object.keys(skippedQuestions).length > 0
      ? {
          _skippedQuestions: Object.keys(skippedQuestions),
        }
      : {}),
  });

  const buildPreviousQuestions = () =>
    getAllAssessmentItems().map((item) => ({
      id: item.id,
      type: item.type,
      question: item.question,
      stem: item.stem,
      choices: item.choices,
    }));

  const requestAdaptiveQuestion = async (previousAnswers = {}) => {
    if (isAdaptiveLoading || adaptiveQuestionCount >= MAX_ADAPTIVE_QUESTIONS) {
      return null;
    }

    setIsAdaptiveLoading(true);
    setError(null);

    try {
      const questionNumber = adaptiveQuestionCount + 1;

      const res = await fetch(`${API_URL}/api/adaptive-question`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          title,
          description,
          context: userContext,
          previousAnswers,
          previousQuestions: buildPreviousQuestions(),
          skippedQuestions: Object.keys(skippedAdaptiveQuestions),
          questionNumber,
          maxQuestions: MAX_ADAPTIVE_QUESTIONS,
          attachment: assessmentAttachment,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (
          res.status === 400 ||
          res.status === 403 ||
          result.moderationBlocked ||
          result.moderated ||
          result.code === "CONTENT_BLOCKED"
        ) {
          const moderationMessage = getServerErrorMessage(
            result,
            "VERLO cannot continue with this request. Please rephrase the situation and focus on the underlying problem.",
          );

          setError(moderationMessage);
          setStep("input");

          triggerCustomAlert(moderationMessage, "error");

          return null;
        }

        throw new Error(
          getServerErrorMessage(
            result,
            "Could not generate the adaptive question.",
          ),
        );
      }

      if (!result.question) {
        throw new Error("The adaptive engine returned no question.");
      }

      const questions = [...getAllAssessmentItems(), result.question];

      setAssessmentData({
        adaptiveQuestions: questions,
      });

      setAdaptiveQuestionCount(questions.length);

      setActiveAssessmentIndex(questions.length - 1);

      setStep("assessment");

      return result.question;
    } catch (err) {
      setError(err.message || "Could not generate the next adaptive question.");

      return null;
    } finally {
      setIsAdaptiveLoading(false);
    }
  };

  const handleInitialSubmit = async (e) => {
    e.preventDefault();

    if (wordCount < MIN_WORDS) {
      setError(
        `Please provide a bit more detail (at least ${MIN_WORDS} words) so VERLO can build a reliable pathway.`,
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
    setSkippedAdaptiveQuestions({});
    setActiveAssessmentIndex(0);
    setAdaptiveQuestionCount(0);

    let currentStage = 0;

    const interval = setInterval(() => {
      currentStage += 1;

      if (currentStage < processingSteps.length) {
        setProcessingStage(currentStage);
      }
    }, 550);

    try {
      await new Promise((resolve) => setTimeout(resolve, 1800));

      const res = await fetch(`${API_URL}/api/adaptive-question`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          title,
          description,
          context: userContext,
          previousAnswers: {},
          previousQuestions: [],
          skippedQuestions: [],
          questionNumber: 1,
          maxQuestions: MAX_ADAPTIVE_QUESTIONS,
          attachment: assessmentAttachment,
        }),
      });

      const result = await res.json();

      if (!res.ok) {
        if (
          res.status === 400 ||
          res.status === 403 ||
          result.moderationBlocked ||
          result.moderated ||
          result.code === "CONTENT_BLOCKED"
        ) {
          const moderationMessage = getServerErrorMessage(
            result,
            "VERLO cannot continue with this request. Please rephrase the situation and focus on the underlying problem.",
          );

          setError(moderationMessage);
          setStep("input");
          triggerCustomAlert(moderationMessage, "error");

          return;
        }

        throw new Error(
          getServerErrorMessage(
            result,
            "Adaptive engine failed to create the first question.",
          ),
        );
      }

      if (!result.question) {
        throw new Error("The adaptive engine returned no first question.");
      }

      setAssessmentData({
        adaptiveQuestions: [result.question],
      });

      setAdaptiveQuestionCount(1);
      setActiveAssessmentIndex(0);
      setStep("assessment");
    } catch (err) {
      setError(err.message || "Could not connect to the adaptive engine.");

      setStep("input");
    } finally {
      clearInterval(interval);
    }
  };

  const getCurrentAnswer = () => {
    const item = assessmentItems[activeAssessmentIndex];

    if (!item) {
      return "";
    }

    const key = item.id || activeAssessmentIndex;

    if (item.type === "mcq") {
      return selectedMcqAnswers[key] || "";
    }

    return adaptiveTextAnswers[key] || "";
  };

  const handleAssessmentNext = async () => {
    const item = assessmentItems[activeAssessmentIndex];

    if (!item || isAdaptiveLoading) {
      return;
    }

    const answer = getCurrentAnswer();

    if (!String(answer).trim()) {
      triggerCustomAlert(
        "Please answer this question before continuing.",
        "error",
      );

      return;
    }

    const key = item.id || activeAssessmentIndex;

    const nextTextAnswers = {
      ...adaptiveTextAnswers,
    };

    const nextMcqAnswers = {
      ...selectedMcqAnswers,
    };

    const nextSkippedQuestions = {
      ...skippedAdaptiveQuestions,
    };

    delete nextSkippedQuestions[key];

    if (item.type === "mcq") {
      nextMcqAnswers[key] = answer;
      delete nextTextAnswers[key];
    } else {
      nextTextAnswers[key] = answer;
      delete nextMcqAnswers[key];
    }

    setSelectedMcqAnswers(nextMcqAnswers);

    setAdaptiveTextAnswers(nextTextAnswers);

    setSkippedAdaptiveQuestions(nextSkippedQuestions);

    const allAnswers = buildAllAnswers(
      nextTextAnswers,
      nextMcqAnswers,
      nextSkippedQuestions,
    );

    if (adaptiveQuestionCount >= MAX_ADAPTIVE_QUESTIONS) {
      await handleFinalAssessmentSubmit(allAnswers);

      return;
    }

    await requestAdaptiveQuestion(allAnswers);
  };

  const handleAssessmentSkip = async () => {
    const item = assessmentItems[activeAssessmentIndex];

    if (!item || isAdaptiveLoading) {
      return;
    }

    const key = item.id || activeAssessmentIndex;

    const nextTextAnswers = {
      ...adaptiveTextAnswers,
    };

    const nextMcqAnswers = {
      ...selectedMcqAnswers,
    };

    const nextSkippedQuestions = {
      ...skippedAdaptiveQuestions,
      [key]: true,
    };

    delete nextTextAnswers[key];
    delete nextMcqAnswers[key];

    setAdaptiveTextAnswers(nextTextAnswers);

    setSelectedMcqAnswers(nextMcqAnswers);

    setSkippedAdaptiveQuestions(nextSkippedQuestions);

    const allAnswers = buildAllAnswers(
      nextTextAnswers,
      nextMcqAnswers,
      nextSkippedQuestions,
    );

    if (adaptiveQuestionCount >= MAX_ADAPTIVE_QUESTIONS) {
      await handleFinalAssessmentSubmit(allAnswers);

      return;
    }

    await requestAdaptiveQuestion(allAnswers);
  };

  const handleAssessmentPrev = () => {
    if (isAdaptiveLoading) {
      return;
    }

    if (activeAssessmentIndex > 0) {
      setActiveAssessmentIndex((prev) => prev - 1);
    } else {
      setStep("input");
    }
  };

  const handleFinalAssessmentSubmit = async (answersOverride = null) => {
    setStep("processing");
    setProcessingStage(0);

    const finalAnswers = answersOverride || buildAllAnswers();

    let currentStage = 0;

    const interval = setInterval(() => {
      currentStage += 1;

      if (currentStage < processingSteps.length) {
        setProcessingStage(currentStage);
      }
    }, 700);

    try {
      const [res] = await Promise.all([
        fetch(`${API_URL}/api/analyze`, {
          method: "POST",

          headers: {
            "Content-Type": "application/json",
          },

          body: JSON.stringify({
            title,

            prompt: description,

            category: title || "General",

            context: userContext,

            answers: JSON.stringify(finalAnswers),

            questions: JSON.stringify(buildPreviousQuestions()),

            skippedQuestions: Object.keys(skippedAdaptiveQuestions),

            attachment: assessmentAttachment,

            attachments: assessmentAttachment ? [assessmentAttachment] : [],
          }),
        }),

        new Promise((resolve) =>
          setTimeout(resolve, processingSteps.length * 700),
        ),
      ]);

      const result = await res.json();

      if (!res.ok) {
        if (
          res.status === 400 ||
          res.status === 403 ||
          result.moderationBlocked ||
          result.moderated ||
          result.code === "CONTENT_BLOCKED"
        ) {
          const moderationMessage = getServerErrorMessage(
            result,
            "VERLO cannot generate a pathway for this request. Please rephrase the situation and focus on the underlying problem.",
          );

          setError(moderationMessage);
          setStep("input");
          triggerCustomAlert(moderationMessage, "error");

          return;
        }

        throw new Error(
          getServerErrorMessage(
            result,
            "Failed to compute final diagnostic pathway.",
          ),
        );
      }

      let finalData = result.result || result.data;

      if (!finalData && result.analysis) {
        try {
          finalData = JSON.parse(result.analysis);
        } catch {
          finalData = {
            situation: result.analysis,

            confidence: "Moderate",

            riskAssessment: {
              severityScore: "N/A",

              financialExposure: "Not established",

              timeSensitivity: "Review required",
            },

            nextSteps: [],

            personalizedPanels: [],

            resources: [],

            referenceLinks: [],
          };
        }
      }

      if (!finalData) {
        throw new Error("The server returned no analysis.");
      }

      if (!finalData.referenceLinks && Array.isArray(finalData.resources)) {
        finalData.referenceLinks = finalData.resources;
      }

      setAnalysisData(finalData);
      setChatHistory([]);
      setActiveTab("overview");
      setStep("results");
    } catch (err) {
      setError(err.message || "Could not connect to the server.");

      setStep("assessment");
    } finally {
      clearInterval(interval);
    }
  };

  const handleChatSubmit = async (e) => {
    e.preventDefault();

    if ((!chatQuestion.trim() && !chatAttachment) || isChatLoading) {
      return;
    }

    const questionText =
      chatQuestion.trim() || `[Uploaded file: ${chatAttachment.name}]`;

    const currentAttachment = chatAttachment;

    setChatQuestion("");
    setChatAttachment(null);
    setIsChatLoading(true);

    const newHistory = [
      ...chatHistory,

      {
        role: "user",
        content: questionText,
        attachment: currentAttachment,
      },
    ];

    setChatHistory(newHistory);

    try {
      const res = await fetch(`${API_URL}/api/chat`, {
        method: "POST",

        headers: {
          "Content-Type": "application/json",
        },

        body: JSON.stringify({
          question: questionText,

          currentSituation: description || title,

          context: userContext,

          attachment: currentAttachment,
        }),
      });

      const data = await res.json();

      if (!res.ok) {
        if (
          res.status === 400 ||
          res.status === 403 ||
          data.moderationBlocked ||
          data.moderated ||
          data.code === "CONTENT_BLOCKED"
        ) {
          throw new Error(
            getServerErrorMessage(
              data,
              "VERLO cannot respond to that request. Please rephrase your question and focus on the underlying problem.",
            ),
          );
        }

        throw new Error(data.error || "Failed to get chat response.");
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

          content: `⚠️ Error: ${err.message}`,
        },
      ]);
    } finally {
      setIsChatLoading(false);
    }
  };

  const currentAssessmentItem = assessmentItems[activeAssessmentIndex];

  return (
    <div className="verlo-app">
      {customAlert && (
        <div
          className={`custom-alert ${customAlert.type} ${
            alertExiting ? "exiting" : ""
          }`}
        >
          <span>{customAlert.type === "error" ? "⚠️" : "✓"}</span>

          <span>{customAlert.message}</span>
        </div>
      )}

      <header className="verlo-nav">
        <div className="verlo-logo" onClick={() => setStep("landing")}>
          <img src="/VVNormal.png" alt="VERLO Logo" />

          <span>VERLO</span>
        </div>

        {currentUser ? (
          <div className="user-nav">
            <button
              type="button"
              onClick={() => setShowHistoryDrawer(!showHistoryDrawer)}
              aria-label={`Open saved history (${userHistory.length} reports)`}
              aria-expanded={showHistoryDrawer}
              aria-controls="history-drawer"
            >
              <svg
                className="history-icon"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.8"
                strokeLinecap="round"
                strokeLinejoin="round"
                aria-hidden="true"
              >
                <circle cx="12" cy="12" r="9" />

                <path d="M12 7v5l3 2" />
              </svg>

              <span>History ({userHistory.length})</span>
            </button>

            {currentUser.picture && (
              <img src={currentUser.picture} alt="" className="user-avatar" />
            )}

            <span>
              {currentUser.name || currentUser.email || currentUser.id}
            </span>

            <button
              type="button"
              className="logout-button"
              onClick={handleLogout}
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
                <img src="/VVNormal.png" alt="VERLO Logo" />

                <span className="verlo-brand">VERLO</span>
              </div>

              <h1 className="verlo-title">
                Stop guessing. Know your exact next step.
              </h1>

              <p className="verlo-subtitle">
                Verlo is an adaptive supercharged decision-intelligence engine
                that transforms messy, stressful situations into a fully
                tailored, risk-scored action pathway through dynamic profiling.
              </p>

              <button
                className="btn-primary launch-button"
                onClick={() => setStep("input")}
              >
                Launch Decision Engine →
              </button>

              <div className="example-section">
                <p className="example-label">Test common VERLO scenarios:</p>

                <div className="example-grid">
                  <div
                    className="verlo-card example-card"
                    onClick={() =>
                      handleExampleSelect(
                        "Flight cancelled at gate",
                        "My international flight was abruptly cancelled at the boarding gate due to mechanical failure. The airline desk agent says the earliest they can rebook me is in 48 hours, and they are refusing to cover hotel accommodations for the night despite my connecting ticket.",
                        "Travelling on a strict budget for an important family event",
                      )
                    }
                  >
                    <span className="example-icon">
                      <svg
                        className="example-svg-icon"
                        viewBox="0 0 512 512"
                        fill="none"
                        xmlns="http://www.w3.org/2000/svg"
                        aria-hidden="true"
                      >
                        <path
                          d="M407.72 224c-3.4 0-14.79.1-18 .3l-64.9 1.7a1.83 1.83 0 0 1-1.69-.9L193.55 67.56A9 9 0 0 0 186.89 64H160l73 161a2.35 2.35 0 0 1-2.26 3.35l-121.69 1.8a8.06 8.06 0 0 1-6.6-3.1l-37-45c-3-3.9-8.62-6-13.51-6H33.08c-1.29 0-1.1 1.21-.75 2.43l19.84 63.47a16.3 16.3 0 0 1 0 11.9L32.31 333c-.59 1.95-.52 3 1.77 3H52c8.14 0 9.25-1.06 13.41-6.3l37.7-45.7a8.19 8.19 0 0 1 6.6-3.1l120.68 2.7a2.7 2.7 0 0 1 2.43 3.74L160 448h26.64a9 9 0 0 0 6.65-3.55L323.14 287c.39-.6 2-.9 2.69-.9l63.9 1.7c3.3.2 14.59.3 18 .3C452 288.1 480 275.93 480 256s-27.88-32-72.28-32Z"
                          stroke="currentColor"
                          strokeWidth="32"
                          strokeLinecap="round"
                          strokeLinejoin="round"
                        />
                      </svg>
                    </span>

                    <div>
                      <strong>Flight cancelled at gate</strong> — Airline
                      refusing overnight hotel voucher.
                    </div>
                  </div>

                  <div
                    className="verlo-card example-card"
                    onClick={() =>
                      handleExampleSelect(
                        "Unresolved billing charge",
                        "I noticed an unexpected $450 charge on my credit card from a software enterprise subscription that I explicitly cancelled three months ago in writing. Support is ignoring my emails and chat tickets.",
                        "Freelancer relying on tight monthly cash flow",
                      )
                    }
                  >
                    <span className="example-icon">
                      <svg
                        className="example-svg-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="3" y="5" width="18" height="14" rx="2" />

                        <path d="M3 9h18" />
                        <path d="M7 14h3" />
                        <path d="M15 14h2" />
                      </svg>
                    </span>

                    <div>
                      <strong>Unresolved billing dispute</strong> — Subscription
                      charged post-cancellation.
                    </div>
                  </div>

                  <div
                    className="verlo-card example-card"
                    onClick={() =>
                      handleExampleSelect(
                        "Landlord withholding bond",
                        "My tenancy agreement ended 3 weeks ago and my landlord is refusing to release my full $2,000 security deposit, claiming minor carpet scuffs that were already present when I moved in as documented on my condition report.",
                        "First-time renter moving into a new apartment",
                      )
                    }
                  >
                    <span className="example-icon">
                      <svg
                        className="example-svg-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <path d="m3 10.5 9-7 9 7" />
                        <path d="M5.5 9v10.5h13V9" />
                        <path d="M9.5 19.5v-5h5v5" />
                      </svg>
                    </span>

                    <div>
                      <strong>Landlord withholding bond</strong> — Disputing
                      false wear-and-tear deductions.
                    </div>
                  </div>

                  <div
                    className="verlo-card example-card"
                    onClick={() =>
                      handleExampleSelect(
                        "Defective laptop warranty dispute",
                        "I purchased a high-end laptop 5 months ago that has suffered multiple motherboard failures. The manufacturer service center is claiming accidental liquid damage violation even though the machine has never been exposed to liquids.",
                        "Student relying on laptop for coursework",
                      )
                    }
                  >
                    <span className="example-icon">
                      <svg
                        className="example-svg-icon"
                        viewBox="0 0 24 24"
                        fill="none"
                        stroke="currentColor"
                        strokeWidth="1.7"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        aria-hidden="true"
                      >
                        <rect x="4" y="4" width="16" height="13" rx="1.5" />

                        <path d="M2.5 20h19" />

                        <path d="M8.5 20c.3-1.4 1.2-2.5 2.5-2.5s2.2 1.1 2.5 2.5" />
                      </svg>
                    </span>

                    <div>
                      <strong>Defective laptop warranty</strong> — Manufacturer
                      denying warranty repair unfairly.
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
                onClick={() => setStep("landing")}
              >
                ← Back to Overview
              </button>

              <div className="verlo-header">
                <div className="landing-logo">
                  <img src="/VVNormal.png" alt="VERLO Logo" />

                  <span className="verlo-brand">VERLO</span>
                </div>

                <h2 className="verlo-title">Define Your Situation</h2>

                <p className="verlo-subtitle">
                  Provide the details below. Our adaptive engine will formulate
                  custom probing questions before constructing your report.
                </p>
              </div>

              {error && <div className="error-message">{error}</div>}

              <form
                onSubmit={handleInitialSubmit}
                className="verlo-card situation-form"
              >
                <div className="form-group">
                  <label className="form-label">
                    Situation Title (Optional)
                  </label>

                  <input
                    className="form-input"
                    placeholder="e.g., Landlord deposit dispute"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <div className="field-header">
                    <label className="form-label">
                      Describe what happened *
                    </label>

                    <span
                      className={
                        wordCount < MIN_WORDS
                          ? "word-count warning"
                          : "word-count"
                      }
                    >
                      {wordCount} words{" "}
                      {wordCount < MIN_WORDS
                        ? `(Minimum ${MIN_WORDS} required)`
                        : "✓"}
                    </span>
                  </div>

                  <textarea
                    className="form-textarea"
                    placeholder="Include key details: dates, amounts, communications, and what outcome you are looking for..."
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    required
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Any specific personal context or constraints? (Optional)
                  </label>

                  <input
                    className="form-input"
                    placeholder="e.g., I'm a student living on a tight budget"
                    value={userContext}
                    onChange={(e) => setUserContext(e.target.value)}
                  />
                </div>

                <div className="form-group">
                  <label className="form-label">
                    Attach Evidence / Files / Media (Optional)
                  </label>

                  <label className="file-button">
                    Browse File / Media
                    <input
                      type="file"
                      hidden
                      onChange={(e) =>
                        handleSecureFileUpload(
                          e.target.files?.[0],
                          "assessment",
                        )
                      }
                    />
                  </label>

                  <span className="file-note">
                    Attached locally for this assessment. Maximum 15MB.
                  </span>

                  {assessmentAttachment && (
                    <div className="attachment">
                      <span>
                        📎 {assessmentAttachment.name} (
                        {assessmentAttachment.size})
                      </span>

                      <button
                        type="button"
                        onClick={() => removeAttachment("assessment")}
                      >
                        Remove
                      </button>
                    </div>
                  )}
                </div>

                <button type="submit" className="btn-primary full-width">
                  Generate Adaptive Assessment →
                </button>
              </form>
            </div>
          </section>
        )}

        {step === "assessment" && currentAssessmentItem && (
          <section className="page-transition animate-fade-slide-up assessment-page">
            <div className="content-narrow">
              <div className="assessment-top">
                <button
                  className="secondary-button"
                  onClick={handleAssessmentPrev}
                >
                  ← Back
                </button>

                <span>
                  Question {activeAssessmentIndex + 1} of{" "}
                  {MAX_ADAPTIVE_QUESTIONS}
                  <b> • adaptive</b>
                </span>
              </div>

              <div className="progress-bar">
                <div
                  className="progress-fill"
                  style={{
                    width: `${Math.min(
                      ((activeAssessmentIndex + 1) / MAX_ADAPTIVE_QUESTIONS) *
                        100,
                      100,
                    )}%`,
                  }}
                />
              </div>

              <div className="verlo-header assessment-header">
                <h2 className="verlo-title">Refine Your Parameters</h2>

                <p className="verlo-subtitle">
                  Answering these custom inquiries ensures your final action
                  pathway is laser-focused.
                </p>
              </div>

              <div className="verlo-card assessment-card">
                {isAdaptiveLoading ? (
                  <div className="adaptive-loading">
                    <div className="processing-pulse-ring" />

                    <strong>Adapting the next question...</strong>

                    <span>
                      VERLO is using your previous answer to decide what matters
                      next.
                    </span>
                  </div>
                ) : currentAssessmentItem.type === "mcq" ? (
                  <div>
                    <label className="form-label question-label">
                      {currentAssessmentItem.stem}
                    </label>

                    <div className="choice-grid">
                      {currentAssessmentItem.choices.map((choice, index) => {
                        const key =
                          currentAssessmentItem.id || activeAssessmentIndex;

                        const selected = selectedMcqAnswers[key] === choice;

                        return (
                          <button
                            key={index}
                            type="button"
                            className={`choice-button ${
                              selected ? "selected" : ""
                            }`}
                            onClick={() =>
                              setSelectedMcqAnswers((prev) => ({
                                ...prev,
                                [key]: choice,
                              }))
                            }
                          >
                            <span className="choice-radio">
                              {selected && <span />}
                            </span>

                            {choice}
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ) : (
                  <div>
                    <label className="form-label question-label">
                      {currentAssessmentItem.question}
                    </label>

                    <input
                      className="form-input question-input"
                      placeholder="Type your precise specification here and press Enter..."
                      value={
                        adaptiveTextAnswers[
                          currentAssessmentItem.id || activeAssessmentIndex
                        ] || ""
                      }
                      onChange={(e) =>
                        setAdaptiveTextAnswers((prev) => ({
                          ...prev,

                          [currentAssessmentItem.id || activeAssessmentIndex]:
                            e.target.value,
                        }))
                      }
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && !isAdaptiveLoading) {
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
                  type="button"
                  className="skip-button"
                  onClick={handleAssessmentSkip}
                  disabled={isAdaptiveLoading}
                >
                  {adaptiveQuestionCount >= MAX_ADAPTIVE_QUESTIONS
                    ? "Skip & Synthesise →"
                    : "Skip Question"}
                </button>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={handleAssessmentNext}
                  disabled={isAdaptiveLoading}
                >
                  {isAdaptiveLoading
                    ? "Adapting..."
                    : adaptiveQuestionCount >= MAX_ADAPTIVE_QUESTIONS
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

            <h2>Synthesising supercharged logic & links...</h2>

            <div className="processing-steps">
              {processingSteps.map((text, index) => {
                const done = index < processingStage;

                const active = index === processingStage;

                return (
                  <div
                    key={text}
                    className={`step-item ${active ? "active" : ""} ${
                      done ? "done" : ""
                    }`}
                  >
                    <div className="step-content">
                      <span className="step-dot" />

                      <span>{text}</span>
                    </div>

                    <span className="step-status">
                      {done ? "✓" : active ? "●" : "○"}
                    </span>
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {step === "results" && analysisData && (
          <section className="page-transition animate-fade-slide-up results-page">
            <div className="results-container">
              <div className="results-toolbar">
                <div>
                  <button
                    className="secondary-button"
                    onClick={() => setStep("input")}
                  >
                    ← New Situation
                  </button>

                  <button
                    className="save-button"
                    onClick={() => handleSaveToAccount(analysisData)}
                  >
                    💾 Save Pathway
                  </button>
                </div>

                <button
                  className="secondary-button"
                  onClick={() => setStep("landing")}
                >
                  Start Over
                </button>
              </div>

              <div className="report-intro">
                <div className="report-intro-copy">
                  <span className="report-eyebrow">VERLO DECISION PATHWAY</span>

                  <h1>{title || "Your Personalised Pathway"}</h1>

                  <p>
                    Your situation has been analysed and organised into a
                    practical set of next steps.
                  </p>

                  {userContext && (
                    <div className="report-context">
                      <span>Personal context</span>

                      <strong>{userContext}</strong>
                    </div>
                  )}
                </div>

                <div className="report-confidence">
                  <span>Analysis confidence</span>

                  <strong>{analysisData.confidence || "Moderate"}</strong>
                </div>
              </div>

              <div className="report-priority-card">
                <div className="priority-label">START HERE</div>

                <h2>
                  {analysisData.nextSteps?.[0]?.step ||
                    "Review your recommended action pathway."}
                </h2>

                {analysisData.nextSteps?.[0]?.why && (
                  <p>
                    <strong>Why this matters:</strong>{" "}
                    {analysisData.nextSteps[0].why}
                  </p>
                )}

                <button
                  type="button"
                  className="priority-action-button"
                  onClick={() => setActiveTab("steps")}
                >
                  View all action steps →
                </button>
              </div>

              <div className="report-metrics">
                <div className="report-metric">
                  <span>Severity</span>

                  <strong>
                    {analysisData.riskAssessment?.severityScore ?? "N/A"}

                    {analysisData.riskAssessment?.severityScore !== undefined &&
                    analysisData.riskAssessment?.severityScore !== "N/A"
                      ? "/10"
                      : ""}
                  </strong>
                </div>

                <div className="report-metric">
                  <span>Financial exposure</span>

                  <strong>
                    {analysisData.riskAssessment?.financialExposure ||
                      "Not established"}
                  </strong>
                </div>

                <div className="report-metric">
                  <span>Time sensitivity</span>

                  <strong>
                    {analysisData.riskAssessment?.timeSensitivity ||
                      "Review required"}
                  </strong>
                </div>
              </div>

              <nav className="result-tabs">
                {tabs.map(([id, label]) => (
                  <button
                    key={id}
                    className={activeTab === id ? "active" : ""}
                    onClick={() => setActiveTab(id)}
                  >
                    {label}
                  </button>
                ))}
              </nav>

              {activeTab === "overview" && (
                <div className="result-content">
                  {analysisData.situation && (
                    <div className="result-section situation-summary-card">
                      <span className="section-eyebrow">SITUATION</span>

                      <h3>What VERLO understood</h3>

                      <p>{analysisData.situation}</p>
                    </div>
                  )}

                  <div className="result-section assistant-section">
                    <h3>Ask VERLO AI</h3>

                    <p>Need immediate clarification or follow-up response?</p>

                    {chatHistory.length > 0 && (
                      <div className="chat-history">
                        {chatHistory.map((msg, index) => (
                          <div
                            key={index}
                            className={`chat-message ${msg.role}`}
                          >
                            <strong>
                              {msg.role === "user" ? "You" : "VERLO AI"}
                            </strong>

                            {msg.attachment && (
                              <small>
                                📎 Attached file: {msg.attachment.name}
                              </small>
                            )}

                            {msg.role === "user" ? (
                              <div>{msg.content}</div>
                            ) : (
                              <div
                                className="markdown-content"
                                dangerouslySetInnerHTML={{
                                  __html: renderMarkdownToHTML(msg.content),
                                }}
                              />
                            )}
                          </div>
                        ))}
                      </div>
                    )}

                    {chatAttachment && (
                      <div className="attachment">
                        <span>📎 {chatAttachment.name}</span>

                        <button
                          type="button"
                          onClick={() => removeAttachment("chat")}
                        >
                          Remove
                        </button>
                      </div>
                    )}

                    <form className="chat-form" onSubmit={handleChatSubmit}>
                      <input
                        className="form-input"
                        placeholder="Ask a question or upload file..."
                        value={chatQuestion}
                        onChange={(e) => setChatQuestion(e.target.value)}
                        disabled={isChatLoading}
                      />

                      <label className="chat-file-button">
                        📎
                        <input
                          type="file"
                          hidden
                          onChange={(e) =>
                            handleSecureFileUpload(e.target.files?.[0], "chat")
                          }
                        />
                      </label>

                      <button
                        type="submit"
                        className="btn-primary"
                        disabled={isChatLoading}
                      >
                        {isChatLoading ? "..." : "Send"}
                      </button>
                    </form>
                  </div>
                </div>
              )}

              {activeTab === "panels" && (
                <div className="result-section">
                  <h3>Personalised Issue Solution Panels</h3>

                  {!analysisData.personalizedPanels?.length ? (
                    <p>No custom panels generated for this query.</p>
                  ) : (
                    <div className="panel-grid">
                      {analysisData.personalizedPanels.map((panel, index) => (
                        <div className="solution-panel" key={index}>
                          <strong>{panel.panelTitle}</strong>

                          <div
                            className="markdown-content"
                            dangerouslySetInnerHTML={{
                              __html: renderMarkdownToHTML(panel.insight),
                            }}
                          />

                          <div className="solution">
                            <strong>Recommended Solution:</strong>{" "}
                            {panel.solution}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {activeTab === "steps" && (
                <div className="result-section">
                  <h3>Full Step-by-Step Action Pathway</h3>

                  <div className="action-list">
                    {analysisData.nextSteps?.map((item, index) => (
                      <div className="action-item" key={index}>
                        <div className="action-title">
                          <span>{index + 1}</span>

                          <strong>{item.step}</strong>
                        </div>

                        <p>
                          <strong>Why:</strong> {item.why}
                        </p>

                        {item.pitfallWarning && (
                          <p className="pitfall">
                            <strong>⚠️ Pitfall to Avoid:</strong>{" "}
                            {item.pitfallWarning}
                          </p>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {activeTab === "resources" && (
                <div className="result-section resources-section">
                  <div className="resources-header">
                    <div>
                      <span className="section-eyebrow">
                        VERIFIED RESOURCES
                      </span>

                      <h3>Useful Resources & Next-Step Links</h3>

                      <p>
                        VERLO has identified resources relevant to your
                        situation. Check that the information applies to your
                        location and circumstances before relying on it.
                      </p>
                    </div>
                  </div>

                  {(analysisData.referenceLinks || analysisData.resources || [])
                    .length === 0 ? (
                    <div className="resource-empty">
                      <strong>No specific resources were identified.</strong>

                      <p>
                        Use Ask VERLO AI above to ask for help finding the
                        relevant authority, regulator, service, or official
                        information for your situation.
                      </p>
                    </div>
                  ) : (
                    <div className="resource-list">
                      {(
                        analysisData.referenceLinks ||
                        analysisData.resources ||
                        []
                      ).map((link, index) => {
                        const resourceUrl =
                          link?.url || link?.link || link?.href || "";

                        const resourceTitle =
                          link?.title || link?.name || "Relevant resource";

                        const resourceDescription =
                          link?.description ||
                          link?.summary ||
                          link?.whyUseful ||
                          link?.relevance ||
                          "";

                        const resourceSource =
                          link?.source ||
                          link?.authority ||
                          link?.organisation ||
                          "";

                        if (!resourceUrl) {
                          return null;
                        }

                        return (
                          <a
                            key={index}
                            href={resourceUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="resource-card"
                          >
                            <div className="resource-card-main">
                              <div className="resource-icon">🔗</div>

                              <div className="resource-copy">
                                <strong>{resourceTitle}</strong>

                                {resourceSource && (
                                  <span className="resource-source">
                                    {resourceSource}
                                  </span>
                                )}

                                {resourceDescription && (
                                  <p>{resourceDescription}</p>
                                )}

                                <span className="resource-url">
                                  {resourceUrl}
                                </span>
                              </div>
                            </div>

                            <span className="resource-open">Open →</span>
                          </a>
                        );
                      })}
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
            <img src="/VVNormal.png" alt="VERLO Logo" />

            <span>VERLO</span>
          </div>

          <div>
            &copy; {new Date().getFullYear()} VERLO Engine. All rights reserved.
            Crafted with 🌶️.
          </div>
        </div>
      </footer>

      {showHistoryDrawer && (
        <aside
          id="history-drawer"
          className="history-drawer animate-slide-in-right"
        >
          <div className="drawer-header">
            <h3>Your Saved Pathways</h3>

            <button type="button" onClick={() => setShowHistoryDrawer(false)}>
              ✕
            </button>
          </div>

          {userHistory.length === 0 ? (
            <p>
              No saved reports yet. Click "Save Pathway" on any result screen!
            </p>
          ) : (
            <div className="history-list">
              {userHistory.map((item, index) => (
                <button
                  type="button"
                  className="history-item"
                  key={index}
                  onClick={() => {
                    setTitle(item.title);

                    setDescription(item.description);

                    setAnalysisData(item.result);

                    setStep("results");

                    setActiveTab("overview");

                    setShowHistoryDrawer(false);
                  }}
                >
                  <strong>{item.title}</strong>

                  <span>{new Date(item.timestamp).toLocaleDateString()}</span>
                </button>
              ))}
            </div>
          )}
        </aside>
      )}

      {showAuthModal && (
        <div className="auth-overlay">
          <div className="auth-modal">
            <div className="modal-header">
              <h3>
                {authMode === "login" ? "Log in to VERLO" : "Create an Account"}
              </h3>

              <button
                type="button"
                disabled={isAuthLoading}
                onClick={() => setShowAuthModal(false)}
              >
                ✕
              </button>
            </div>

            {authError && <div className="error-message">{authError}</div>}

            <button
              type="button"
              className="google-login-button"
              onClick={handleGoogleLogin}
              disabled={isAuthLoading}
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
            <br />
            <div className="auth-divider">
              <span>or continue with email</span>
            </div>
            <br />
            <form onSubmit={handleAuthSubmit}>
              <div className="form-group">
                <label className="form-label">Email Address</label>

                <input
                  type="email"
                  className="form-input"
                  value={authEmail}
                  onChange={(e) => setAuthEmail(e.target.value)}
                  required
                  disabled={isAuthLoading}
                />
              </div>

              <div className="form-group">
                <label className="form-label">Password</label>

                <input
                  type="password"
                  className="form-input"
                  value={authPassword}
                  onChange={(e) => setAuthPassword(e.target.value)}
                  required
                  disabled={isAuthLoading}
                />
              </div>

              <button
                type="submit"
                className="btn-primary full-width"
                disabled={isAuthLoading}
              >
                {isAuthLoading
                  ? "Please wait..."
                  : authMode === "login"
                    ? "Log In"
                    : "Sign Up"}
              </button>
            </form>

            <div className="auth-switch">
              {authMode === "login" ? (
                <>
                  Don't have an account?{" "}
                  <button
                    type="button"
                    disabled={isAuthLoading}
                    onClick={() => {
                      setAuthMode("signup");

                      setAuthError(null);
                    }}
                  >
                    Sign up
                  </button>
                </>
              ) : (
                <>
                  Already have an account?{" "}
                  <button
                    type="button"
                    disabled={isAuthLoading}
                    onClick={() => {
                      setAuthMode("login");

                      setAuthError(null);
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
