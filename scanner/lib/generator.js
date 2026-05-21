// Assemble the final reference file from heuristic sections + LLM output

// Default tag keywords used when no custom keywords are provided
const DEFAULT_TAG_KEYWORDS = {
  beach: ['beach', 'ocean', 'sea', 'coast', 'tropical'],
  mountain: ['mountain', 'alpine', 'ski', 'hiking', 'trek'],
  city: ['city', 'urban', 'downtown', 'metro'],
  luxury: ['luxury', 'premium', '5-star', 'exclusive', 'suite'],
  budget: ['budget', 'affordable', 'cheap', 'deal', 'value'],
  family: ['family', 'kid', 'children'],
  romantic: ['romantic', 'couples', 'honeymoon'],
  food: ['food', 'dining', 'restaurant', 'cuisine', 'culinary'],
  spa: ['spa', 'wellness', 'relax'],
  adventure: ['adventure', 'explore', 'discover'],
};

export function buildReference(sections, llmResult, pageMeta, customTagKeywords) {
  const items = {};
  const usedIds = new Set();

  // Use custom keywords if provided, otherwise defaults
  const tagKeywords = customTagKeywords || DEFAULT_TAG_KEYWORDS;

  // Build regex map from keywords (once)
  const tagPatterns = {};
  for (const [tag, words] of Object.entries(tagKeywords)) {
    const escaped = words.map(w => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    tagPatterns[tag] = new RegExp(escaped.join('|'), 'i');
  }

  // Index LLM items by section+item index for quick lookup
  const llmIndex = new Map();
  if (llmResult?.items) {
    for (const item of llmResult.items) {
      llmIndex.set(`${item.sectionIndex}:${item.itemIndex}`, item);
    }
  }

  for (let si = 0; si < sections.length; si++) {
    const section = sections[si];

    for (let ii = 0; ii < section.items.length; ii++) {
      const heuristic = section.items[ii];
      const llm = llmIndex.get(`${si}:${ii}`);

      // Skip items without a valid selector
      if (!heuristic.selector) continue;

      // Build the item metadata
      const name = llm?.name || extractName(heuristic) || `item-${si}-${ii}`;
      const id = slugify(name, usedIds);
      usedIds.add(id);

      const tags = llm?.tags || inferTags(heuristic, section, tagPatterns);
      const group = llm?.group || inferGroup(heuristic, section);
      const price = llm?.price || inferPrice(heuristic);

      items[heuristic.selector] = {
        id,
        name,
        tags: typeof tags === 'string' ? tags : tags.join(', '),
        group,
        ...(price ? { price } : {}),
      };
    }
  }

  return {
    reference: { items },
    meta: {
      url: pageMeta.url,
      title: pageMeta.title,
      scannedAt: new Date().toISOString(),
      itemCount: Object.keys(items).length,
      sectionTypes: [...new Set(sections.map(s => s.type))],
    },
  };
}

function extractName(el) {
  const text = el.innerText || el.text || '';
  const firstLine = text.split('\n').find(l => l.trim().length > 2);
  if (firstLine && firstLine.length <= 60) return firstLine.trim();
  if (text.length <= 60) return text.trim();
  return text.slice(0, 50).trim() + '...';
}

function slugify(name, usedIds) {
  let slug = name
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '')
    .slice(0, 40);

  if (!slug) slug = 'item';

  let candidate = slug;
  let counter = 2;
  while (usedIds.has(candidate)) {
    candidate = `${slug}-${counter++}`;
  }
  return candidate;
}

// Stop words to exclude from tag extraction
const STOP_WORDS = new Set([
  'the','a','an','and','or','but','in','on','at','to','for','of','with','by','from','is','are',
  'was','were','be','been','being','have','has','had','do','does','did','will','would','shall',
  'should','may','might','can','could','this','that','these','those','it','its','i','you','he',
  'she','we','they','me','him','her','us','them','my','your','his','our','their','what','which',
  'who','whom','when','where','why','how','all','each','every','both','few','more','most','other',
  'some','such','no','not','only','own','same','so','than','too','very','just','about','up','out',
  'new','now','get','see','also','back','even','give','go','here','know','like','make','many',
  'much','one','two','way','well','come','take','use','find','first','last','long','great','little',
  'right','still','over','after','before','between','under','never','always','often','click','learn',
  'more','view','read','sign','log','join','free','start','try','today','best','top','check',
  'explore','discover','browse','shop','buy','offer','deal','save','off','per','month','year',
  'day','week','hour','minute','watch','listen','play','live','show','episode','channel','station',
]);

function inferTags(el, section, tagPatterns) {
  const tags = [];
  const text = (el.innerText || el.text || '').toLowerCase();

  // 1. Extract meaningful words from the element's content
  const contentTags = extractContentTags(text);

  // 2. Match against custom keyword patterns (if provided)
  if (tagPatterns && Object.keys(tagPatterns).length > 0) {
    for (const [tag, pattern] of Object.entries(tagPatterns)) {
      if (pattern.test(text)) tags.push(tag);
    }
  }

  // 3. Add content-derived tags (deduped against keyword matches)
  const tagSet = new Set(tags);
  for (const ct of contentTags) {
    if (!tagSet.has(ct)) { tags.push(ct); tagSet.add(ct); }
  }

  // 4. Add section type context
  if (el.hasImage && tags.length === 0) tags.push(section.type === 'hero' ? 'featured' : 'visual');

  return tags.slice(0, 8);
}

function extractContentTags(text) {
  // Split into words, filter noise, keep meaningful terms
  const words = text
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter(w => w.length >= 3 && w.length <= 25 && !STOP_WORDS.has(w) && !/^\d+$/.test(w));

  // Count word frequency — frequent words in the element are good tags
  const freq = {};
  for (const w of words) freq[w] = (freq[w] || 0) + 1;

  // Also extract 2-word phrases from the first 200 chars (compound tags like "hip hop", "rock music")
  const phrases = extractPhrases(text.slice(0, 200));

  // Score: phrases > frequent single words > rare single words
  const candidates = [
    ...phrases.map(p => ({ term: p, score: 3 })),
    ...Object.entries(freq)
      .filter(([_, count]) => count >= 1)
      .map(([word, count]) => ({ term: word, score: count >= 2 ? 2 : 1 })),
  ];

  // Dedupe and sort by score
  const seen = new Set();
  return candidates
    .sort((a, b) => b.score - a.score)
    .filter(c => { if (seen.has(c.term)) return false; seen.add(c.term); return true; })
    .slice(0, 6)
    .map(c => c.term);
}

function extractPhrases(text) {
  const clean = text.replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
  const words = clean.split(' ');
  const phrases = [];

  for (let i = 0; i < words.length - 1; i++) {
    const w1 = words[i], w2 = words[i + 1];
    if (w1.length >= 3 && w2.length >= 3 && !STOP_WORDS.has(w1) && !STOP_WORDS.has(w2)) {
      phrases.push(`${w1}-${w2}`);
    }
  }

  return phrases.slice(0, 4);
}

function inferGroup(el, section) {
  // Try to find a heading in the parent section context
  const text = (el.parentClass || '').toLowerCase().replace(/[^a-z0-9-]/g, ' ').trim();
  if (text && text.length > 2 && text.length < 40) return text.split(/\s+/)[0];
  return section.type;
}

function inferPrice(el) {
  const text = (el.text || '').toLowerCase();
  if (/luxury|premium|5.star|exclusive/i.test(text)) return 'luxury';
  if (/budget|affordable|cheap|deal|value/i.test(text)) return 'budget';
  if (/mid.range|moderate/i.test(text)) return 'mid-range';
  return null;
}

export function formatAsJS(reference) {
  return `const REFERENCE = ${JSON.stringify(reference, null, 2)};\n`;
}
