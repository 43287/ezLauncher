import React, { useState, useEffect } from "react";
import { AppEntity } from "../types";
import { ShortcutItem } from "./ShortcutItem";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";

interface AppGridProps {
  apps: AppEntity[];
  onAppAdd: (app: AppEntity) => void;
  onAppRemove?: (id: string) => void;
}

/**
 * 应用网格组件，支持拖拽添加应用
 */
export const AppGrid: React.FC<AppGridProps> = ({ apps, onAppAdd, onAppRemove }) => {
  const [isDragging, setIsDragging] = useState(false);

  useEffect(() => {
    const appWindow = getCurrentWindow();
    
    const unlistenPromise = appWindow.onDragDropEvent((event) => {
      if (event.payload.type === 'enter' || event.payload.type === 'over') {
        setIsDragging(true);
      } else if (event.payload.type === 'leave') {
        setIsDragging(false);
      } else if (event.payload.type === 'drop') {
        setIsDragging(false);
        const files = event.payload.paths;
        if (files && files.length > 0) {
          const filePath = files[0];
          const fileNameMatch = filePath.match(/[^\\/]+$/);
          const fileName = fileNameMatch ? fileNameMatch[0].replace(/\.[^/.]+$/, "") : "Unknown";

          const createAndAddApp = async () => {
            let icon_base64: string | undefined = undefined;
            try {
              if (filePath.toLowerCase().endsWith('.exe') || filePath.toLowerCase().endsWith('.lnk')) {
                icon_base64 = await invoke<string>("extract_icon", { executablePath: filePath });
              }
            } catch (err) {
              console.error("Failed to extract icon:", err);
            }

            const newApp: AppEntity = {
              id: crypto.randomUUID(),
              name: fileName,
              executable_path: filePath,
              shortcut: null,
              icon_base64,
            };
            
            onAppAdd(newApp);
          };

          createAndAddApp();
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [onAppAdd]);

  return (
    <div
      className={`min-h-[300px] p-6 rounded-2xl transition-all duration-200 ${
        isDragging
          ? "bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-400"
          : "bg-transparent border-2 border-transparent"
      }`}
      role="region"
      aria-label="应用快捷方式网格，支持拖拽文件添加"
    >
      {apps.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-4">
          <div className="text-4xl">📁</div>
          <p className="text-sm font-medium">拖拽应用程序（.exe）到此处</p>
        </div>
      ) : (
        <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
          {apps.map((app) => (
            <ShortcutItem key={app.id} app={app} onRemove={onAppRemove} />
          ))}
        </div>
      )}
    </div>
  );
};
