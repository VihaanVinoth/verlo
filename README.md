# Verlo
### Decision Intelligence & Algorithmic Logic Engine

Verlo is a professional-grade platform that gathers raw disputes, technical emergencies, and administrative friction points, converting them into rigorous game-theoretic risk models, actionable tactical pathways, and legally or technically binding correspondence.

<div align="center">
  <img src="public/VVNormal.png" alt="Verlo Logo" width="80" />
</div>

## Key Concepts & Pillars

* **Deterministic Risk Synthesis:** Moves way beyond passive chat generation by calculating **quantified** financial exposures, strict severity matrices (from 1-10), and temporal urgency windows.

* **Dual-Layer Safety Shield:** Features a lightning-fast local regex structure and keyword moderation filter, including strict semantic AI guardrails to intercept inappropriate, NSFW inputs before tokens are processed.

* **Zero Hallucination Schemas:** Verlo implements enforced JSON output structures (`response_format: { type: 'json_object' }`) to guarantee bulletproof frontend reliability.

* **Instant Action Generation:** Bridges diagnosis and execution by auto-generating formal executive letters, legal dispute notices, or step-by-step technical protocols.

* **Persistent User Accounts & History:** Secure local-storage authenticated sessions allowing users to save, review, and manage past decision pathways seamlessly via a dedicated history drawer.

---

## Tech Stack

* **Frontend:** React, Vite, Modern CSS (Glassmorphism UI)
* **Backend:** Node.js, Express, CORS 
* **AI Engine:** Groq SDK (`llama-3.3-70b-versatile`)
* **Security & Assets:** Integrated multi-tier content moderation pipeline (`moderation.json`), custom web manifest icons, and optimized favicons (`favicon.ico`, apple-touch-icon, android-chrome variants).

---

## Local Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone [https://github.com/VihaanVinoth/verlo.git](https://github.com/VihaanVinoth/verlo.git)
   cd verlo
   ```
2. **Configure Environment Variables:**
    ```bash
    PORT=5001
    GROQ_API_KEY="YOUR_GROQ_API_KEY_HERE"
    ```
Note: The default port number is `5001`. If it clashes with other services, change the port in your `.env` file and update occurrences across server.js, App.jsx, and api.js (using `Ctrl+F` (or `CMD+F` on Mac) to search for `5001`).

3. **Install Dependencies & Run:**
    ```bash
    # Install dependencies
    npm install

    # Start the development server
    npm run dev
    ```