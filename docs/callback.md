---
title: Authentication — Skeeditor
---

<script setup>
import { onMounted, ref } from 'vue'

const status = ref('loading')
const errorDescription = ref('')

onMounted(() => {
  const params = new URLSearchParams(window.location.search)
  const code = params.get('code')
  const state = params.get('state')
  const err = params.get('error')
  const errDesc = params.get('error_description')

  if (err) {
    status.value = 'error'
    errorDescription.value = errDesc ? decodeURIComponent(errDesc) : err
    return
  }

  if (code && state) {
    // Fallback: send to extension if this tab was opened via window.open().
    // In the normal flow, the background service worker intercepts via tabs.onUpdated
    // and closes the tab automatically.
    if (window.opener) {
      window.opener.postMessage({ type: 'AUTH_CALLBACK', code, state }, '*')
      window.close()
    }
    status.value = 'success'
  } else {
    status.value = 'error'
    errorDescription.value = 'Missing authorization code or state parameter.'
  }
})
</script>

<div class="callback-page">
  <div v-if="status === 'loading'" class="callback-state">
    <div class="callback-icon loading-icon">⏳</div>
    <h1>Completing sign-in…</h1>
    <p>Please wait while we finish authenticating you.</p>
  </div>

  <div v-else-if="status === 'success'" class="callback-state">
    <div class="callback-icon success-icon">✓</div>
    <h1>Authentication complete</h1>
    <p>You're signed in. This tab will close automatically — you can return to bsky.app.</p>
  </div>

  <div v-else class="callback-state error-state">
    <div class="callback-icon error-icon">✕</div>
    <h1>Authentication failed</h1>
    <p class="error-description">{{ errorDescription }}</p>
    <p>Please close this tab and try signing in again from the extension.</p>
  </div>
</div>

<style scoped>
.callback-page {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 100%;
  min-height: calc(100vh - var(--vp-nav-height, 64px) - 4rem);
  padding: 2rem;
}

.callback-state {
  text-align: center;
  max-width: 400px;
}

.callback-icon {
  font-size: 3rem;
  margin-bottom: 1rem;
  line-height: 1;
}

.success-icon {
  color: var(--vp-c-green-1);
  font-family: monospace;
  font-weight: 700;
}

.error-icon {
  color: var(--vp-c-red-1);
  font-family: monospace;
  font-weight: 700;
}

h1 {
  font-size: 1.75rem;
  font-weight: 700;
  margin-bottom: 0.75rem;
  border: none;
  padding: 0;
}

p {
  color: var(--vp-c-text-2);
  line-height: 1.6;
  margin: 0.5rem 0;
}

.error-description {
  font-family: var(--vp-font-family-mono);
  font-size: 0.875rem;
  color: var(--vp-c-red-1);
  background: var(--vp-c-red-soft);
  border-radius: 6px;
  padding: 0.5rem 0.75rem;
  margin: 0.75rem 0;
}
</style>
