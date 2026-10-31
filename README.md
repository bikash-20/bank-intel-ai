# BankIntel PWA — Bangladesh Bank & BSC MCQ Intelligence Platform

[![Next.js 16](https://img.shields.io/badge/Next.js-16.4.3-black?logo=next.js)](https://nextjs.org/)
[![Cloudflare Workers](https://img.shields.io/badge/Cloudflare-Workers_AI-F38020?logo=cloudflare)](https://workers.cloudflare.com/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg)](LICENSE)
[![Deployment](https://img.shields.io/badge/Deployment-Vercel-success?logo=vercel)](https://bank-intel-pwa.vercel.app)

**BankIntel PWA** is an ultra-fast, mobile-first, offline-capable Progressive Web App engineered specifically for candidates preparing for **Bangladesh Bank** (Assistant Director, Officer General, Officer Cash, Senior Officer IT) and **Bankers' Selection Committee (BSC)** recruitment exams.

- **Production Web App:** [https://bank-intel-pwa.vercel.app](https://bank-intel-pwa.vercel.app)
- **Edge AI Worker:** [https://bank-intel-worker.talukderbikash500.workers.dev](https://bank-intel-worker.talukderbikash500.workers.dev)

---

## Key Features

1. **Mobile-First & High-Craft Academic Glass Aesthetic:**
   - Deep obsidian dark mode (`#050608` canvas, specular frosted glass cards, emerald/rose status tokens).
   - Fully responsive for mobile devices with fixed bottom navigation, touch targets $\ge 48\text{px}$, and horizontal swiping facet chips.
   - Scaled font sizes for stems (`text-xl sm:text-2xl`) and options (`text-lg sm:text-xl`) to eliminate eye strain during intense 60-minute study drills.

2. **Full English ⇄ Bengali (`বাংলা`) Internationalization (i18n):**
   - Instant language toggle in the header and mobile bottom bar.
   - Full localization across all metrics, exam instructions, distractor trap diagnostics, mistake vaults, and option labels (`[A-D]` ⇄ `[ক-ঘ]`).
   - Bengali typography powered by Google Font **Hind Siliguri** with native Bengali digits.

3. **Multi-Model Edge AI Distractor Analysis ("Why Right / Why Wrong"):**
   - Single atomic request fetches:
     - **Core Concept / Axiom**: Fundamental formula or rule.
     - **30-Second Exam Hall Shortcut**: Option elimination tricks.
     - **Option Diagnostics**: Precise breakdown of why the correct option is right AND why each wrong option is a distractor trap.
   - Multi-model cascade on Cloudflare Workers AI: Llama-3.3-70B $\rightarrow$ Llama-3.1-8B $\rightarrow$ Edge fallback.
   - 4-Tier zero-cost read-through caching (RAM LRU $\rightarrow$ IndexedDB $\rightarrow$ Edge Isolate LRU $\rightarrow$ Cloudflare KV with 90-day TTL).

4. **Negative Marking Simulator (-0.25 Engine):**
   - Official BIBM exam conditions: 100 MCQs in 60 minutes with strict $-0.25$ negative marking.
   - Live telemetry: Net score, accuracy %, pace (sec/MCQ), points lost to penalty, and estimated percentile ranking.
   - Responsive and collapsible question navigation palette.

5. **Spaced Error Revision "Mistake Vault":**
   - All wrong answers and bookmarked questions automatically sync to local IndexedDB.
   - Auto-graduation engine: questions graduate only after 3 consecutive correct repetitions.

6. **Sub-millisecond Filtering via Bitmask Index:**
   - Multi-facet filtering using bitwise `Uint32Array` operations in $O(N/32)$ time ($\approx 0.02\text{ms}$ across thousands of questions).

---

## Architecture & Subsystems

```
bankjob/
├── scraper/              # Question extraction, normalization & KaTeX validation pipeline
│   ├── src/crawlers/     # Scrapers for real previous year exams
│   ├── src/normalizer.ts # KaTeX inline converter, unicode sanitizer, SHA-256 hasher
│   └── src/build-shards.ts # Static JSON shard emitter & manifest generator
├── worker/               # Cloudflare Workers AI multi-model backend
│   ├── src/ratelimit.ts  # In-memory sliding window rate limiter (O(1), zero KV writes)
│   ├── src/cache.ts      # Multi-tier isolate LRU + KV edge cache
│   ├── src/cascade.ts    # Llama 3.3 70B -> Llama 3.1 8B multi-model fallback cascade
│   └── src/index.ts      # Edge router & CORS handling
└── web/                  # Next.js 16 App Router PWA
    ├── app/              # Routes: /, /simulate, /vault, /practice/[shardId]
    ├── components/       # High-craft MCQ components, MathText, Layout, i18n
    ├── lib/db/           # IndexedDB v1 engine & React 19 useSyncExternalStore
    ├── lib/i18n/         # English & Bengali translation dictionaries & Context
    └── lib/search/       # Bitmask Inverted Index (Uint32Array)
```

---

## Local Development & Setup

### 1. Web App (Next.js 16)
```bash
cd web
npm install
npm run dev
```

### 2. Edge Worker (Cloudflare)
```bash
cd worker
npm install
npm test
npm run deploy
```

### 3. Scraper Pipeline
```bash
cd scraper
npm install
npm run build-shards
```

---

## Deployment

- **Frontend (Vercel):** Configured via root and web `vercel.json`. Deploy via `vercel --prod`.
- **Edge Backend (Cloudflare Workers):** Configured via `worker/wrangler.toml`. Deploy via `wrangler deploy`.

---

## License
MIT License. Built for Bangladesh Bank & BSC aspirants.
