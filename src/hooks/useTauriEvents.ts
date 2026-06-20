import { useEffect, useRef } from 'react';
import { getCurrentWindow, currentMonitor, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { tauriApi } from "../api/tauri";
import { FORCE_HIDE_ANIMATION, FORCE_SHOW_ANIMATION, TOGGLE_VISIBILITY } from "../constants/events";
import { useUIStore } from '../store/useUIStore';

export function useTauriEvents(setIsVisible: React.Dispatch<React.SetStateAction<boolean>>, _isVisible: boolean, summonShortcut?: string, summonMouseShortcut?: string) {
  useEffect(() => {
    let unlisteners: (() => void)[] = [];
    let isMounted = true;

    const setupWindow = async () => {
      try {
        const win = getCurrentWindow();
        const monitor = await currentMonitor();

        if (monitor) {
          const scaleFactor = monitor.scaleFactor;
          const monitorWidth = monitor.size.width / scaleFactor;
          // Dynamically compute width to be around 25% of the monitor width, clamped to a reasonable minimum
          const logicalWidth = Math.max(380, Math.min(monitorWidth * 0.25, 800));
          const logicalHeight = monitor.size.height / scaleFactor;

          // 吸附在屏幕右侧或左侧，占据全高
          // 我们这里可以暂时先设置为 right，真正的动态位置交给 App.tsx 的 updateWindowWidth 即可
          // 因为这里拿不到 settings（或者拿到了也可能有延迟），所以使用一个初始值
          const xPos = monitorWidth - logicalWidth;
          const yPos = 0;

          await win.setSize(new LogicalSize(logicalWidth, logicalHeight));
          await win.setPosition(new LogicalPosition(xPos, yPos));
        }

        // 监听后端发来的动画触发事件
        const unlistenShow = await listen(FORCE_SHOW_ANIMATION, () => {
          setIsVisible(true);
        });
        if (isMounted) unlisteners.push(unlistenShow); else unlistenShow();

        const unlistenHide = await listen(FORCE_HIDE_ANIMATION, () => {
          setIsVisible(false);
        });
        if (isMounted) unlisteners.push(unlistenHide); else unlistenHide();
        
        // 监听来自后端的 Toggle 事件（脱离底层查询）
        const unlistenToggle = await listen(TOGGLE_VISIBILITY, () => {
          setIsVisible((prev) => {
            if (prev) {
              tauriApi.hideWindow();
              return false;
            } else {
              return true;
            }
          });
        });
        if (isMounted) unlisteners.push(unlistenToggle); else unlistenToggle();

      } catch (error) {
        console.error("Failed to setup Tauri window and events:", error);
      }
    };

    setupWindow();

    return () => {
      isMounted = false;
      unlisteners.forEach(fn => fn());
    };
  }, [setIsVisible]);

  // 全局快捷键注册与处理
  const currentShortcutRef = useRef<string | null>(null);
  const isRecordingShortcut = useUIStore(state => state.isRecordingShortcut);

  useEffect(() => {
    let isActive = true;

    const setupShortcut = async () => {
      try {
        if (isRecordingShortcut) {
          try {
            await tauriApi.unregisterAllShortcuts();
          } catch (e) {
            console.warn("Unregister all shortcuts failed:", e);
          }
          currentShortcutRef.current = null;
          return;
        }

        // 先注销所有旧快捷键
        try {
          await tauriApi.unregisterAllShortcuts();
        } catch (e) {
          console.warn("Unregister all shortcuts failed:", e);
        }

        if (!isActive) return;

        // 注册新快捷键
        const finalSummonShortcut = summonShortcut || 'Alt+Space';
        const finalSummonMouseShortcut = summonMouseShortcut || 'Mouse4';

        if (finalSummonShortcut) {
          await tauriApi.registerShortcut(finalSummonShortcut);
        }
        if (finalSummonMouseShortcut) {
          await tauriApi.registerShortcut(finalSummonMouseShortcut);
        }
        
        if (isActive) {
          currentShortcutRef.current = `${finalSummonShortcut}|${finalSummonMouseShortcut}`;
        } else {
          // 如果注册完成后发现组件已经卸载/依赖已变，就立刻注销刚才注册的
          await tauriApi.unregisterAllShortcuts();
        }
      } catch (e) {
        console.error("Failed to register shortcut:", e);
      }
    };

    setupShortcut();

    return () => {
      isActive = false;
      if (currentShortcutRef.current) {
        tauriApi.unregisterAllShortcuts().catch(e => {
          console.error("Failed to unregister shortcut on cleanup:", e);
        });
        currentShortcutRef.current = null;
      }
    };
  }, [summonShortcut, summonMouseShortcut, isRecordingShortcut]);
}
