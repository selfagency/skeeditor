/**
 * Shared debug logger.
 *
 * Output is completely suppressed unless debug mode is enabled via one of:
 *   - `globalThis.__SKEEDITOR_DEBUG__ = true` (works in all contexts, including MV3 service workers)
 *   - `localStorage.setItem('skeeditor:debug', '1')`
 *   - URL query param  `?skeeditor_debug=1`
 *   - `<html data-skeeditor-debug="1">`
 *
 * The `globalThis.__SKEEDITOR_DEBUG__` flag is the only mechanism available
 * inside a MV3 service worker, where `document`, `localStorage`, and
 * meaningful `location.search` values are unavailable. Set it from the
 * service-worker devtools console before triggering the code path you want
 * to observe.
 *
 * When enabled, log entries are batched for DEBOUNCE_MS milliseconds so that
 * rapid bursts (e.g. MutationObserver-triggered scans) appear as a single
 * collapsed group rather than flooding the console.
 *
 * Usage:
 *   const log = createLogger('my-module');
 *   log.debug('event-name', { key: 'value' });
 */

const DEBUG_LOCAL_STORAGE_KEY = 'skeeditor:debug';
const DEBUG_QUERY_PARAM = 'skeeditor_debug';
const DEBUG_DATA_ATTRIBUTE = 'data-skeeditor-debug';
const DEBOUNCE_MS = 150;

function checkDebugEnabled(): boolean {
  // Global flag — works in all contexts including MV3 service workers.
  // Set via: globalThis.__SKEEDITOR_DEBUG__ = true
  if ((globalThis as Record<string, unknown>)['__SKEEDITOR_DEBUG__'] === true) return true;
  try {
    if (typeof document !== 'undefined' && document.documentElement?.getAttribute(DEBUG_DATA_ATTRIBUTE) === '1')
      return true;
  } catch {
    // noop — may be unavailable in some worker contexts
  }
  try {
    if (globalThis.localStorage?.getItem(DEBUG_LOCAL_STORAGE_KEY) === '1') return true;
  } catch {
    // localStorage may be unavailable in some privacy modes
  }
  const value = new URLSearchParams(globalThis.location?.search ?? '').get(DEBUG_QUERY_PARAM);
  return value === '1' || value === 'true';
}

export const DEBUG_ENABLED: boolean = checkDebugEnabled();

// ── Debounced transport (only active when debug is enabled) ───────────────────

type QueueEntry = [event: string, data?: Record<string, unknown>];

const _queue: QueueEntry[] = [];
let _flushTimer: ReturnType<typeof setTimeout> | null = null;

function flush(): void {
  if (_queue.length === 0) return;
  if (_queue.length === 1) {
    const [event, data] = _queue[0]!;
    if (data !== undefined) console.debug(event, data);
    else console.debug(event);
  } else {
    console.groupCollapsed(`[skeeditor:debug] ${_queue.length} events`);
    for (const [event, data] of _queue) {
      if (data !== undefined) console.debug(event, data);
      else console.debug(event);
    }
    console.groupEnd();
  }
  _queue.length = 0;
  _flushTimer = null;
}

function enqueue(event: string, data?: Record<string, unknown>): void {
  _queue.push(data !== undefined ? [event, data] : [event]);
  if (_flushTimer !== null) clearTimeout(_flushTimer);
  _flushTimer = setTimeout(flush, DEBOUNCE_MS);
}

// ── Public API ────────────────────────────────────────────────────────────────

export interface SkeeLogger {
  debug(event: string, data?: Record<string, unknown>): void;
  error(event: string, data?: Record<string, unknown>): void;
}

/** No-op logger used when debug mode is off. */
const _noop: SkeeLogger = { debug() {}, error() {} };

/**
 * Returns a namespaced debug logger.  All output is a no-op unless debug mode
 * is enabled (see module-level comment).
 *
 * @param namespace  Short identifier for the subsystem, e.g. `'content'`, `'cache'`.
 */
export function createLogger(namespace: string): SkeeLogger {
  if (!DEBUG_ENABLED) return _noop;
  return {
    debug(event: string, data?: Record<string, unknown>): void {
      enqueue(`skeeditor:debug:${namespace}:${event}`, data);
    },
    error(event: string, data?: Record<string, unknown>): void {
      enqueue(`skeeditor:error:${namespace}:${event}`, data);
    },
  };
}
