import React, { useState } from "react";
import { LaunchItem } from "../types";
import { tauriApi } from "../api/tauri";
import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useContextMenuStore } from "../store/useContextMenuStore";
import { useAppStore } from "../store/useAppStore";
import { useModalStore } from "../store/useModalStore";

export const buildLaunchContext = (app: LaunchItem, dropPaths?: string[]) => {
  // 1. 处理环境变量
  let envs: Record<string, string> | undefined = undefined;
  if (app.envVariables) {
    envs = {};
    app.envVariables.split('\n').forEach(line => {
      const parts = line.split('=');
      if (parts.length >= 2) {
        const key = parts[0].trim();
        const val = parts.slice(1).join('=').trim();
        if (key) envs![key] = val;
      }
    });
    if (Object.keys(envs).length === 0) envs = undefined;
  }

  // 2. 处理 args 宏替换
  let finalArgsStr = app.args || "";
  let dropHandledInArgs = false;
  if (dropPaths && dropPaths.length > 0) {
    const firstPath = dropPaths[0];
    const parentDir = firstPath.substring(0, Math.max(firstPath.lastIndexOf('\\'), firstPath.lastIndexOf('/')));

    if (finalArgsStr.includes("{target_path}") || finalArgsStr.includes("{target_file}") || finalArgsStr.includes("{{drop_file}}")) {
      // 替换 {target_path}
      if (parentDir) {
        finalArgsStr = finalArgsStr.replace(/\{target_path\}/g, `"${parentDir}"`);
      }
      
      // 替换 {target_file} 和旧版兼容的 {{drop_file}}
      const replacement = dropPaths.map(p => `"${p}"`).join(' ');
      finalArgsStr = finalArgsStr.replace(/\{target_file\}/g, replacement);
      finalArgsStr = finalArgsStr.replace(/\{\{drop_file\}\}/g, replacement);
      
      dropHandledInArgs = true;
    } else {
      // 默认追加行为
      finalArgsStr += " " + dropPaths.map(p => `"${p}"`).join(' ');
    }
  }

  // 智能解析带引号的参数
  const argsArray: string[] = [];
  if (finalArgsStr) {
    const regex = /[^\s"']+|"([^"]*)"|'([^']*)'/g;
    let match;
    while ((match = regex.exec(finalArgsStr)) !== null) {
      argsArray.push(match[1] || match[2] || match[0]);
    }
  }

  // 3. 处理 cwd 宏替换
  let finalCwd = app.cwd || undefined;
  if (dropPaths && dropPaths.length > 0 && finalCwd) {
    const firstPath = dropPaths[0];
    const parentDir = firstPath.substring(0, Math.max(firstPath.lastIndexOf('\\'), firstPath.lastIndexOf('/')));
    if (parentDir) {
      finalCwd = finalCwd.replace(/\{target_path\}/g, parentDir);
      finalCwd = finalCwd.replace(/\{\{drop_dir\}\}/g, parentDir);
    }
  }

  return { argsArray, cwd: finalCwd, envs, dropHandledInArgs };
};

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
  const { removeApp, updateApp } = useAppStore();
  const openEditApp = useModalStore((state) => state.openEditApp);

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
    // If dnd-kit provides a transition (during drop animation), use it.
    // Otherwise, if we are actively dragging, disable transition completely to ensure it follows the cursor instantly.
    transition: transition || (isDragging ? 'none' : undefined),
    opacity: isDragging ? 0.5 : 1,
    zIndex: isDragging ? 1 : 0,
  };

  const handleLaunch = async (e: React.MouseEvent) => {
    if (app.type === 'separator') return;
    const runAsAdmin = e.shiftKey || app.runAsAdmin || false;
    try {
      // 启动前先隐藏窗口，提升响应速度体验
      await tauriApi.hideWindow();
      if (app.type === 'link' && app.url) {
        // 对于网页链接，交给 Rust 后端调用 open crate 处理（Windows 上通常使用 ShellExecute 打开默认浏览器）
        await tauriApi.launchApp(app.url, [], runAsAdmin);
      } else if (app.type === 'command') {
        const { argsArray, cwd, envs } = buildLaunchContext(app);
        
        let shellExe = app.executablePath || 'pwsh';
        let shellArgs: string[] = [];
        
        if (shellExe === 'pwsh' || shellExe === 'powershell') {
          shellArgs = ['-NoProfile', '-Command', argsArray.join(' ')];
        } else if (shellExe === 'cmd') {
          shellArgs = ['/C', argsArray.join(' ')];
        } else if (shellExe === 'bash') {
          shellArgs = ['-c', argsArray.join(' ')];
        } else {
          shellArgs = argsArray;
        }

        // 如果用户要求在终端中运行，我们通过 cmd /C start 来弹出一个新的终端窗口
        if (app.inTerminal) {
          const terminalArgs = ['/C', 'start', shellExe, ...shellArgs];
          await tauriApi.launchApp('cmd.exe', terminalArgs, runAsAdmin, cwd, envs);
        } else {
          await tauriApi.launchApp(shellExe, shellArgs, runAsAdmin, cwd, envs);
        }
      } else if (app.executablePath) {
        const { argsArray, cwd, envs } = buildLaunchContext(app);
        await tauriApi.launchApp(app.executablePath, argsArray, runAsAdmin, cwd, envs);
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
          openEditApp(app);
        }
      });
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
          className={`aspect-square w-full max-w-[90px] flex flex-col items-center justify-center p-2 rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 cursor-grab active:cursor-grabbing active:scale-95 ${
            isDragging ? '' : 'transition-all duration-300 apple-ease'
          } ${
            isHovered 
              ? 'bg-blue-50/50 dark:bg-blue-900/30 ring-1 ring-blue-400 shadow-soft' // Lighter highlight for drag-to-item
              : 'hover:bg-black/5 dark:hover:bg-white/10'
          }`}
        >
          {app.iconUrl ? (
            <img
              src={app.iconUrl}
              alt={`${app.name} icon`}
              className="w-12 h-12 mb-2 rounded-lg object-contain shadow-sm bg-transparent pointer-events-none"
            />
          ) : app.isDir ? (
            <svg className="w-12 h-12 mb-2 pointer-events-none drop-shadow-sm" viewBox="0 0 24 24" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M4 5C4 3.89543 4.89543 3 6 3H8.70711C9.2375 3 9.74618 3.21071 10.1213 3.58579L11.4142 4.87868C11.7893 5.25376 12.298 5.46447 12.8284 5.46447H18C19.1046 5.46447 20 6.3599 20 7.46447V19C20 20.1046 19.1046 21 18 21H6C4.89543 21 4 20.1046 4 19V5Z" fill="#FCD34D" stroke="#F59E0B" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
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
});
