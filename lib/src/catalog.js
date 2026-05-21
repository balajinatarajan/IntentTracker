// DOM scanner with attribute mapping
// Discovers items from data-ik-* attributes (or custom mapped attributes)

const DEFAULT_ATTRS = {
  id: 'data-ik-id',
  tags: 'data-ik-tags',
  group: 'data-ik-group',
  name: 'data-ik-name',
  price: 'data-ik-price',
};

export function createCatalog(attrMap = {}) {
  const attrs = { ...DEFAULT_ATTRS, ...attrMap };
  const items = new Map(); // id -> { id, tags, group, name, element }

  function getSelector() {
    return `[${attrs.id}]`;
  }

  function readAttr(el, field) {
    // If custom mapping provided, try mapped attr first, then fall back to data-ik-*
    if (attrMap[field] && attrMap[field] !== DEFAULT_ATTRS[field]) {
      const val = el.getAttribute(attrMap[field]);
      if (val != null) return val;
    }
    return el.getAttribute(DEFAULT_ATTRS[field]);
  }

  function parseElement(el) {
    const id = readAttr(el, 'id');
    if (!id) return null;

    const rawTags = readAttr(el, 'tags') || '';
    const tags = rawTags.split(',').map(t => t.trim()).filter(Boolean);

    const price = readAttr(el, 'price');
    if (price) {
      tags.push('price:' + price.trim());
    }

    const group = readAttr(el, 'group') || null;
    const name = readAttr(el, 'name') || id;

    return { id, tags, group, name, element: el };
  }

  function scanItems(root) {
    const els = root.querySelectorAll(getSelector());
    els.forEach(el => {
      const item = parseElement(el);
      if (item) items.set(item.id, item);
    });
    return items;
  }

  function scanNewElements(elements) {
    const added = [];
    elements.forEach(el => {
      // Check the element itself
      if (el.matches && el.matches(getSelector())) {
        _processElement(el, added);
      }
      // Check descendants
      if (el.querySelectorAll) {
        el.querySelectorAll(getSelector()).forEach(child => {
          _processElement(child, added);
        });
      }
    });
    return added;
  }

  function _processElement(el, added) {
    const item = parseElement(el);
    if (!item) return;
    const existing = items.get(item.id);
    if (!existing) {
      // Brand new item
      items.set(item.id, item);
      added.push(item);
    } else if (existing.element !== el) {
      // Same item ID but new DOM element (e.g. tab switch re-rendered the card)
      existing.element = el;
      item.element = el;
      added.push(item);
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
