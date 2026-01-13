
import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';

console.log("BI Engine: Initializing mount...");

const rootElement = document.getElementById('root');
if (!rootElement) {
  console.error("BI Engine: Root element not found!");
  throw new Error("Could not find root element to mount to");
}

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
  rootElement.innerHTML = `<div style="padding: 20px; color: red; font-family: sans-serif;">
    <h2>Boot Error</h2>
    <p>${err instanceof Error ? err.message : 'Unknown error'}</p>
    <button onclick="window.location.reload()">Retry Load</button>
  </div>`;
}
