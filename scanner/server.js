import express from 'express';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import { fetchPage, closePage, launchBrowser, closeBrowser } from './lib/fetcher.js';
import { analyze } from './lib/analyzer.js';
import { generateSelectors } from './lib/selector.js';
import { analyzeWithLLM, getAvailableModels } from './lib/llm.js';
import { buildReference, formatAsJS } from './lib/generator.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const app = express();
const PORT = process.env.PORT || 8082;

app.use(express.json());
app.use('/ui', express.static(join(__dirname, 'ui')));
app.get('/', (req, res) => res.sendFile(join(__dirname, 'ui', 'index.html')));

// --- Available models ---
app.get('/api/models', (req, res) => {
  res.json(getAvailableModels());
});

// --- Health check ---
app.get('/api/health', async (req, res) => {
  try {
    await launchBrowser();
    res.json({ status: 'ok', browser: 'ready' });
  } catch (err) {
    res.status(500).json({ status: 'error', message: err.message });
  }
});

// --- Main scan endpoint ---
app.post('/api/scan', async (req, res) => {
  const { url, tagKeywords, scanImages, modelId, apiKey } = req.body;
  if (!url) return res.status(400).json({ error: 'URL is required' });

  // Validate URL
  try {
    const parsed = new URL(url);
    if (!['http:', 'https:'].includes(parsed.protocol)) {
      return res.status(400).json({ error: 'Only http/https URLs are supported' });
    }
  } catch {
    return res.status(400).json({ error: 'Invalid URL format' });
  }

  let page = null;
  try {
    console.log(`[scan] Fetching: ${url}`);

    // Step 1: Fetch page
    const fetchResult = await fetchPage(url);
    page = fetchResult.page;
    const { screenshot, elementData, pageMeta } = fetchResult;
    console.log(`[scan] Extracted ${elementData.length} elements`);
    // Debug: log a sample of what was extracted
    const sample = elementData.slice(0, 5).map(e => `${e.tagName}${e.id ? '#'+e.id : ''} ${e.rect.w}x${e.rect.h} text="${(e.innerText||'').slice(0,40)}"`);
    console.log(`[scan] Sample elements:`, sample);

    // Step 2: Heuristic analysis
    const sections = analyze(elementData);
    console.log(`[scan] Found ${sections.length} sections with ${sections.reduce((n, s) => n + s.items.length, 0)} items`);

    if (sections.length === 0 || sections.reduce((n, s) => n + s.items.length, 0) === 0) {
      await closePage(page);
      return res.json({
        reference: { items: {} },
        meta: { url: pageMeta.url, title: pageMeta.title, scannedAt: new Date().toISOString(), itemCount: 0, sectionTypes: [] },
        warning: 'No content sections detected on this page',
      });
    }

    // Step 3: Generate CSS selectors
    const sectionsWithSelectors = await generateSelectors(page, sections);
    console.log(`[scan] Generated selectors`);

    // Step 4: LLM analysis (only if scanImages is enabled)
    let llmResult = { items: [] };
    if (scanImages) {
      const selectedModel = modelId || 'claude-sonnet';
      try {
        llmResult = await analyzeWithLLM(screenshot, sectionsWithSelectors, pageMeta, { modelId: selectedModel, apiKey });
        console.log(`[scan] LLM (${selectedModel}) returned ${llmResult.items?.length || 0} items`);
      } catch (err) {
        console.error(`[scan] LLM analysis failed (continuing with heuristics):`, err.message);
      }
    } else {
      console.log(`[scan] Vision disabled — using heuristic tags only`);
    }

    // Step 5: Build reference file
    const result = buildReference(sectionsWithSelectors, llmResult, pageMeta, tagKeywords);
    console.log(`[scan] Generated reference with ${result.meta.itemCount} items`);

    await closePage(page);
    result.screenshot = screenshot;
    res.json(result);

  } catch (err) {
    if (page) await closePage(page);
    console.error(`[scan] Error:`, err.message);

    if (err.message.includes('timeout') || err.message.includes('Timeout')) {
      return res.status(408).json({ error: 'Page load timed out after 30 seconds' });
    }
    res.status(500).json({ error: err.message });
  }
});

// --- Startup ---
async function start() {
  try {
    await launchBrowser();
    console.log('[scanner] Puppeteer browser launched');
  } catch (err) {
    console.error('[scanner] Failed to launch browser:', err.message);
  }

  app.listen(PORT, () => {
    console.log(`[scanner] Server running at http://localhost:${PORT}`);
    console.log(`[scanner] Open http://localhost:${PORT} to use the scanner UI`);
  });
}

// Graceful shutdown
process.on('SIGINT', async () => { await closeBrowser(); process.exit(0); });
process.on('SIGTERM', async () => { await closeBrowser(); process.exit(0); });

start();
