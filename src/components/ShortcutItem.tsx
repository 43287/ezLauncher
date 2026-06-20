import React, { useState } from "react";
import * as LucideIcons from "lucide-react";
import { LaunchItem } from "../types";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useContextMenuStore } from "../store/useContextMenuStore";
import { useDataStore } from "../store/useDataStore";
import { useUIStore } from "../store/useUIStore";
import { useModalStore } from "../store/useModalStore";
import { resolveIcon } from "../utils/icons";
import { LaunchService } from "../services/LaunchService";
import { platform } from "../api/platform";

interface ShortcutItemProps {
  app: LaunchItem;
  isHovered?: boolean;
}

/**
 * 快捷方式项组件
 * @param app 应用实体信息
 */
export const ShortcutItem: React.FC<ShortcutItemProps> = React.memo(({ app, isHovered = false }) => {
  const [isEditingSeparator, setIsEditingSeparator] = useState(false);
  const [separatorName, setSeparatorName] = useState(app.name);
  const openMenu = useContextMenuStore((state) => state.openMenu);
  const { removeApp, updateApp } = useDataStore();
  const openEditApp = useModalStore((state) => state.openEditApp);
  const focusedAppId = useUIStore((state) => state.focusedAppId);
  const isKeyboardFocused = focusedAppId === app.id;

  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `item-${app.id}` });

  const style = {
    transform: CSS.Translate.toString(transform),
    // If dnd-kit provides a transition (during drop animation), use it.
    // Otherwise, if we are actively dragging, disable transition completely to ensure it follows the cursor instantly.
    transition: transition || (isDragging ? 'none' : undefined),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  const handleLaunch = async (e?: React.MouseEvent, forceAdmin?: boolean) => {
    await LaunchService.executeLaunch(app, forceAdmin || (e ? e.shiftKey : false));
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
          openEditApp(app);
        }
      });
      menuItems.push({ isSeparator: true, label: "" });

      menuItems.push({
        label: "以管理员启动",
        onClick: (ev: React.MouseEvent) => {
          ev.stopPropagation();
          handleLaunch(undefined, true);
        }
      });

      const targetPath = app.type === 'script' ? app.args : (app.type === 'app' ? app.executablePath : undefined);
      if (targetPath) {
        menuItems.push({
          label: "打开文件所在位置",
          onClick: (ev: React.MouseEvent) => {
            ev.stopPropagation();
            platform.launchApp('explorer.exe', ['/select,', targetPath], false);
          }
        });
      }
      menuItems.push({ isSeparator: true, label: "" });
    }
    menuItems.push({
      label: "删除",
      onClick: (e: React.MouseEvent) => {
        e.stopPropagation();
        removeApp(app.id);
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
      updateApp(app.id, { name: separatorName });
      setIsEditingSeparator(false);
    } else if (e.key === 'Escape') {
      setSeparatorName(app.name);
      setIsEditingSeparator(false);
    }
  };

  const handleSeparatorBlur = () => {
    updateApp(app.id, { name: separatorName });
    setIsEditingSeparator(false);
  };

  const resolvedIcon = resolveIcon(app.isDir ? 'dir_fallback_icon' : app.iconUrl);

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
          className={`col-span-full flex items-center py-2 cursor-grab active:cursor-grabbing rounded-lg h-[40px] shrink-0 ${
            isDragging ? '' : 'transition-all duration-300 apple-ease'
          } ${
            isHovered ? 'bg-blue-50/50 dark:bg-blue-900/30 ring-1 ring-blue-400' : ''
          } ${isKeyboardFocused ? 'ring-2 ring-blue-500 ring-offset-1 bg-black/5 dark:bg-white/10' : ''}`}
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
          className={`aspect-square w-full max-w-[80px] flex flex-col items-center justify-center p-0 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 cursor-grab active:cursor-grabbing active:scale-95 ${
            isDragging ? '' : 'transition-all duration-300 apple-ease'
          } ${
            isHovered 
              ? 'bg-blue-50/50 dark:bg-blue-900/30 ring-1 ring-blue-400 shadow-soft' // Lighter highlight for drag-to-item
              : 'hover:bg-black/5 dark:hover:bg-white/10'
          } ${isKeyboardFocused ? 'ring-2 ring-blue-500 ring-offset-2 bg-black/5 dark:bg-white/10 shadow-soft' : ''}`}
        >
          {resolvedIcon?.type === 'lucide' ? (
            <div className="w-10 h-10 mb-0.5 rounded-lg object-contain shadow-sm bg-transparent pointer-events-none flex items-center justify-center text-gray-800 dark:text-gray-200">
              {React.createElement((LucideIcons as any)[resolvedIcon.content] || LucideIcons.HelpCircle, { size: '100%', strokeWidth: 1.5 })}
            </div>
          ) : resolvedIcon?.type === 'svg' ? (
            <div 
              className={`w-10 h-10 mb-0.5 rounded-lg object-contain shadow-sm bg-transparent pointer-events-none flex items-center justify-center [&>svg]:w-full [&>svg]:h-full ${app.isDir ? 'drop-shadow-sm' : ''}`}
              dangerouslySetInnerHTML={{ __html: resolvedIcon.content }}
            />
          ) : resolvedIcon?.type === 'url' ? (
            <img
              src={resolvedIcon.content}
              alt={`${app.name} icon`}
              className="w-10 h-10 mb-0.5 rounded-lg object-contain shadow-sm bg-transparent pointer-events-none"
            />
          ) : (
            <div className="w-10 h-10 bg-blue-100 dark:bg-blue-900 text-blue-600 dark:text-blue-300 rounded-lg flex items-center justify-center text-xl font-bold mb-0.5 shadow-sm pointer-events-none">
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
});
