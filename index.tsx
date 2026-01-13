
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

console.log("BI Engine: Initializing mount...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("BI Engine: Root element not found!");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    console.log("BI Engine: Mount successful.");
  } catch (err) {
    console.error("BI Engine: Critical boot error", err);
    rootElement.innerHTML = `<div style="padding: 40px; color: #e11d48; font-family: sans-serif;">
      <h2 style="font-weight: 900;">Boot Error</h2>
      <pre style="background: #f1f5f9; padding: 20px; border-radius: 12px; overflow: auto;">${err instanceof Error ? err.stack : 'Unknown crash during hydration'}</pre>
      <button onclick="window.location.reload()" style="background: #0f172a; color: white; padding: 10px 20px; border: none; border-radius: 8px; cursor: pointer; margin-top: 20px;">Manual Refresh</button>
    </div>`;
  }
}
