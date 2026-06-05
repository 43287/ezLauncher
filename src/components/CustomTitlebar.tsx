import React from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

export const CustomTitlebar: React.FC = () => {
  const appWindow = getCurrentWindow();

  const handleAdminRestart = async () => {
    try {
      await invoke("restart_as_admin");
    } catch (e) {
      console.error("Failed to restart as admin:", e);
      alert(e); // Provide feedback to the user
    }
  };

  return (
    <div
      data-tauri-drag-region
      className="h-8 flex justify-between items-center bg-gray-100 dark:bg-gray-800 select-none px-2"
    >
      <div 
        className="text-sm font-semibold text-gray-700 dark:text-gray-300 ml-2 cursor-pointer hover:text-blue-500 transition-colors"
        onDoubleClick={handleAdminRestart}
        title="双击以管理员权限重启"
      >
        ezLauncher
      </div>
      <div className="flex space-x-2">
        <button
          onClick={() => appWindow.minimize().catch(console.error)}
          className="w-6 h-6 flex items-center justify-center hover:bg-gray-300 dark:hover:bg-gray-700 rounded text-gray-700 dark:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          title="最小化"
          aria-label="最小化窗口"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <rect x="2" y="5" width="8" height="2" />
          </svg>
        </button>
        <button
          onClick={() => appWindow.hide().catch(console.error)}
          className="w-6 h-6 flex items-center justify-center hover:bg-red-500 hover:text-white rounded text-gray-700 dark:text-gray-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-red-500"
          title="关闭"
          aria-label="关闭窗口"
        >
          <svg width="12" height="12" viewBox="0 0 12 12" fill="currentColor">
            <path d="M3.5 3.5L8.5 8.5M8.5 3.5L3.5 8.5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
    </div>
  );
};
