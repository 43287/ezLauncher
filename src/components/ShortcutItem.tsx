import React, { useState, useEffect } from "react";
import { AppEntity } from "../types";
import { invoke } from "@tauri-apps/api/core";

interface ShortcutItemProps {
  app: AppEntity;
  onRemove?: (id: string) => void;
}

/**
 * 快捷方式项组件
 * @param app 应用实体信息
 */
export const ShortcutItem: React.FC<ShortcutItemProps> = ({ app, onRemove }) => {
  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const handleLaunch = async () => {
    try {
      await invoke("launch_app", { executablePath: app.executable_path });
      // 启动后可以隐藏窗口
      await invoke("hide_window");
    } catch (error) {
      console.error("Failed to launch app:", error);
      // 可以添加一些错误提示
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    setContextMenu({ x: e.pageX, y: e.pageY });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  useEffect(() => {
    if (contextMenu) {
      window.addEventListener("click", closeContextMenu);
      return () => {
        window.removeEventListener("click", closeContextMenu);
      };
    }
  }, [contextMenu]);

  return (
    <>
      <button
        onDoubleClick={handleLaunch}
        onContextMenu={handleContextMenu}
        className="flex flex-col items-center justify-center p-4 rounded-xl hover:bg-gray-100 dark:hover:bg-gray-800 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={`双击启动 ${app.name}`}
        title={`双击打开: ${app.executable_path}`}
      >
        {app.icon_base64 ? (
          <img
            src={app.icon_base64}
            alt={`${app.name} icon`}
            className="w-12 h-12 mb-2 rounded-xl object-contain shadow-sm bg-transparent"
          />
        ) : (
          <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-2xl flex items-center justify-center text-xl font-bold mb-2 shadow-sm">
            {app.name.charAt(0).toUpperCase()}
          </div>
        )}
        <span className="text-sm font-medium text-gray-700 dark:text-gray-200 truncate w-full text-center">
          {app.name}
        </span>
        {app.shortcut && (
          <span className="text-xs text-gray-500 dark:text-gray-400 mt-1 bg-gray-100 dark:bg-gray-800 px-2 py-0.5 rounded">
            {app.shortcut}
          </span>
        )}
      </button>
      {contextMenu && (
        <div
          className="fixed z-50 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 shadow-lg rounded-md py-1 min-w-[120px]"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          <button
            className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-gray-100 dark:hover:bg-gray-700"
            onClick={() => {
              onRemove?.(app.id);
              closeContextMenu();
            }}
          >
            删除快捷方式
          </button>
        </div>
      )}
    </>
  );
};
