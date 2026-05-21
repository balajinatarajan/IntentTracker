// Legacy catalog — reads item metadata from a reference file instead of data-ik-* attributes
// Drop-in replacement for lib/src/catalog.js with identical API shape

export function createLegacyCatalog(referenceMap = {}) {
  const items = new Map(); // id -> { id, tags, group, name, element }
  const selectorToMeta = new Map(); // CSS selector -> raw metadata
  const selectorToId = new Map(); // CSS selector -> item id
  let compoundSelector = ''; // all selectors joined with commas

  // Pre-process reference map
  const refItems = referenceMap.items || {};
  for (const [selector, meta] of Object.entries(refItems)) {
    selectorToMeta.set(selector, meta);
    selectorToId.set(selector, meta.id);
  }
  compoundSelector = Object.keys(refItems).join(', ');

  function getSelector() {
    return compoundSelector;
  }

  function parseMeta(meta, el) {
    const id = meta.id;
    if (!id) return null;

    const rawTags = meta.tags || '';
    const tags = rawTags.split(',').map(t => t.trim()).filter(Boolean);

    if (meta.price) {
      tags.push('price:' + meta.price.trim());
    }

    const group = meta.group || null;
    const name = meta.name || id;

    return { id, tags, group, name, element: el };
  }

  function scanItems(root) {
    for (const [selector, meta] of selectorToMeta) {
      const el = root.querySelector(selector);
      if (!el) continue; // not in DOM yet; MutationObserver will catch it
      const item = parseMeta(meta, el);
      if (item) items.set(item.id, item);
    }
    return items;
  }

  function scanNewElements(elements) {
    const added = [];
    elements.forEach(el => {
      // Check the element itself and its descendants against all reference selectors
      if (el.matches && compoundSelector) {
        _checkElement(el, added);
      }
      if (el.querySelectorAll && compoundSelector) {
        try {
          el.querySelectorAll(compoundSelector).forEach(child => {
            _checkElement(child, added);
          });
        } catch (e) {
          // Invalid compound selector — fall back to per-selector check
          for (const selector of selectorToMeta.keys()) {
            try {
              el.querySelectorAll(selector).forEach(child => {
                _checkElement(child, added);
              });
            } catch (_) {}
          }
        }
      }
    });
    return added;
  }

  function _checkElement(el, added) {
    // Reverse lookup: which reference selector does this element match?
    for (const [selector, meta] of selectorToMeta) {
      try {
        if (!el.matches(selector)) continue;
      } catch (_) {
        continue;
      }

      const itemId = meta.id;
      const existing = items.get(itemId);

      if (!existing) {
        // Brand new item
        const item = parseMeta(meta, el);
        if (item) {
          items.set(item.id, item);
          added.push(item);
        }
      } else if (existing.element !== el) {
        // Same item ID but new DOM element (e.g. re-rendered)
        existing.element = el;
        added.push({ ...existing, element: el });
      }
      break; // One selector match per element is enough
    }
  }

  function getItem(id) {
    return items.get(id) || null;
  }

  function getAllItems() {
    return Array.from(items.values());
  }

  return { scanItems, scanNewElements, getItem, getAllItems, getSelector };
}
