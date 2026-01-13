import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';

const rootElement = document.getElementById('root');

const hideBootStatus = () => {
  const status = document.getElementById('boot-status');
  if (status) status.style.display = 'none';
};

const showError = (message: string) => {
  const display = document.getElementById('error-display');
  if (display) {
    display.style.display = 'block';
    display.textContent = message;
  }
};

if (!rootElement) {
  showError("BI Engine: Critical - Root element not found.");
} else {
  try {
    const root = ReactDOM.createRoot(rootElement);
    root.render(
      <React.StrictMode>
        <App />
      </React.StrictMode>
    );
    // 延迟 500ms 确保首屏渲染完成再关闭加载动画
    setTimeout(hideBootStatus, 500);
  } catch (err) {
    console.error("BI Engine Mount Error:", err);
    hideBootStatus(); // 报错也得关掉，否则用户看不到错误提示
    showError(`Hydration Failure: ${err instanceof Error ? err.message : String(err)}`);
  }
}