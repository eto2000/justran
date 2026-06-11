import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { registerSW } from 'virtual:pwa-register'
import './index.css'
import App from './App.jsx'

// Register service worker with immediate auto-update reload
registerSW({
  immediate: true,
  onRegisteredSW(swUrl, r) {
    if (r) {
      // Check for updates on window focus
      window.addEventListener('focus', () => {
        r.update();
      });

      // Also check for updates every hour
      setInterval(() => {
        r.update();
      }, 3600000);
    }
  }
});

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
