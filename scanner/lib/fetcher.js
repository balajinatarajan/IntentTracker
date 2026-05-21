import puppeteer from 'puppeteer';

let browser = null;

export async function launchBrowser() {
  if (browser) return browser;
  browser = await puppeteer.launch({
    headless: 'new',
    args: [
      '--no-sandbox',
      '--disable-dev-shm-usage',
      '--disable-setuid-sandbox',
      '--disable-blink-features=AutomationControlled',
    ],
  });
  browser.on('disconnected', () => { browser = null; });
  return browser;
}

export async function closeBrowser() {
  if (browser) { await browser.close(); browser = null; }
}

export async function fetchPage(url, { timeout = 30000, viewport = { width: 1280, height: 800 } } = {}) {
  const b = await launchBrowser();
  const page = await b.newPage();

  try {
    // Set realistic user agent to avoid bot detection
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125.0.0.0 Safari/537.36');
    await page.setViewport(viewport);
    await page.goto(url, { waitUntil: 'networkidle2', timeout });

    // Wait for late-rendering JS and scroll to trigger lazy content
    await new Promise(r => setTimeout(r, 2000));
    await page.evaluate(async () => {
      const distance = 400;
      const maxScrolls = 10;
      for (let i = 0; i < maxScrolls; i++) {
        window.scrollBy(0, distance);
        await new Promise(r => setTimeout(r, 300));
      }
      window.scrollTo(0, 0);
    });
    await new Promise(r => setTimeout(r, 1000));

    // Screenshot as base64 (viewport only to keep size manageable for LLM)
    const screenshotBuffer = await page.screenshot({ fullPage: false, type: 'png' });
    const screenshot = Buffer.from(screenshotBuffer).toString('base64');

    // Extract DOM data for all visible elements
    const elementData = await page.evaluate(() => {
      const results = [];
      const seen = new Set();

      function getDataAttrs(el) {
        const attrs = {};
        for (const attr of el.attributes) {
          if (attr.name.startsWith('data-')) attrs[attr.name] = attr.value;
        }
        return attrs;
      }

      function walk(el, depth = 0) {
        if (depth > 12 || seen.has(el)) return;
        seen.add(el);

        const rect = el.getBoundingClientRect();
        // Skip invisible/tiny elements
        if (rect.width < 20 || rect.height < 20) return;

        const style = window.getComputedStyle(el);
        const imgChild = el.querySelector('img');

        results.push({
          tagName: el.tagName.toLowerCase(),
          id: el.id || null,
          className: el.className && typeof el.className === 'string' ? el.className.trim() : null,
          text: (el.textContent || '').trim().slice(0, 200),
          innerText: (el.innerText || '').trim().slice(0, 150),
          rect: { x: Math.round(rect.x), y: Math.round(rect.y), w: Math.round(rect.width), h: Math.round(rect.height) },
          childCount: el.children.length,
          dataAttrs: getDataAttrs(el),
          hasImage: !!imgChild,
          imgSrc: imgChild ? imgChild.src : null,
          bgImage: style.backgroundImage !== 'none' ? style.backgroundImage : null,
          display: style.display,
          overflowX: style.overflowX,
          parentTag: el.parentElement?.tagName?.toLowerCase() || null,
          parentClass: el.parentElement?.className && typeof el.parentElement.className === 'string' ? el.parentElement.className.trim() : null,
          parentId: el.parentElement?.id || null,
          siblingCount: el.parentElement?.children?.length || 0,
          siblingIndex: el.parentElement ? Array.from(el.parentElement.children).indexOf(el) : 0,
          outerHTML: el.outerHTML.slice(0, 500),
        });

        for (const child of el.children) {
          walk(child, depth + 1);
        }
      }

      // Start from body's direct semantic children
      const roots = document.querySelectorAll('body > *, main, [role="main"], section, article, header, nav');
      roots.forEach(r => walk(r));

      return results;
    });

    // Get page title and meta
    const pageMeta = await page.evaluate(() => ({
      title: document.title,
      description: document.querySelector('meta[name="description"]')?.content || null,
      url: window.location.href,
    }));

    return { screenshot, elementData, pageMeta, page };
  } catch (err) {
    await page.close();
    throw err;
  }
}

export async function closePage(page) {
  if (page && !page.isClosed()) await page.close();
}
