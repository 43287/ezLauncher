import React, { useState } from "react";
import { LaunchItem } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { ContextMenuItem } from "./ContextMenuItem";

interface ShortcutItemProps {
  app: LaunchItem;
  isHovered?: boolean;
  onRemove?: (id: string) => void;
  onEditProperties?: (app: LaunchItem) => void;
  onRename?: (id: string, newName: string) => void;
}

/**
 * 快捷方式项组件
 * @param app 应用实体信息
 */
export const ShortcutItem: React.FC<ShortcutItemProps> = ({ app, isHovered = false, onRemove, onEditProperties, onRename }) => {
  const [isEditingSeparator, setIsEditingSeparator] = useState(false);
  const [separatorName, setSeparatorName] = useState(app.name);

  const [contextMenu, setContextMenu] = useState<{ x: number; y: number } | null>(null);

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: app.id });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  const handleLaunch = async () => {
    if (app.type === 'separator') return;
    try {
      if (app.type === 'link' && app.url) {
        // Handle link launching
        await invoke("launch_app", { executablePath: app.url });
      } else if (app.executablePath) {
        await invoke("launch_app", { executablePath: app.executablePath });
      }
      // 启动后可以隐藏窗口
      await invoke("hide_window");
    } catch (error) {
      console.error("Failed to launch app:", error);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const x = Math.min(e.clientX, window.innerWidth - 145);
    const y = Math.min(e.clientY, window.innerHeight - 180);
    setContextMenu({ x, y });
  };

  const closeContextMenu = () => {
    setContextMenu(null);
  };

  const handleSeparatorDoubleClick = (e: React.MouseEvent) => {
    e.stopPropagation();
    setIsEditingSeparator(true);
  };

  const handleSeparatorKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      onRename?.(app.id, separatorName);
      setIsEditingSeparator(false);
    } else if (e.key === 'Escape') {
      setSeparatorName(app.name);
      setIsEditingSeparator(false);
    }
  };

  const handleSeparatorBlur = () => {
    onRename?.(app.id, separatorName);
    setIsEditingSeparator(false);
  };

  const renderContextMenu = () => {
    if (!contextMenu) return null;
    return (
      <>
        <div 
          className="fixed inset-0 z-40" 
          onClick={closeContextMenu}
          onContextMenu={(e) => {
            e.preventDefault();
            closeContextMenu();
          }}
        />
        <div
          className="fixed z-50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md border border-gray-200/50 dark:border-gray-700/50 shadow-2xl rounded-xl py-1 w-24 overflow-visible"
          style={{ top: contextMenu.y, left: contextMenu.x }}
          onClick={(e) => e.stopPropagation()}
        >
          {app.type !== 'separator' && (
            <>
              <ContextMenuItem 
                label="编辑属性" 
                onClick={(e) => {
                  e.stopPropagation();
                  onEditProperties?.(app);
                  closeContextMenu();
                }}
              />
              <div className="h-px bg-gray-200/50 dark:bg-gray-700/50 my-1 mx-2" />
            </>
          )}

          {/* Delete Button */}
          <button
              className="w-full text-left px-3 py-1.5 text-xs font-medium transition-colors hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 focus-visible:outline-none relative z-50"
              onClick={(e) => {
                e.stopPropagation();
                onRemove?.(app.id);
                closeContextMenu();
              }}
            >
              删除
            </button>
          </div>
        </>
    );
  };

  if (app.type === 'separator') {
    return (
      <>
        <div
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          data-app-id={app.id}
          onContextMenu={handleContextMenu}
          onDoubleClick={handleSeparatorDoubleClick}
          className={`w-full flex items-center py-2 cursor-grab active:cursor-grabbing rounded-lg transition-all duration-300 ease-out h-[40px] shrink-0 ${
            isHovered ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-400' : ''
          }`}
        >
          <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
          <div className="px-4 text-sm font-medium text-gray-500 dark:text-gray-400">
            {isEditingSeparator ? (
              <input
                autoFocus
                value={separatorName}
                onChange={(e) => setSeparatorName(e.target.value)}
                onKeyDown={handleSeparatorKeyDown}
                onBlur={handleSeparatorBlur}
                className="bg-transparent border-b border-blue-500 outline-none text-center"
                onClick={(e) => e.stopPropagation()}
                onPointerDown={(e) => e.stopPropagation()}
              />
            ) : (
              app.name || '分隔符'
            )}
          </div>
          <div className="flex-1 h-px bg-gray-300 dark:bg-gray-700"></div>
        </div>
        {renderContextMenu()}
      </>
    );
  }

  return (
    <>
      <div className="flex justify-center shrink-0 w-[calc(25%-0.375rem)] sm:w-[calc(20%-0.4rem)] md:w-[calc(16.666%-0.416rem)]">
        <button
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          data-app-id={app.id}
          onDoubleClick={handleLaunch}
          onContextMenu={handleContextMenu}
          className={`aspect-square w-full max-w-[90px] flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-300 ease-out focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 cursor-grab active:cursor-grabbing ${
            isHovered 
              ? 'bg-blue-50 dark:bg-blue-900/30 ring-1 ring-blue-400' // Lighter highlight for drag-to-item
              : 'hover:bg-gray-100 dark:hover:bg-gray-800'
          }`}
          aria-label={`双击启动 ${app.name}`}
        >
          {app.iconBase64 ? (
            <img
              src={app.iconBase64}
              alt={`${app.name} icon`}
              className="w-12 h-12 mb-2 rounded-lg object-contain shadow-sm bg-transparent pointer-events-none"
            />
          ) : (
            <div className="w-12 h-12 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-lg flex items-center justify-center text-xl font-bold mb-2 shadow-sm pointer-events-none">
              {app.name.charAt(0).toUpperCase()}
            </div>
          )}
          <span className="text-xs font-medium text-gray-700 dark:text-gray-200 text-center pointer-events-none leading-tight break-words line-clamp-2 w-full">
            {app.name}
          </span>
          {app.shortcut && (
            <span className="text-[10px] text-gray-500 dark:text-gray-400 mt-1 bg-gray-100 dark:bg-gray-800 px-1.5 py-0.5 rounded pointer-events-none">
              {app.shortcut}
            </span>
          )}
        </button>
      </div>

      {renderContextMenu()}
    </>
  );
};
