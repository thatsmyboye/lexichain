import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { applyFontSize, getFontSize } from './lib/appearance'
import { startAppUpdates } from './lib/appUpdates'
import { startNativeIntegration } from './lib/nativeApp'

// Restore the user's saved font-size preference before first paint.
applyFontSize(getFontSize());

// Marks the page as scrolled so the strip behind the status bar can appear
// (body::before in index.css). Only matters when the page runs edge to edge.
const markScrolled = () => document.documentElement.toggleAttribute("data-scrolled", window.scrollY > 2);
window.addEventListener("scroll", markScrolled, { passive: true });
markScrolled();

createRoot(document.getElementById("root")!).render(<App />);

startAppUpdates();
// Only active inside the iOS/Android app (mobile/); a no-op in browsers.
startNativeIntegration();
