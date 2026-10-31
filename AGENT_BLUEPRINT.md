# AGENT_BLUEPRINT.md — Autonomous Engineering Specification
**Project Name:** `bank-intel-pwa` (Bangladesh Bank & BSC MCQ Intelligence Platform)  
**Architecture Paradigm:** Local-First Offline PWA + Edge AI Multi-Model Cascade  
**UI Language:** English Only (Phase 1)  
**Authentication:** None in Phase 1 (Local-first anonymous state via IndexedDB; Auth deferred to Phase 2)  
**Target Role of AI Agent:** Principal Full-Stack & Systems Engineer.

---

## 1. Product Requirements Document (PRD)

### 1.1 Executive Summary & Problem Statement
Candidates preparing for **Bangladesh Bank (Assistant Director, Officer General, Officer Cash, Senior Officer IT)** and **Bankers' Selection Committee (BSC)** exams face a brutal constraint: **100 MCQs in 60 minutes (36 seconds per question)** with a **-0.25 negative marking penalty** for every wrong answer. Existing platforms suffer from bloated UIs, slow page loads, poor math rendering, and generic explanations that fail to explain *why* a specific option is a trap (distractor).

`bank-intel-pwa` solves this via an ultra-fast, offline-capable Progressive Web App (PWA) backed by static content shards, IndexedDB persistence, and an **on-demand Per-Option AI Explain Toggle** powered by a Cloudflare Workers AI multi-model cascade.

### 1.2 Core Functional Requirements (Phase 1 Scope)
1. **Zero-Latency Question Bank Browser & Practice Mode:**
   - Filter previous year questions by **Exam Body** (`BB`, `BSC`), **Post** (`AD`, `OFFICER_GEN`, `OFFICER_CASH`, `SO_IT`), **Year** (`2015–2026`), **Subject** (`English`, `Mathematics`, `Analytical Ability`, `Computer & ICT`, `General Knowledge`), and **Exam Taker Faculty** (`BIBM`, `IBA`, `DU_ARTS`, `CTI`).
   - Instant option selection (`A`, `B`, `C`, `D`) with immediate visual feedback (Correct / Wrong) and automatic recording into IndexedDB.
2. **Per-Option AI Explain Toggle ("Why Right / Why Wrong"):**
   - Every MCQ card features an **"AI Explain"** toggle and per-option breakdown pills.
   - When triggered, the app checks local IndexedDB (`L2`) -> Edge Cache (`L3`) -> Multi-Model AI Cascade.
   - Instead of making 4 separate API calls for options A, B, C, and D, a **single atomic request** fetches a structured JSON payload containing:
     - `coreConcept`: 1-sentence fundamental rule or formula.
     - `examHallShortcut`: How to solve or eliminate options in under 30 seconds.
     - `optionDiagnostics`: Specific breakdown of why the correct option is right AND why each wrong option (`A/B/C/D`) is a distractor/trap.
3. **Real-Time Negative Marking Exam Simulator:**
   - 60-minute countdown timer with live telemetry:
     $$\text{Net Score} = (\text{Correct} \times 1.0) - (\text{Wrong} \times 0.25)$$
   - Displays **Accuracy %**, **Pace (sec/question)**, and **Risk Index** (how many points lost to negative marking).
4. **Automated "Mistake Vault" (Spaced Error Revision):**
   - Any question answered incorrectly or bookmarked is automatically indexed in the IndexedDB `mistakes` object store.
   - Dedicated view to re-drill weak questions until answered correctly 3 consecutive times (auto-graduates from the vault).

### 1.3 Strict Non-Goals (Phase 1)
- **No Bengali UI Chrome:** All navigation, buttons, metrics, and AI explanations must be in crisp, high-craft English.
- **No Authentication / User Accounts:** Zero login walls. All state persists locally via `IndexedDB` + `localStorage`.

