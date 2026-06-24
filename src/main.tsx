import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import { CollectorApp } from "./windows/collector/CollectorApp";

// 009: 采集子窗口与主窗口共用同一构建，按 hash 路由区分入口。
// 采集窗口 URL 形如 index.html#/collector/{type}?session=...&step=...
function isCollectorRoute(): boolean {
  return window.location.hash.startsWith("#/collector/");
}

const root = ReactDOM.createRoot(document.getElementById("root") as HTMLElement);

root.render(
  <React.StrictMode>
    {isCollectorRoute() ? <CollectorApp /> : <App />}
  </React.StrictMode>,
);
