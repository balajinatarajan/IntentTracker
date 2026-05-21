// Scanner UI — frontend logic

let currentData = null; // { reference, meta }

const urlInput = document.getElementById('url-input');
const scanBtn = document.getElementById('scan-btn');
const progressEl = document.getElementById('progress');
const errorBox = document.getElementById('error-box');
const errorText = document.getElementById('error-text');
const resultsEl = document.getElementById('results');
const resultsCode = document.getElementById('results-code');

// Enter key triggers scan
urlInput.addEventListener('keydown', (e) => {
  if (e.key === 'Enter') startScan();
});

// Toggle shows/hides model selector + API key input
const scanImagesToggle = document.getElementById('scan-images-toggle');
const modelSelectorDiv = document.getElementById('model-selector');
const apiKeyInputDiv = document.getElementById('api-key-input');
scanImagesToggle.addEventListener('change', () => {
  const show = scanImagesToggle.checked;
  modelSelectorDiv.style.display = show ? 'flex' : 'none';
  apiKeyInputDiv.style.display = show ? 'block' : 'none';
});

// Load available models on page init
(async function loadModels() {
  try {
    const res = await fetch('/api/models');
    const models = await res.json();
    const select = document.getElementById('model-select');
    select.innerHTML = '';
    for (const m of models) {
      const opt = document.createElement('option');
      opt.value = m.id;
      opt.textContent = m.available ? m.label : `${m.label} (no API key)`;
      if (!m.available) opt.classList.add('model-unavailable');
      select.appendChild(opt);
    }
  } catch (e) {
    console.warn('Failed to load models:', e);
  }
})();

async function startScan() {
  const url = urlInput.value.trim();
  if (!url) { urlInput.focus(); return; }

  // Ensure URL has protocol
  const fullUrl = url.match(/^https?:\/\//) ? url : `https://${url}`;

  // Reset UI
  errorBox.style.display = 'none';
  resultsEl.style.display = 'none';
  progressEl.style.display = 'block';
  scanBtn.disabled = true;
  scanBtn.textContent = 'Scanning...';

  setStep('fetch');

  try {
    const tagKeywords = parseTagKeywords();
    const scanImages = document.getElementById('scan-images-toggle')?.checked || false;
    const modelId = document.getElementById('model-select')?.value || 'claude-sonnet';
    const apiKey = document.getElementById('api-key')?.value?.trim() || null;
    const res = await fetch('/api/scan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ url: fullUrl, tagKeywords, scanImages, modelId, apiKey }),
    });

    const data = await res.json();

    if (!res.ok) {
      throw new Error(data.error || `Server returned ${res.status}`);
    }

    currentData = data;
    setStep('done');
    setTimeout(() => {
      progressEl.style.display = 'none';
      renderResults(data);
      renderScreenshot(data.screenshot);
    }, 500);

  } catch (err) {
    progressEl.style.display = 'none';
    showError(err.message);
  } finally {
    scanBtn.disabled = false;
    scanBtn.textContent = 'Scan';
  }
}

function setStep(step) {
  const steps = ['fetch', 'analyze', 'llm', 'build'];
  const fill = document.getElementById('progress-fill');

  if (step === 'done') {
    steps.forEach(s => {
      document.getElementById(`step-${s}`).className = 'step done';
    });
    fill.style.width = '100%';
    return;
  }

  const idx = steps.indexOf(step);
  steps.forEach((s, i) => {
    const el = document.getElementById(`step-${s}`);
    if (i < idx) el.className = 'step done';
    else if (i === idx) el.className = 'step active';
    else el.className = 'step';
  });
  fill.style.width = `${((idx + 1) / steps.length) * 100}%`;

  // Auto-advance steps on timers (since the API is a single call)
  if (step === 'fetch') setTimeout(() => setStep('analyze'), 2000);
  if (step === 'analyze') setTimeout(() => setStep('llm'), 1500);
  if (step === 'llm') setTimeout(() => setStep('build'), 3000);
}

function showError(message) {
  errorText.textContent = message;
  errorBox.style.display = 'flex';
}

function renderResults(data) {
  const { reference, meta, warning } = data;

  // Update meta
  document.getElementById('meta-count').textContent = `${meta.itemCount} items`;
  document.getElementById('meta-sections').textContent = `${meta.sectionTypes?.length || 0} section types`;
  document.getElementById('meta-url').textContent = meta.url || '';

  if (warning) {
    showError(warning);
  }

  // Render the reference as syntax-highlighted, editable JSON
  renderCode(reference);
  resultsEl.style.display = 'block';
}

function renderCode(reference) {
  const items = reference.items || {};
  const selectors = Object.keys(items);

  if (selectors.length === 0) {
    resultsCode.innerHTML = '<span class="syn-brace">{ "items": {} }</span>';
    return;
  }

  let html = '<span class="syn-brace">{</span>\n';
  html += '  <span class="syn-key">"items"</span><span class="syn-brace">: {</span>\n';

  selectors.forEach((sel, i) => {
    const item = items[sel];
    const comma = i < selectors.length - 1 ? ',' : '';

    html += `    <span class="syn-selector">"${escHtml(sel)}"</span><span class="syn-brace">: {</span>\n`;
    html += `      <span class="syn-key">"id"</span>: <span class="syn-str">"${escHtml(item.id)}"</span>,\n`;
    html += `      <span class="syn-key">"name"</span>: <span class="syn-str editable" data-sel="${escAttr(sel)}" data-field="name">"${escHtml(item.name)}"</span>,\n`;
    html += `      <span class="syn-key">"tags"</span>: <span class="syn-str editable" data-sel="${escAttr(sel)}" data-field="tags">"${escHtml(item.tags)}"</span>,\n`;
    html += `      <span class="syn-key">"group"</span>: <span class="syn-str editable" data-sel="${escAttr(sel)}" data-field="group">"${escHtml(item.group)}"</span>`;
    if (item.price) {
      html += `,\n      <span class="syn-key">"price"</span>: <span class="syn-str editable" data-sel="${escAttr(sel)}" data-field="price">"${escHtml(item.price)}"</span>`;
    }
    html += `\n    <span class="syn-brace">}</span>${comma}\n`;
  });

  html += '  <span class="syn-brace">}</span>\n';
  html += '<span class="syn-brace">}</span>';

  resultsCode.innerHTML = html;

  // Attach click handlers for inline editing
  resultsCode.querySelectorAll('.editable').forEach(el => {
    el.addEventListener('click', handleEditClick);
  });
}

function handleEditClick(e) {
  const span = e.target;
  const sel = span.dataset.sel;
  const field = span.dataset.field;
  const currentValue = currentData.reference.items[sel]?.[field] || '';

  const input = document.createElement('input');
  input.type = 'text';
  input.className = 'editable-input';
  input.value = currentValue;
  input.style.width = Math.max(currentValue.length * 8, 80) + 'px';

  span.replaceWith(input);
  input.focus();
  input.select();

  function commit() {
    const newValue = input.value.trim();
    if (currentData.reference.items[sel]) {
      currentData.reference.items[sel][field] = newValue;
      // Update ID if name changed
      if (field === 'name') {
        currentData.reference.items[sel].id = slugify(newValue);
      }
    }
    renderCode(currentData.reference);
  }

  input.addEventListener('blur', commit);
  input.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') commit();
    if (e.key === 'Escape') renderCode(currentData.reference);
  });
}

// --- Actions ---

function copyJSON() {
  if (!currentData) return;
  const json = JSON.stringify(currentData.reference, null, 2);
  navigator.clipboard.writeText(json).then(() => {
    flashButton('Copy JSON', 'Copied!');
  });
}

function downloadJS() {
  if (!currentData) return;
  const js = `const REFERENCE = ${JSON.stringify(currentData.reference, null, 2)};\n`;
  downloadFile(js, 'reference.js', 'text/javascript');
}

function downloadJSON() {
  if (!currentData) return;
  const json = JSON.stringify(currentData.reference, null, 2);
  downloadFile(json, 'reference.json', 'application/json');
}

function downloadFile(content, filename, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function flashButton(text, flashText) {
  const btn = Array.from(document.querySelectorAll('.btn-action')).find(b => b.textContent === text);
  if (!btn) return;
  btn.textContent = flashText;
  btn.style.color = 'var(--green)';
  btn.style.borderColor = 'var(--green)';
  setTimeout(() => {
    btn.textContent = text;
    btn.style.color = '';
    btn.style.borderColor = '';
  }, 1500);
}

// --- Screenshot Preview ---

function renderScreenshot(base64) {
  const section = document.getElementById('screenshot-section');
  const img = document.getElementById('screenshot-img');
  if (!base64) { section.style.display = 'none'; return; }
  img.src = `data:image/png;base64,${base64}`;
  section.style.display = 'block';
}

// --- Tag Keywords Parsing ---

function parseTagKeywords() {
  const textarea = document.getElementById('tag-keywords');
  if (!textarea) return null;
  const text = textarea.value.trim();
  if (!text) return null;

  const keywords = {};
  for (const line of text.split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue; // skip empty/comments
    const colonIdx = trimmed.indexOf(':');
    if (colonIdx < 1) continue;
    const tag = trimmed.slice(0, colonIdx).trim().toLowerCase();
    const words = trimmed.slice(colonIdx + 1).split(',').map(w => w.trim().toLowerCase()).filter(Boolean);
    if (tag && words.length > 0) keywords[tag] = words;
  }
  return Object.keys(keywords).length > 0 ? keywords : null;
}

// --- Utils ---

function escHtml(str) {
  return String(str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function escAttr(str) {
  return String(str || '').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

function slugify(name) {
  return name.toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40) || 'item';
}
