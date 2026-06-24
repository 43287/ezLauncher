import { useEffect, useRef } from 'react';
import { getCurrentWindow } from "@tauri-apps/api/window";
import { platform } from "../api/platform";
import { LaunchItem } from "../types";
import { useDataStore } from "../store/useDataStore";
import { useUIStore } from "../store/useUIStore";
import { LaunchService } from "../services/LaunchService";
import { launchItemInteractive, needsInteractiveLaunch } from "../services/collectionRunner";
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
    let extractingTimeout: ReturnType<typeof setTimeout> | null = null;

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
              if (targetApp) {
                // 配置了输入流程/多参数附加 → 交互式采集（拖入作为首步/{target_file}）（FR-012/017）
                if (needsInteractiveLaunch(targetApp)) {
                  try {
                    await launchItemInteractive(targetApp, paths);
                  } catch (error) {
                    console.error("Failed to interactively launch app:", error);
                  }
                  return;
                }
                if (targetApp.type === 'app' && targetApp.executablePath) {
                  try {
                    await LaunchService.executeLaunch(targetApp, false, paths);
                  } catch (error) {
                    console.error("Failed to launch app with args:", error);
                  }
                  return;
                }
              }
            }

            if (isExtracting) return;
            isExtracting = true;

            // FR-011: 并行提取所有文件信息，减少串行 IPC 往返
            const infos = await Promise.all(
              paths.map(p => platform.extractFileInfo(p).catch((err) => {
                console.error("Failed to extract file info:", err);
                return null;
              }))
            );

            for (let i = 0; i < paths.length; i++) {
              const path = paths[i];
              const info = infos[i];
              if (!info) continue;

              let finalName = info.name || "Unknown";
              const fileNameMatch = path.match(/[^\\/]+$/);
              if (fileNameMatch && !info.name) {
                finalName = fileNameMatch[0].replace(/\.[^/.]+$/, "");
              }

              let ext = "";
              const extMatch = path.match(/\.([^/.]+)$/);
              if (extMatch) {
                ext = extMatch[1].toLowerCase();
              }

              const isDir = info.isDir || false;
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
                inputPipeline: null,
                paramPresets: null,
                multiParamEnabled: null,
              };

              state.addApp(newApp);
            }
            extractingTimeout = setTimeout(() => {
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
      if (extractingTimeout) clearTimeout(extractingTimeout);
    };
  }, [setIsDraggingFile, setHoveredItemId]);
}
