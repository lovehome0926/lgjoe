import React from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

const hideBootStatus = () => {
  const status = document.getElementById('boot-status');
  if (status) {
    status.style.opacity = '0';
    setTimeout(() => {
      status.style.display = 'none';
    }, 300);
  }
};

const showError = (message: string) => {
  const display = document.getElementById('error-display');
  const retry = document.getElementById('retry-btn');
  if (display) {
    display.style.display = 'block';
    display.textContent = message;
  }
  if (retry) retry.style.display = 'block';
};

if (!rootElement) {
  showError("BI Engine: Critical - Root element not found.");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    // 渲染启动后立即尝试隐藏加载层
    requestAnimationFrame(() => {
      setTimeout(hideBootStatus, 600);
    });
  } catch (err) {
    console.error("BI Engine Mount Error:", err);
    hideBootStatus();
    showError(`Hydration Failure: ${err instanceof Error ? err.message : String(err)}`);
  }
}