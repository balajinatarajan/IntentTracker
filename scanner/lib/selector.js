// CSS selector generation — runs inside Puppeteer's page.evaluate()
// Returns a unique, stable selector for each candidate element

export async function generateSelectors(page, sections) {
  const results = await page.evaluate((sectionsJSON) => {
    const sections = JSON.parse(sectionsJSON);
    const output = [];

    for (const section of sections) {
      const sectionItems = [];

      for (const item of section.items) {
        // Find the element by bounding rect match
        const el = findElementByRect(item.rect, item.tagName);
        if (!el) { sectionItems.push({ ...item, selector: null, selectorScore: 0 }); continue; }

        const selector = buildBestSelector(el);
        sectionItems.push({ ...item, selector: selector.css, selectorScore: selector.score });
      }

      output.push({ ...section, items: sectionItems });
    }

    return output;

    // --- Helper functions (run in page context) ---

    function findElementByRect(rect, tagName) {
      const candidates = document.querySelectorAll(tagName || '*');
      let best = null, bestDist = Infinity;
      for (const el of candidates) {
        const r = el.getBoundingClientRect();
        const dist = Math.abs(r.x - rect.x) + Math.abs(r.y - rect.y) +
                     Math.abs(r.width - rect.w) + Math.abs(r.height - rect.h);
        if (dist < bestDist) { bestDist = dist; best = el; }
      }
      return bestDist < 10 ? best : null;
    }

    function buildBestSelector(el) {
      // Priority 1: ID
      if (el.id && document.querySelectorAll(`#${CSS.escape(el.id)}`).length === 1) {
        return { css: `#${el.id}`, score: 100 };
      }

      // Priority 2: Unique data attribute
      for (const attr of el.attributes) {
        if (attr.name.startsWith('data-') && attr.value) {
          const sel = `${el.tagName.toLowerCase()}[${attr.name}="${CSS.escape(attr.value)}"]`;
          try {
            if (document.querySelectorAll(sel).length === 1) {
              return { css: sel, score: 80 };
            }
          } catch(e) { /* invalid selector, skip */ }
        }
      }

      // Priority 3: Class-based with parent context
      if (el.className && typeof el.className === 'string') {
        const classes = el.className.trim().split(/\s+/).slice(0, 2);
        if (classes.length > 0) {
          // Try with parent
          const parent = el.parentElement;
          if (parent) {
            const parentSel = parent.id
              ? `#${parent.id}`
              : parent.className && typeof parent.className === 'string'
                ? `${parent.tagName.toLowerCase()}.${parent.className.trim().split(/\s+/)[0]}`
                : parent.tagName.toLowerCase();

            const childSel = `${el.tagName.toLowerCase()}.${classes.join('.')}`;
            const combined = `${parentSel} > ${childSel}`;
            try {
              if (document.querySelectorAll(combined).length === 1) {
                return { css: combined, score: 60 };
              }
            } catch(e) {}

            // Priority 4: nth-child
            const idx = Array.from(parent.children).indexOf(el) + 1;
            const nthSel = `${parentSel} > ${el.tagName.toLowerCase()}:nth-child(${idx})`;
            try {
              if (document.querySelectorAll(nthSel).length === 1) {
                return { css: nthSel, score: 40 };
              }
            } catch(e) {}
          }

          // Try standalone class selector
          const classSel = `${el.tagName.toLowerCase()}.${classes.join('.')}`;
          try {
            if (document.querySelectorAll(classSel).length === 1) {
              return { css: classSel, score: 55 };
            }
          } catch(e) {}
        }
      }

      // Fallback: full path with nth-child
      const path = [];
      let current = el;
      for (let i = 0; i < 4 && current && current !== document.body; i++) {
        const parent = current.parentElement;
        if (!parent) break;
        const idx = Array.from(parent.children).indexOf(current) + 1;
        const tag = current.tagName.toLowerCase();
        const cls = current.className && typeof current.className === 'string'
          ? `.${current.className.trim().split(/\s+/)[0]}`
          : '';
        path.unshift(`${tag}${cls}:nth-child(${idx})`);
        current = parent;
      }
      const fallback = path.join(' > ');
      return { css: fallback, score: 20 };
    }
  }, JSON.stringify(sections));

  return results;
}
