// Ambient global declaration for the webextension-polyfill browser API.
// At runtime this global is populated by importing 'webextension-polyfill' at
// each entry point (service-worker, content-script, popup, options).
// This file provides the compile-time type for every source file in the project.
declare var browser: typeof import('webextension-polyfill');
