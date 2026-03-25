// Ambient global declaration for the webextension-polyfill browser API.
// At runtime this global is populated by importing 'webextension-polyfill' at
// each entry point (service-worker, content-script, popup, options).
// This file provides the compile-time type for every source file in the project.
declare var browser: typeof import('webextension-polyfill');

// Allow side-effect CSS imports (e.g. `import './styles.css'`) in content scripts.
// Vite handles these at build time; TypeScript only needs to know the module exists.
declare module '*.css' {}
