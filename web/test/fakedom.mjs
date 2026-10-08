// A very small DOM for the tests of the bar and the compare master: just the
// parts of the DOM API they use. Not a general implementation: selectors are
// `.class`, `tag`, `#id` and `tag[attr="value"]`.

class Node extends EventTarget {
  constructor(tag, doc) {
    super();
    this.tagName = tag.toUpperCase();
    this.ownerDocument = doc;
    this.children = [];
    this.parentElement = null;
    this.attrs = new Map();
    this.style = { setProperty(k, v) { this[k] = v; } };
    this._text = "";
    this.innerHTMLValue = "";
    this.value = "";
    this.disabled = false;
    this.hidden = false;
    this.title = "";
    this.id = "";
    this.className = "";
  }

  get textContent() {
    return this.children.length ? this.children.map((c) => c.textContent).join("") : this._text;
  }

  set textContent(v) {
    this.children = [];
    this._text = String(v);
  }

  get innerHTML() {
    return this.innerHTMLValue;
  }

  // Parse just enough of the bar's markup for `querySelector` to find its parts.
  set innerHTML(html) {
    this.innerHTMLValue = html;
    this.children = [];
    const stack = [this];
    const re = /<(\/?)(\w+)([^>]*?)(\/?)>/g;
    let m;
    while ((m = re.exec(html))) {
      const [, close, tag, attrs, self] = m;
      if (["svg", "polygon", "rect", "line", "path", "circle"].includes(tag)) continue;
      if (close) {
        if (stack.length > 1) stack.pop();
        continue;
      }
      const el = this.ownerDocument.createElement(tag);
      for (const a of attrs.matchAll(/([\w-]+)(?:="([^"]*)")?/g)) {
        el.setAttribute(a[1], a[2] ?? "");
        if (a[1] === "class") el.className = a[2];
        if (a[1] === "value") el.value = a[2];
      }
      if (el.hasAttribute("disabled")) el.disabled = true;
      if (el.hasAttribute("hidden")) el.hidden = true;
      stack[stack.length - 1].appendChild(el);
      if (!self && !["input"].includes(tag)) stack.push(el);
    }
  }

  get classList() {
    const cls = () => this.className.split(/\s+/).filter(Boolean);
    return { contains: (c) => cls().includes(c) };
  }

  setAttribute(k, v) {
    this.attrs.set(k, String(v));
    if (k === "class") this.className = String(v);
    if (k === "id") this.id = String(v);
  }

  getAttribute(k) {
    return this.attrs.has(k) ? this.attrs.get(k) : null;
  }

  hasAttribute(k) {
    return this.attrs.has(k);
  }

  removeAttribute(k) {
    this.attrs.delete(k);
    if (k === "hidden") this.hidden = false;
  }

  appendChild(c) {
    if (c.parentElement) c.parentElement.children = c.parentElement.children.filter((x) => x !== c);
    c.parentElement = this;
    this.children.push(c);
    return c;
  }

  replaceChildren(...cs) {
    this.children = [];
    for (const c of cs) this.appendChild(c);
  }

  remove() {
    if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((x) => x !== this);
  }

  closest(sel) {
    for (let n = this; n; n = n.parentElement) if (matches(n, sel)) return n;
    return null;
  }

  querySelectorAll(sel) {
    const out = [];
    const walk = (n) => {
      for (const c of n.children) {
        if (matches(c, sel)) out.push(c);
        walk(c);
      }
    };
    walk(this);
    return out;
  }

  querySelector(sel) {
    return this.querySelectorAll(sel)[0] ?? null;
  }

  /** Every node under this one, this included. */
  all() {
    return [this, ...this.querySelectorAll("*")];
  }
}

function matches(n, sel) {
  if (sel === "*") return true;
  let m;
  if ((m = /^\.([\w-]+)$/.exec(sel))) return n.className.split(/\s+/).includes(m[1]);
  if ((m = /^#([\w-]+)$/.exec(sel))) return n.id === m[1];
  if ((m = /^(\w[\w-]*)\[(\w+)="([^"]*)"\]$/.exec(sel))) return n.tagName === m[1].toUpperCase() && n.getAttribute(m[2]) === m[3];
  return n.tagName === sel.toUpperCase();
}

export function makeDocument() {
  const doc = new EventTarget();
  doc.createElement = (tag) => new Node(tag, doc);
  doc.documentElement = doc.createElement("html");
  doc.head = doc.createElement("head");
  doc.body = doc.createElement("body");
  doc.documentElement.appendChild(doc.head);
  doc.documentElement.appendChild(doc.body);
  doc.getElementById = (id) => doc.documentElement.all().find((n) => n.id === id) ?? null;
  doc.querySelectorAll = (sel) => doc.documentElement.querySelectorAll(sel);
  return doc;
}
