import { useEffect, useRef } from 'react';
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
import { LaunchItem } from "../types";

export function useGlobalDrag(
  apps: LaunchItem[],
  setApps: React.Dispatch<React.SetStateAction<LaunchItem[]>>,
  activeLeftTab: string,
  activeTopTab: string,
  setIsDraggingFile: (dragging: boolean) => void,
  setHoveredItemId: (id: string | null) => void
) {
  const hoveredItemIdRef = useRef<string | null>(null);
  const prevAppsRef = useRef(apps);
  const activeTabsRef = useRef({ left: activeLeftTab, top: activeTopTab });

  useEffect(() => {
    prevAppsRef.current = apps;
  }, [apps]);

  useEffect(() => {
    activeTabsRef.current = { left: activeLeftTab, top: activeTopTab };
  }, [activeLeftTab, activeTopTab]);

  useEffect(() => {
    let unlistenDrop: (() => void) | undefined;

    const setupDragDrop = async () => {
      try {
        const win = getCurrentWindow();
        let isExtracting = false;

        unlistenDrop = await win.onDragDropEvent(async (event) => {
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

            // 如果悬停在某个应用上，则使用该应用打开拖放的文件
            if (hoveredId) {
              const targetApp = prevAppsRef.current.find(a => a.id === hoveredId);
              if (targetApp && targetApp.type === 'app' && targetApp.executablePath) {
                try {
                  await invoke("launch_app", { 
                    executablePath: targetApp.executablePath,
                    args: paths
                  });
                  await invoke("hide_window");
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
                let iconBase64: string | undefined = undefined;
                let finalName = "Unknown";
                
                const fileNameMatch = path.match(/[^\\/]+$/);
                if (fileNameMatch) {
                  finalName = fileNameMatch[0].replace(/\.[^/.]+$/, "");
                }

                if (path.toLowerCase().endsWith('.exe') || path.toLowerCase().endsWith('.lnk')) {
                  try {
                    iconBase64 = await invoke<string>("extract_icon", { executablePath: path });
                  } catch (e) {
                    console.warn("Failed to extract native icon, falling back:", e);
                  }
                }
                
                if (!iconBase64) {
                  const info: any = await invoke("extract_file_info", { filePath: path });
                  finalName = info.name || finalName;
                  iconBase64 = info.iconBase64 || undefined;
                }

                const newApp: LaunchItem = {
                  id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                  name: finalName,
                  type: 'app',
                  executablePath: path,
                  iconBase64,
                  shortcut: null,
                  categoryId: activeTabsRef.current.left,
                  columnId: activeTabsRef.current.top
                };
                
                setApps(prev => {
                  if (newApp.type === 'app' && newApp.executablePath) {
                    const existingPaths = new Set(prev.filter(a => a.type === 'app' && a.executablePath).map(a => a.executablePath));
                    if (existingPaths.has(newApp.executablePath)) {
                      return prev;
                    }
                  }
                  return [...prev, newApp];
                });
              } catch (err) {
                console.error("Failed to extract file info:", err);
              }
            }
            setTimeout(() => {
              isExtracting = false;
            }, 100);
          }
        });
      } catch (error) {
        console.error("Failed to setup drag and drop events:", error);
      }
    };

    setupDragDrop();

    return () => {
      if (unlistenDrop) unlistenDrop();
    };
  }, [setApps, setIsDraggingFile, setHoveredItemId]);
}
