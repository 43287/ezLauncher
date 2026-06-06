import { useEffect, useRef } from 'react';
import { getCurrentWindow, currentMonitor, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { tauriApi } from "../api/tauri";
import { FORCE_HIDE_ANIMATION, FORCE_SHOW_ANIMATION } from "../constants/events";
import { useAppStore } from '../store/useAppStore';

export function useTauriEvents(setIsVisible: (visible: boolean) => void, summonShortcut: string) {
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
          const logicalWidth = Math.min(400, monitorWidth); // 抽屉宽度响应式
          const logicalHeight = monitor.size.height / scaleFactor;

          // 吸附在屏幕右侧，占据全高
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
  const isRecordingShortcut = useAppStore(state => state.isRecordingShortcut);

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
        await tauriApi.registerShortcut(summonShortcut);
        
        if (isActive) {
          currentShortcutRef.current = summonShortcut;
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
  }, [summonShortcut, isRecordingShortcut]);
}
