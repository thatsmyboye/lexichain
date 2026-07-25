import { createRoot } from 'react-dom/client'
import App from './App.tsx'
import './index.css'
import { applyFontSize, getFontSize } from './lib/appearance'

// Restore the user's saved font-size preference before first paint.
applyFontSize(getFontSize());

createRoot(document.getElementById("root")!).render(<App />);
