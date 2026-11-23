import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { applyFontSize, getFontSize } from './lib/appearance'
import { startAppUpdates } from './lib/appUpdates'
import { startNativeIntegration } from './lib/nativeApp'

// Restore the user's saved font-size preference before first paint.
applyFontSize(getFontSize());

createRoot(document.getElementById("root")!).render(<App />);

startAppUpdates();
// Only active inside the iOS/Android app (mobile/); a no-op in browsers.
startNativeIntegration();
