export declare class CodexSessionViewer extends HTMLElement {
  private _session;
  static get observedAttributes(): string[];
  get src(): string | null;
  set src(value: string | null);
  get theme(): string | null;
  set theme(value: string | null);
  get session(): unknown;
  set session(value: unknown);
  connectedCallback(): void;
  load(fileOrUrl: File | string): Promise<void>;
  export(options?: unknown): Promise<void>;
}
export default CodexSessionViewer;
