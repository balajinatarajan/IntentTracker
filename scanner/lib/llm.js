// Multi-provider LLM integration for site scanning
// Supports: Claude (Anthropic) and Gemini (Google)

const SYSTEM_PROMPT = `You are a web content analyzer that identifies trackable content items on webpages.

Given a screenshot of a webpage and a list of detected content sections with their DOM snippets, your job is to:

1. Confirm which sections contain meaningful content items (product cards, listings, hero banners, carousel items)
2. For each content item, generate:
   - name: A concise human-readable name (e.g., "Sunset Beach Resort", "Mountain Adventure Package")
   - tags: Comma-separated semantic tags describing the item's topic, style, and category (e.g., "beach, luxury, spa, romantic, tropical")
   - group: A grouping label that categorizes similar items together (e.g., "featured-resorts", "deals", "hero")
   - price: Price tier if detectable from text/context: "luxury", "mid-range", or "budget". Use null if not determinable.

Guidelines for tags:
- Include topic tags (beach, mountain, city, food, adventure)
- Include style/mood tags (luxury, cozy, romantic, family-friendly, modern)
- Include activity tags (spa, skiing, diving, hiking, dining)
- Keep tags lowercase, no special characters
- Aim for 3-6 tags per item

Respond ONLY with valid JSON in this exact format:
{
  "items": [
    {
      "sectionIndex": 0,
      "itemIndex": 0,
      "name": "Item Name",
      "tags": "tag1, tag2, tag3",
      "group": "group-name",
      "price": "luxury" | "mid-range" | "budget" | null
    }
  ]
}`;

// Available models
export const MODELS = {
  'claude-sonnet': { provider: 'anthropic', model: 'claude-sonnet-4-20250514', label: 'Claude Sonnet', envKey: 'ANTHROPIC_API_KEY' },
  'gemini-pro':    { provider: 'google',    model: 'gemini-2.0-flash',        label: 'Gemini Flash',  envKey: 'GEMINI_API_KEY' },
};

export function getAvailableModels() {
  return Object.entries(MODELS).map(([id, m]) => ({
    id,
    label: m.label,
    available: !!process.env[m.envKey],
  }));
}

// --- Main entry point ---

export async function analyzeWithLLM(screenshot, sections, pageMeta, { modelId = 'claude-sonnet', apiKey: runtimeKey } = {}) {
  const modelConfig = MODELS[modelId];
  if (!modelConfig) throw new Error(`Unknown model: ${modelId}`);

  const apiKey = runtimeKey || process.env[modelConfig.envKey];
  if (!apiKey) throw new Error(`API key required for ${modelConfig.label} — provide it in the UI or set ${modelConfig.envKey} env var`);

  const { userText, sectionDescriptions } = buildPromptText(sections, pageMeta);

  if (modelConfig.provider === 'anthropic') {
    return callClaude(apiKey, modelConfig.model, screenshot, userText);
  } else if (modelConfig.provider === 'google') {
    return callGemini(apiKey, modelConfig.model, screenshot, userText);
  }

  throw new Error(`Unsupported provider: ${modelConfig.provider}`);
}

// --- Prompt builder (shared across providers) ---

function buildPromptText(sections, pageMeta) {
  const sectionDescriptions = sections.map((section, i) => {
    const itemSnippets = section.items.slice(0, 8).map((item, j) => {
      const text = item.innerText || item.text || '';
      return `  [${j}] selector="${item.selector || 'unknown'}" text="${text.slice(0, 120)}" hasImage=${item.hasImage} hasPrice=${item.hasPrice || false}`;
    }).join('\n');
    return `Section ${i} (type: ${section.type}, ${section.items.length} items):\n${itemSnippets}`;
  }).join('\n\n');

  const userText = `Analyze this webpage: ${pageMeta.title || pageMeta.url}
URL: ${pageMeta.url}

Detected content sections:
${sectionDescriptions}

For each item in each section, provide semantic tags, a name, group, and price tier. Match items by sectionIndex and itemIndex.`;

  return { userText, sectionDescriptions };
}

// --- Claude (Anthropic) ---

async function callClaude(apiKey, model, screenshot, userText) {
  const { default: Anthropic } = await import('@anthropic-ai/sdk');
  const client = new Anthropic({ apiKey });

  const content = [
    { type: 'image', source: { type: 'base64', media_type: 'image/png', data: screenshot } },
    { type: 'text', text: userText },
  ];

  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      response = await client.messages.create({
        model,
        max_tokens: 4096,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }],
      });
      break;
    } catch (err) {
      if (attempt === 0 && (err.status === 429 || err.status >= 500)) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }

  const text = response.content.filter(b => b.type === 'text').map(b => b.text).join('');
  return parseJSON(text);
}

// --- Gemini (Google) ---

async function callGemini(apiKey, model, screenshot, userText) {
  const url = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;

  const parts = [
    { inlineData: { mimeType: 'image/png', data: screenshot } },
    { text: `${SYSTEM_PROMPT}\n\n${userText}` },
  ];

  let response;
  for (let attempt = 0; attempt < 2; attempt++) {
    try {
      const res = await fetch(url, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts }],
          generationConfig: { temperature: 0, maxOutputTokens: 4096 },
        }),
      });

      if (!res.ok) {
        const err = await res.text();
        if (attempt === 0 && (res.status === 429 || res.status >= 500)) {
          await new Promise(r => setTimeout(r, 2000));
          continue;
        }
        throw new Error(`Gemini API error ${res.status}: ${err.slice(0, 200)}`);
      }

      response = await res.json();
      break;
    } catch (err) {
      if (attempt === 0 && err.message?.includes('fetch')) {
        await new Promise(r => setTimeout(r, 2000));
        continue;
      }
      throw err;
    }
  }

  const text = response.candidates?.[0]?.content?.parts
    ?.filter(p => p.text)
    ?.map(p => p.text)
    ?.join('') || '';

  return parseJSON(text);
}

// --- Shared JSON parser ---

function parseJSON(text) {
  try {
    return JSON.parse(text);
  } catch {
    const match = text.match(/```(?:json)?\s*([\s\S]*?)```/);
    if (match) return JSON.parse(match[1]);

    const braceMatch = text.match(/\{[\s\S]*\}/);
    if (braceMatch) return JSON.parse(braceMatch[0]);

    console.error('LLM response not parseable as JSON:', text.slice(0, 500));
    return { items: [] };
  }
}
