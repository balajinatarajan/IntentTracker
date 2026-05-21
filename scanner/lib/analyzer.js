// Heuristic content section detection
// Identifies card grids, heroes, carousels, lists from raw DOM element data

const PRICE_PATTERN = /(\$|€|£|¥)\s*[\d,.]+|[\d,.]+\s*(\/\s*(night|mo|month|week|day|person|pp))/i;

// Elements that are never content items
const EXCLUDED_TAGS = new Set(['nav', 'footer', 'header', 'script', 'style', 'meta', 'link', 'noscript', 'svg', 'iframe', 'button', 'input', 'select', 'label', 'form']);
const EXCLUDED_CLASS_PATTERNS = /\b(nav|menu|footer|header|sidebar|toolbar|modal|overlay|popup|tooltip|debug|cookie|banner-cookie|consent|breadcrumb|pagination|tab-bar|tabs)\b/i;

// Atomic elements that are too small to be cards/banners
// A "card" is a composite block — typically 200px+ wide and 150px+ tall
const MIN_CARD_WIDTH = 200;
const MIN_CARD_HEIGHT = 150;
const MIN_CARD_TEXT_LENGTH = 20;

function isContentElement(el, viewport) {
  // Exclude by tag
  if (EXCLUDED_TAGS.has(el.tagName)) return false;

  // Exclude bare links and inline elements — cards are block-level
  if (el.tagName === 'a' && el.childCount < 2) return false;
  if (el.tagName === 'span' || el.tagName === 'p' || el.tagName === 'label') return false;

  // Exclude elements smaller than card size
  if (el.rect.w < MIN_CARD_WIDTH || el.rect.h < MIN_CARD_HEIGHT) return false;

  // Exclude full-width wrapper divs (likely layout containers, not cards)
  // A card should be narrower than the viewport — unless it's a hero/banner
  const vw = viewport?.width || 1280;
  const isFullWidth = el.rect.w > vw * 0.9;
  const isTall = el.rect.h > 600;
  if (isFullWidth && isTall) return false; // Page-level wrapper, not a card

  // Exclude nav/footer by class pattern
  if (el.className && EXCLUDED_CLASS_PATTERNS.test(el.className)) return false;
  if (el.parentClass && EXCLUDED_CLASS_PATTERNS.test(el.parentClass)) return false;

  // Must have meaningful content — text + image combo is strongest signal
  const textLen = (el.innerText || el.text || '').trim().length;
  const hasVisual = el.hasImage || el.bgImage;

  // Card heuristic: needs either (image + some text) or (substantial text alone)
  if (hasVisual && textLen >= 10) return true;
  if (textLen >= MIN_CARD_TEXT_LENGTH) return true;

  return false;
}

export function analyze(elementData, viewport = { width: 1280, height: 800 }) {
  const sections = [];

  // Pre-filter: only content-bearing elements (cards, banners — not atoms like links/buttons)
  const contentElements = elementData.filter(el => isContentElement(el, viewport));

  // --- 1. Find repeated sibling groups (card grids / lists) ---
  const parentGroups = groupByParent(contentElements);
  for (const [parentKey, children] of parentGroups) {
    if (children.length < 3) continue;

    // Check if children share a tag+class pattern
    const patterns = children.map(c => `${c.tagName}.${c.className?.split(' ')[0] || ''}`);
    const dominant = mode(patterns);
    const matching = children.filter((c, i) => patterns[i] === dominant);

    if (matching.length < 3) continue;

    // Extra filter: at least half the items should have images or substantial text
    const rich = matching.filter(el => el.hasImage || el.bgImage || (el.innerText || '').length > 40);
    if (rich.length < matching.length * 0.5) continue;

    sections.push({
      type: 'card-grid',
      parentKey,
      parentSelector: buildParentSelector(children[0]),
      items: matching.map(el => ({
        ...el,
        hasPrice: PRICE_PATTERN.test(el.text),
      })),
    });
  }

  // --- 2. Hero/banner detection ---
  const heroCandidate = contentElements.find(el =>
    el.rect.y < viewport.height * 0.6 &&
    el.rect.w > viewport.width * 0.5 &&
    el.rect.h > 200 &&
    (el.hasImage || el.bgImage)
  );
  if (heroCandidate) {
    sections.push({
      type: 'hero',
      parentSelector: null,
      items: [{ ...heroCandidate, hasPrice: PRICE_PATTERN.test(heroCandidate.text) }],
    });
  }

  // --- 3. Carousel detection ---
  const carousels = contentElements.filter(el =>
    (el.overflowX === 'auto' || el.overflowX === 'scroll') &&
    el.childCount >= 3 &&
    el.rect.w > 300
  );
  for (const carousel of carousels) {
    const children = contentElements.filter(el =>
      (el.parentId && el.parentId === carousel.id) ||
      (el.parentClass === carousel.className && el.parentTag === carousel.tagName)
    );
    if (children.length >= 3) {
      sections.push({
        type: 'carousel',
        parentSelector: buildSelectorForElement(carousel),
        items: children.map(el => ({ ...el, hasPrice: PRICE_PATTERN.test(el.text) })),
      });
    }
  }

  // --- 4. Standalone image cards not already in a section ---
  const sectionItemKeys = new Set(sections.flatMap(s =>
    s.items.map(i => `${i.rect.x},${i.rect.y},${i.rect.w},${i.rect.h}`)
  ));
  const standaloneCards = contentElements.filter(el =>
    (el.hasImage || el.bgImage) &&
    (el.innerText || '').trim().length > 30 &&
    el.rect.h > 150 &&
    el.rect.w > 200 &&
    !sectionItemKeys.has(`${el.rect.x},${el.rect.y},${el.rect.w},${el.rect.h}`)
  );
  if (standaloneCards.length > 0) {
    sections.push({
      type: 'standalone',
      parentSelector: null,
      items: standaloneCards.slice(0, 10).map(el => ({
        ...el,
        hasPrice: PRICE_PATTERN.test(el.text),
      })),
    });
  }

  // Deduplicate items across sections
  return deduplicateSections(sections);
}

function groupByParent(elements) {
  const groups = new Map();
  for (const el of elements) {
    const key = `${el.parentTag || ''}#${el.parentId || ''}.${el.parentClass || ''}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(el);
  }
  return groups;
}

function mode(arr) {
  const counts = {};
  for (const v of arr) counts[v] = (counts[v] || 0) + 1;
  return Object.entries(counts).sort((a, b) => b[1] - a[1])[0]?.[0];
}

function buildParentSelector(child) {
  const parts = [];
  if (child.parentId) return `#${child.parentId}`;
  if (child.parentTag) parts.push(child.parentTag);
  if (child.parentClass) {
    const cls = child.parentClass.split(/\s+/)[0];
    if (cls) parts.push(`.${cls}`);
  }
  return parts.join('') || null;
}

function buildSelectorForElement(el) {
  if (el.id) return `#${el.id}`;
  const parts = [el.tagName];
  if (el.className) {
    const cls = el.className.split(/\s+/)[0];
    if (cls) parts.push(`.${cls}`);
  }
  return parts.join('') || el.tagName;
}

function deduplicateSections(sections) {
  const seen = new Set();
  return sections.map(section => ({
    ...section,
    items: section.items.filter(item => {
      const key = `${item.tagName}|${item.id}|${item.className}|${item.rect.x},${item.rect.y}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  })).filter(s => s.items.length > 0);
}
