import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// Auto-reload when a NEW service worker takes over from an existing one.
// We track the previous controller so first-install activation (clients.claim)
// doesn't trigger a reload mid-game — only a genuine SW swap does.
if ('serviceWorker' in navigator) {
  let previousController = navigator.serviceWorker.controller;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (previousController) {
      window.location.reload();
    }
    previousController = navigator.serviceWorker.controller;
  });

  // Aggressively check for SW updates every 60s so users get new code fast
  navigator.serviceWorker.ready.then((registration) => {
    setInterval(() => {
      registration.update().catch(() => {});
    }, 60_000);
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
