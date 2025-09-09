export class CodexSessionViewer extends HTMLElement {
  constructor() {
    super();
    this._session = null;
  }
  static get observedAttributes() {
    return ['src', 'theme'];
  }
  get src() {
    return this.getAttribute('src');
  }
  set src(value) {
    if (value === null) {
      this.removeAttribute('src');
    } else {
      this.setAttribute('src', value);
    }
  }
  get theme() {
    return this.getAttribute('theme');
  }
  set theme(value) {
    if (value === null) {
      this.removeAttribute('theme');
    } else {
      this.setAttribute('theme', value);
    }
  }
  get session() {
    return this._session;
  }
  set session(value) {
    this._session = value;
  }
  connectedCallback() {
    if (!this.shadowRoot) {
      const shadow = this.attachShadow({ mode: 'open' });
      const container = document.createElement('div');
      container.textContent = 'codex-session-viewer';
      shadow.appendChild(container);
    }
  }
  async load(_fileOrUrl) {
    this.dispatchEvent(new CustomEvent('session-load'));
  }
  async export(_options) {
    this.dispatchEvent(new CustomEvent('export-start'));
    this.dispatchEvent(new CustomEvent('export-done'));
  }
}
if (!customElements.get('codex-session-viewer')) {
  customElements.define('codex-session-viewer', CodexSessionViewer);
}
export default CodexSessionViewer;
