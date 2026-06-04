import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export const CustomTitlebar: React.FC = () => {
  const appWindow = getCurrentWindow();

  return (
    <div
      data-tauri-drag-region
      className="h-8 flex justify-between items-center bg-gray-100 dark:bg-gray-800 select-none px-2"
    >
      <div data-tauri-drag-region className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-2 pointer-events-none">
        ezLaunch
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => {}} // TODO: 打开设置
          className="w-6 h-6 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          title="设置"
          aria-label="设置"
        >
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
            <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/>
            <circle cx="12" cy="12" r="3"/>
          </svg>
        </button>
        <button
          onClick={() => appWindow.minimize().catch(console.error)}
          className="w-6 h-6 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          title="最小化"
          aria-label="最小化"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <rect x="2" y="5" width="8" height="2" />
          </svg>
        </button>
        <button
          onClick={() => appWindow.hide().catch(console.error)}
          className="w-6 h-6 flex items-center justify-center hover:bg-red-500 hover:text-white rounded text-gray-700 dark:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          title="关闭"
          aria-label="关闭"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3.5 3.5L8.5 8.5M8.5 3.5L3.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
};
