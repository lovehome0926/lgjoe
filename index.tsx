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
      status.style.visibility = 'hidden';
    }, 500);
  }
};

const showError = (message: string) => {
  const display = document.getElementById('error-display');
  const retry = document.getElementById('retry-btn');
  if (display) {
    display.style.display = 'block';
    display.textContent = `JS_RUNTIME_ERROR (v4.0): ${message}`;
  }
  if (retry) retry.style.display = 'block';
  // 即使报错，也要关掉 Loading，否则用户什么都看不见
  hideBootStatus();
};

if (!rootElement) {
  showError("Root element '#root' missing in HTML.");
} else {
  try {
    const root = createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    // 强制 UI 线程空闲时隐藏加载动画
    requestAnimationFrame(() => {
      setTimeout(hideBootStatus, 1000);
    });
  } catch (err: any) {
    console.error("Critical Mount Error:", err);
    showError(err?.message || String(err));
  }
}