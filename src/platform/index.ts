/**
 * Platform detection and capability exports.
 *
 * Usage (lazy, cached):
 * ```ts
 * import { platform } from '@src/platform';
 * if (platform.isFirefox) { … }
 * ```
 *
 * Or re-detect on demand:
 * ```ts
 * import { detectPlatform } from '@src/platform';
 * const caps = detectPlatform();
 * ```
 */
export { detectPlatform } from './detect';
export type { BrowserName, PlatformCapabilities } from './types';

import { detectPlatform } from './detect';

/** Lazily-evaluated platform capabilities for the current browser. */
export const platform = detectPlatform();
