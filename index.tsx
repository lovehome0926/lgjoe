import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("BI Engine: Critical - Root element not found.");
}

const hideBootStatus = () => {
  const status = document.getElementById('boot-status');
  if (status) status.style.display = 'none';
};

try {
  const root = ReactDOM.createRoot(rootElement);
  root.render(
    <React.StrictMode>
      <App />
    </React.StrictMode>
  );
  // Give it a tiny bit of time for initial render before hiding splash
  setTimeout(hideBootStatus, 100);
} catch (err) {
  console.error("BI Engine Mount Error:", err);
  const display = document.getElementById('error-display');
  if (display) {
    display.style.display = 'block';
    display.textContent = `Hydration Failure: ${err instanceof Error ? err.message : String(err)}`;
  }
}