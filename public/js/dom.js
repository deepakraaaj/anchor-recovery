/**
 * Tiny DOM builder. All text goes through textContent, so model output can
 * never be interpreted as HTML (XSS-safe by construction).
 *
 * @param {string} tag
 * @param {Record<string, any>} [props]  `text`, `class`, `on{Event}` or attributes
 * @param {(Node|string|null|false|undefined)[]} [children]
 */
export function el(tag, props = {}, children = []) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(props)) {
    if (value === undefined || value === null || value === false) continue;
    if (key === 'text') node.textContent = value;
    else if (key === 'class') node.className = value;
    else if (key.startsWith('on')) node.addEventListener(key.slice(2).toLowerCase(), value);
    else node.setAttribute(key, value === true ? '' : value);
  }
  for (const child of children) {
    if (child === null || child === undefined || child === false) continue;
    node.append(child);
  }
  return node;
}

export const $ = (selector) => document.querySelector(selector);

export const list = (tag, items) => el(tag, {}, items.map((item) => el('li', { text: item })));
