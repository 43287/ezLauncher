import React, { useState } from "react";
import { LaunchItem } from "../types";
import { invoke } from "@tauri-apps/api/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useContextMenuStore } from "../store/useContextMenuStore";

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
  const { openMenu } = useContextMenuStore();

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

  const handleLaunch = async (e: React.MouseEvent) => {
    if (app.type === 'separator') return;
    const runAsAdmin = e.shiftKey || app.runAsAdmin;
    try {
      // 启动前先隐藏窗口，提升响应速度体验
      await invoke("hide_window");
      if (app.type === 'link' && app.url) {
        // Handle link launching
        await invoke("launch_app", { executablePath: app.url, runAsAdmin });
      } else if (app.executablePath) {
        await invoke("launch_app", { executablePath: app.executablePath, args: app.args, runAsAdmin });
      }
    } catch (error) {
      console.error("Failed to launch app:", error);
    }
  };

  const handleContextMenu = (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    
    const menuItems = [];
    if (app.type !== 'separator') {
      menuItems.push({
        label: "编辑属性",
        onClick: (e: React.MouseEvent) => {
          e.stopPropagation();
          onEditProperties?.(app);
        }
      });
      menuItems.push({ isSeparator: true, label: "" });
    }
    menuItems.push({
      label: "删除",
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        onRemove?.(app.id);
      }
    });

    openMenu(menuItems, e.clientX, e.clientY);
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
          className={`col-span-full flex items-center py-2 cursor-grab active:cursor-grabbing rounded-lg transition-all duration-300 apple-ease h-[40px] shrink-0 ${
            isHovered ? 'bg-blue-50/50 dark:bg-blue-900/30 ring-1 ring-blue-400' : ''
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
      </>
    );
  }

  return (
    <>
      <div className="flex justify-center w-full">
        <button
          ref={setNodeRef}
          style={style}
          {...attributes}
          {...listeners}
          data-app-id={app.id}
          onDoubleClick={handleLaunch}
          onContextMenu={handleContextMenu}
          className={`aspect-square w-full max-w-[90px] flex flex-col items-center justify-center p-2 rounded-lg transition-all duration-300 apple-ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 cursor-grab active:cursor-grabbing active:scale-95 ${
            isHovered 
              ? 'bg-blue-50/50 dark:bg-blue-900/30 ring-1 ring-blue-400 shadow-soft' // Lighter highlight for drag-to-item
              : 'hover:bg-black/5 dark:hover:bg-white/10'
          }`}
          aria-label={`双击启动 ${app.name}`}
        >
          {app.iconUrl ? (
            <img
              src={app.iconUrl}
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
    </>
  );
};
