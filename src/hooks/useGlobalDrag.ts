import { useEffect, useRef } from 'react';
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform } from "../api/platform";
import { LaunchItem } from "../types";
import { useDataStore } from "../store/useDataStore";
import { useUIStore } from "../store/useUIStore";
import { LaunchService } from "../services/LaunchService";
import { getIconForExtension, getInterpreterForExtension } from "../utils/icons";
import { generateId } from "../constants/ids";

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
            const pos = (event.payload as { position?: { x: number; y: number } }).position;
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

            const state = useDataStore.getState();
      const uiState = useUIStore.getState();

            // 如果悬停在某个应用上，则使用该应用打开拖放的文件
            if (hoveredId) {
              const targetApp = state.apps.find(a => a.id === hoveredId);
              if (targetApp && targetApp.type === 'app' && targetApp.executablePath) {
                try {
                  await LaunchService.executeLaunch(targetApp, false, paths);
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
                let finalName = "Unknown";
                const fileNameMatch = path.match(/[^\\/]+$/);
                if (fileNameMatch) {
                  finalName = fileNameMatch[0].replace(/\.[^/.]+$/, "");
                }

                let ext = "";
                const extMatch = path.match(/\.([^/.]+)$/);
                if (extMatch) {
                  ext = extMatch[1].toLowerCase();
                }

                const info = await platform.extractFileInfo(path);
                finalName = info.name || finalName;
                let isDir = info.isDir || false;
                
                let iconUrl = info.iconUrl || undefined;
                let type: 'app' | 'script' = 'app';
                let executablePath = path;
                let args: string | null = null;

                if (!isDir && ext) {
                  const svgIcon = getIconForExtension(ext);
                  const interpreter = getInterpreterForExtension(ext);

                  if (svgIcon) {
                    iconUrl = svgIcon;
                    if (interpreter) {
                      type = 'script';
                      executablePath = interpreter;
                      args = path;
                    }
                  } else {
                    iconUrl = path;
                  }
                } else if (isDir) {
                  iconUrl = path;
                } else {
                  iconUrl = path;
                }

                const newApp: LaunchItem = {
                  id: generateId(),
                  name: finalName,
                  type,
                  executablePath,
                  args,
                  iconUrl,
                  isDir,
                  shortcut: null,
                  categoryId: uiState.activeLeftTab,
                  columnId: uiState.activeTopTab,
                  url: null,
                  cwd: null,
                  envVariables: null,
                  runAsAdmin: false,
                  inTerminal: false,
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
