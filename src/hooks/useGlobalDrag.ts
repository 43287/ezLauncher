import { useEffect, useRef } from 'react';
import { getCurrentWindow } from "@tauri-apps/api/window";
import { tauriApi } from "../api/tauri";
import { LaunchItem } from "../types";
import { useAppStore } from "../store/useAppStore";

export function useGlobalDrag(
  setIsDraggingFile: (dragging: boolean) => void,
  setHoveredItemId: (id: string | null) => void
) {
  const hoveredItemIdRef = useRef<string | null>(null);

  useEffect(() => {
    let unlistenDrop: (() => void) | undefined;
    let isCancelled = false;

    const setupDragDrop = async () => {
      try {
        const win = getCurrentWindow();
        let isExtracting = false;

        const unlisten = await win.onDragDropEvent(async (event) => {
          if (event.payload.type === 'enter' || event.payload.type === 'over') {
            setIsDraggingFile(true);
            const pos = (event.payload as any).position;
            if (pos) {
              const clientX = pos.x / window.devicePixelRatio;
              const clientY = pos.y / window.devicePixelRatio;
              const el = document.elementFromPoint(clientX, clientY);
              const appEl = el?.closest('[data-app-id]');
              const id = appEl?.getAttribute('data-app-id');
              if (id !== hoveredItemIdRef.current) {
                hoveredItemIdRef.current = id || null;
                setHoveredItemId(id || null);
              }
            }
          } else if (event.payload.type === 'leave') {
            setIsDraggingFile(false);
            hoveredItemIdRef.current = null;
            setHoveredItemId(null);
          } else if (event.payload.type === 'drop') {
            setIsDraggingFile(false);
            
            const hoveredId = hoveredItemIdRef.current;
            hoveredItemIdRef.current = null;
            setHoveredItemId(null);

            const paths = event.payload.paths;
            if (!paths || paths.length === 0) return;

            const state = useAppStore.getState();

            // 如果悬停在某个应用上，则使用该应用打开拖放的文件
            if (hoveredId) {
              const targetApp = state.apps.find(a => a.id === hoveredId);
              if (targetApp && targetApp.type === 'app' && targetApp.executablePath) {
                try {
                  await tauriApi.launchApp(targetApp.executablePath, paths, false);
                  await tauriApi.hideWindow();
                } catch (error) {
                  console.error("Failed to launch app with args:", error);
                }
                return;
              }
            }

            if (isExtracting) return;
            isExtracting = true;
            for (const path of paths) {
              try {
                // 优先尝试作为可执行文件或快捷方式提取图标
                let finalName = "Unknown";
                
                const fileNameMatch = path.match(/[^\\/]+$/);
                if (fileNameMatch) {
                  finalName = fileNameMatch[0].replace(/\.[^/.]+$/, "");
                }

                const info = await tauriApi.extractFileInfo(path);
                finalName = info.name || finalName;
                let iconUrl = info.iconUrl || undefined;

                const newApp: LaunchItem = {
                  id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                  name: finalName,
                  type: 'app',
                  executablePath: path,
                  iconUrl,
                  shortcut: null,
                  categoryId: state.activeLeftTab,
                  columnId: state.activeTopTab
                };
                
                state.addApp(newApp);
              } catch (err) {
                console.error("Failed to extract file info:", err);
              }
            }
            setTimeout(() => {
              isExtracting = false;
            }, 100);
          }
        });

        if (isCancelled) {
          unlisten();
        } else {
          unlistenDrop = unlisten;
        }
      } catch (error) {
        console.error("Failed to setup drag and drop events:", error);
      }
    };

    setupDragDrop();

    return () => {
      isCancelled = true;
      if (unlistenDrop) unlistenDrop();
    };
  }, [setIsDraggingFile, setHoveredItemId]);
}
