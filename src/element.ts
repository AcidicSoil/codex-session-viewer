export class CodexSessionViewer extends HTMLElement {
  private _session: unknown = null;

  static get observedAttributes() {
    return ['src', 'theme'];
  }

  get src(): string | null {
    return this.getAttribute('src');
  }

  set src(value: string | null) {
    if (value === null) {
      this.removeAttribute('src');
    } else {
      this.setAttribute('src', value);
    }
  }

  get theme(): string | null {
    return this.getAttribute('theme');
  }

  set theme(value: string | null) {
    if (value === null) {
      this.removeAttribute('theme');
    } else {
      this.setAttribute('theme', value);
    }
  }

  get session(): unknown {
    return this._session;
  }

  set session(value: unknown) {
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

  async load(_fileOrUrl: File | string) {
    this.dispatchEvent(new CustomEvent('session-load'));
  }

  async export(_options?: unknown) {
    this.dispatchEvent(new CustomEvent('export-start'));
    this.dispatchEvent(new CustomEvent('export-done'));
  }
}

if (!customElements.get('codex-session-viewer')) {
  customElements.define('codex-session-viewer', CodexSessionViewer);
}

export default CodexSessionViewer;
