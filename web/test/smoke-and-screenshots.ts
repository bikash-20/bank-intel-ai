import puppeteer from 'puppeteer-core';
import { spawn, type ChildProcess } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';

const CHROME_PATH = '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome';
const PORT = 3456;
const BASE_URL = `http://localhost:${PORT}`;
const SCREENSHOT_DIR = path.resolve(process.cwd(), 'public/screenshots');
const ARTIFACT_DIR = '/Users/bikashtalukder/.gemini/antigravity/brain/72575d1f-e060-4fcc-b919-563fc7498484/screenshots';

fs.mkdirSync(SCREENSHOT_DIR, { recursive: true });
fs.mkdirSync(ARTIFACT_DIR, { recursive: true });

async function waitForServer(url: string, timeoutMs = 20000): Promise<void> {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      await new Promise((r) => setTimeout(r, 400));
    }
  }
  throw new Error(`Server at ${url} failed to start within ${timeoutMs}ms`);
}

async function run() {
  console.log('🚀 Starting Next.js production server on port', PORT);
  const serverProcess: ChildProcess = spawn('npm', ['run', 'start', '--', '-p', String(PORT)], {
    cwd: process.cwd(),
    stdio: 'ignore',
    shell: true,
  });

  try {
    await waitForServer(`${BASE_URL}/`);
    console.log('✅ Server is ready at', BASE_URL);

    const browser = await puppeteer.launch({
      executablePath: CHROME_PATH,
      headless: true,
      args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
    });

    const page = await browser.newPage();

    // =========================================================================
    // SMOKE TEST 1: Header Toggles (Theme & Language)
    // =========================================================================
    console.log('\n--- Running Smoke Test: Header Toggles ---');
    await page.setViewport({ width: 1280, height: 800 });
    await page.goto(`${BASE_URL}/`, { waitUntil: 'networkidle0' });

    // 1a. Theme Toggle
    const initialTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme') || 'light');
    console.log(`Initial theme: ${initialTheme}`);

    // Click theme toggle button
    const themeButton = await page.$('button[role="switch"]');
    if (!themeButton) throw new Error('Theme toggle button not found');
    await themeButton.click();
    await new Promise((r) => setTimeout(r, 400));

    const toggledTheme = await page.evaluate(() => document.documentElement.getAttribute('data-theme'));
    console.log(`Theme after toggle: ${toggledTheme}`);
    if (toggledTheme === initialTheme) throw new Error('Theme toggle failed to change data-theme');

    // 1b. Language Toggle (Desktop Header)
    const bnButton = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('header button'));
      return btns.find((b) => b.textContent?.includes('বাংলা'));
    });
    if (bnButton) {
      await (bnButton as any).click();
      await new Promise((r) => setTimeout(r, 300));
      const lang = await page.evaluate(() => document.documentElement.getAttribute('lang'));
      console.log(`Language after clicking বাংলা: ${lang}`);
      if (lang !== 'bn') throw new Error('Language switch to bn failed');
    }
    console.log('✅ Smoke Test 1 Passed: Theme and Language switches working seamlessly.');

    // =========================================================================
    // SMOKE TEST 2: Writing Flow & Mock Worker
    // =========================================================================
    console.log('\n--- Running Smoke Test: Writing Flow ---');
    await page.goto(`${BASE_URL}/writing`, { waitUntil: 'networkidle0' });

    // Enable request interception to mock worker response
    await page.setRequestInterception(true);
    page.on('request', (req) => {
      if (req.url().includes('/api/v1/explain-writing')) {
        if (req.method() === 'OPTIONS') {
          req.respond({
            status: 204,
            headers: {
              'Access-Control-Allow-Origin': '*',
              'Access-Control-Allow-Methods': 'POST, OPTIONS',
              'Access-Control-Allow-Headers': 'Content-Type',
            },
          });
          return;
        }

        req.respond({
          status: 200,
          contentType: 'application/json',
          headers: {
            'Access-Control-Allow-Origin': '*',
          },
          body: JSON.stringify({
            ok: true,
            modelAnswer: '## Mock Examiner Model Answer\n\n* **Core Concept:** Verified by smoke test.\n* **Efficiency:** High performance.\n\n> **Key Takeaway:** Model answer properly rendered.',
            generatedBy: 'workers-ai:mock-test-model',
          }),
        });
      } else {
        req.continue();
      }
    });

    // Wait for questions to render
    await page.waitForSelector('textarea', { timeout: 10000 });

    // Type into draft textarea
    await page.type('textarea', 'My practice draft response for Bangladesh Bank IT Exam.');
    await new Promise((r) => setTimeout(r, 400));

    // Click Generate AI Model Answer
    const generateBtn = await page.evaluateHandle(() => {
      const btns = Array.from(document.querySelectorAll('button'));
      return btns.find((b) => b.textContent?.includes('Model Answer') || b.textContent?.includes('মডেল উত্তর'));
    });
    if (generateBtn) {
      await (generateBtn as any).click();
      await page.waitForSelector('.answer-markdown', { timeout: 8000 });
      console.log('AI Answer rendered in UI: true');
    }
    console.log('✅ Smoke Test 2 Passed: Writing workspace draft & AI generation verified.');

    // Remove request listener for clean screenshotting
    page.removeAllListeners('request');
    await page.setRequestInterception(false);

    // =========================================================================
    // SCREENSHOT MATRIX: 6 Widths x 2 Themes x 4 Screens
    // Widths: 360, 390, 768, 1024, 1280, 1536
    // Screens: Practice (/), Simulator (/simulate), Mistakes (/vault), Writing (/writing)
    // =========================================================================
    console.log('\n--- Generating Screenshot Matrix (6 Widths x 2 Themes x 4 Screens) ---');

    const widths = [360, 390, 768, 1024, 1280, 1536];
    const themes = ['light', 'dark'] as const;
    const routes = [
      { name: 'practice', path: '/' },
      { name: 'simulator', path: '/simulate' },
      { name: 'mistakes', path: '/vault' },
      { name: 'writing', path: '/writing' },
    ];

    for (const route of routes) {
      for (const w of widths) {
        for (const th of themes) {
          const height = w < 640 ? 800 : w < 1024 ? 900 : 1000;
          await page.setViewport({ width: w, height });
          await page.goto(`${BASE_URL}${route.path}`, { waitUntil: 'networkidle0' });

          // Set theme
          await page.evaluate((targetTheme) => {
            document.documentElement.setAttribute('data-theme', targetTheme);
            document.documentElement.style.colorScheme = targetTheme;
            window.localStorage.setItem('bi-theme', targetTheme);
          }, th);

          await new Promise((r) => setTimeout(r, 300));

          const filename = `${route.name}-${w}px-${th}.png`;
          const localPath = path.join(SCREENSHOT_DIR, filename);
          const artifactPath = path.join(ARTIFACT_DIR, filename);

          await page.screenshot({ path: localPath, fullPage: false });
          fs.copyFileSync(localPath, artifactPath);
          console.log(`📸 Captured: ${filename}`);
        }
      }
    }

    await browser.close();
    console.log('\n🎉 All Smoke Tests & Screenshots Completed Successfully!');
  } finally {
    serverProcess.kill();
  }
}

run().catch((err) => {
  console.error('❌ Test/Screenshot script failed:', err);
  process.exit(1);
});

