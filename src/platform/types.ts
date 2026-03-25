/** Browser runtime identifier. */
export type BrowserName = 'chrome' | 'firefox' | 'safari' | 'unknown';

/** Capability snapshot for the currently-running browser. */
export interface PlatformCapabilities {
  /** Detected browser name. */
  readonly name: BrowserName;
  /** True for Chromium-based browsers (Chrome, Edge, Brave, Opera, …). */
  readonly isChromium: boolean;
  /** True when running inside Firefox. */
  readonly isFirefox: boolean;
  /** True when running inside Safari. */
  readonly isSafari: boolean;
}
