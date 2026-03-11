const LUA_KEYWORDS = new Set([
  "and",
  "break",
  "do",
  "else",
  "elseif",
  "end",
  "false",
  "for",
  "function",
  "if",
  "in",
  "local",
  "nil",
  "not",
  "or",
  "repeat",
  "return",
  "then",
  "true",
  "until",
  "while",
]);

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
}

function highlightLua(source) {
  const tokenPattern = /(--\[\[[\s\S]*?\]\]|--[^\n]*|"(?:\\.|[^"\\])*"|'(?:\\.|[^'\\])*'|\[(?:=*)\[[\s\S]*?\](?:=*)\]|\b\d+(?:\.\d+)?(?:[eE][+-]?\d+)?\b|\b[_A-Za-z][_A-Za-z0-9]*\b|\.\.\.|==|~=|<=|>=|\.\.|[+\-*/%^#=<>.,:;(){}\[\]])/g;
  let out = "";
  let last = 0;
  let match = tokenPattern.exec(source);

  while (match) {
    const index = match.index;
    if (index > last) {
      out += escapeHtml(source.slice(last, index));
    }

    const token = match[0];
    let klass = "";
    if (token.startsWith("--")) {
      klass = "comment";
    } else if (token.startsWith('"') || token.startsWith("'") || token.startsWith("[")) {
      klass = "string";
    } else if (/^\d/.test(token)) {
      klass = "number";
    } else if (LUA_KEYWORDS.has(token)) {
      klass = "keyword";
    } else if (/^(?:\.\.\.|==|~=|<=|>=|\.\.|[+\-*/%^#=<>.,:;(){}\[\]])$/.test(token)) {
      klass = "operator";
    }

    if (klass) {
      out += `<span class="${klass}">${escapeHtml(token)}</span>`;
    } else {
      out += escapeHtml(token);
    }

    last = index + token.length;
    match = tokenPattern.exec(source);
  }

  if (last < source.length) {
    out += escapeHtml(source.slice(last));
  }

  return out;
}

function highlightPlain(source) {
  return escapeHtml(source);
}

function ensureTrailingNewline(text) {
  return text.endsWith("\n") ? text : `${text}\n`;
}

export class CodeEditor extends HTMLElement {
  static get observedAttributes() {
    return ["lang", "name", "placeholder", "spellcheck"];
  }

  constructor() {
    super();
    this._pre = null;
    this._textarea = null;
    this._value = "";
    this._onInput = this._onInput.bind(this);
    this._onScroll = this._onScroll.bind(this);
    this._onKeyDown = this._onKeyDown.bind(this);
  }

  connectedCallback() {
    if (this._textarea) return;

    const initialValue = this._value || this.textContent || "";
    this.textContent = "";

    const pre = document.createElement("pre");
    const textarea = document.createElement("textarea");

    pre.setAttribute("aria-hidden", "true");
    textarea.spellcheck = false;

    this.appendChild(pre);
    this.appendChild(textarea);

    this._pre = pre;
    this._textarea = textarea;
    this.style.cssText = `overflow:auto`
    this._textarea.style.cssText = `resize:none;`

    this._syncAttrs();
    this.value = initialValue;

    this._textarea.addEventListener("input", this._onInput);
    this._textarea.addEventListener("scroll", this._onScroll);
    this._textarea.addEventListener("keydown", this._onKeyDown);
  }

  disconnectedCallback() {
    if (!this._textarea) return;
    this._textarea.removeEventListener("input", this._onInput);
    this._textarea.removeEventListener("scroll", this._onScroll);
    this._textarea.removeEventListener("keydown", this._onKeyDown);
  }

  attributeChangedCallback() {
    if (!this._textarea) return;
    this._syncAttrs();
    this._renderHighlight();
  }

  get value() {
    return this._textarea ? this._textarea.value : this._value;
  }

  set value(next) {
    this._value = String(next ?? "");
    if (!this._textarea) return;
    this._textarea.value = this._value;
    this._renderHighlight();
  }

  focus(options) {
    this._textarea?.focus(options);
  }

  _syncAttrs() {
    if (!this._textarea) return;

    // const rows = Number(this.getAttribute("rows") || 12);
    // this._textarea.rows = Number.isFinite(rows) && rows > 0 ? rows : 12;

    const name = this.getAttribute("name");
    if (name) this._textarea.name = name;
    else this._textarea.removeAttribute("name");

    const placeholder = this.getAttribute("placeholder");
    if (placeholder !== null) this._textarea.placeholder = placeholder;
    else this._textarea.removeAttribute("placeholder");

    const spellcheck = this.getAttribute("spellcheck");
    if (spellcheck === null) {
      this._textarea.spellcheck = false;
    } else {
      this._textarea.spellcheck = spellcheck === "true";
    }
  }

  _onInput() {
    if (this._textarea) this._value = this._textarea.value;
    this._renderHighlight();
  }

  _onScroll() {
    if (!this._pre || !this._textarea) return;
    this._pre.scrollTop = this._textarea.scrollTop;
    this._pre.scrollLeft = this._textarea.scrollLeft;
  }

  _onKeyDown(event) {
    if (!this._textarea) return;
    if (event.key !== "Tab") return;

    event.preventDefault();

    const start = this._textarea.selectionStart;
    const end = this._textarea.selectionEnd;
    const value = this._textarea.value;
    const nextValue = `${value.slice(0, start)}  ${value.slice(end)}`;

    this._textarea.value = nextValue;
    this._textarea.selectionStart = start + 2;
    this._textarea.selectionEnd = start + 2;
    this._renderHighlight();
  }

  _renderHighlight() {
    if (!this._pre || !this._textarea) return;
    autoResize(this._textarea)

    const source = this._textarea.value;
    const lang = String(this.getAttribute("lang") || "").toLowerCase();
    const html = lang === "lua" ? highlightLua(source) : highlightPlain(source);
    this._pre.innerHTML = ensureTrailingNewline(html);
  }
}

if (!customElements.get("code-editor")) {
  customElements.define("code-editor", CodeEditor);
}


function autoResize(el) {
  el.style.height = "auto";
  el.style.height = el.scrollHeight + "px";
}
