import { useEffect } from 'react';
import { getCurrentWindow, currentMonitor, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";

export function useTauriEvents(setIsVisible: (visible: boolean) => void) {
  useEffect(() => {
    let unlisteners: (() => void)[] = [];
    let isMounted = true;

    const setupWindow = async () => {
      try {
        const win = getCurrentWindow();
        const monitor = await currentMonitor();
        
        if (monitor) {
          const scaleFactor = monitor.scaleFactor;
          const logicalWidth = 400; // 抽屉宽度
          const logicalHeight = monitor.size.height / scaleFactor;
          
          // 吸附在屏幕右侧，占据全高
          const xPos = monitor.size.width / scaleFactor - logicalWidth;
          const yPos = 0;
          
          await win.setSize(new LogicalSize(logicalWidth, logicalHeight));
          await win.setPosition(new LogicalPosition(xPos, yPos));
        }

        // 监听后端发来的动画触发事件
        const unlistenShow = await listen("force_show_animation", () => {
          setIsVisible(true);
        });
        if (isMounted) unlisteners.push(unlistenShow); else unlistenShow();

        const unlistenHide = await listen("force_hide_animation", () => {
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
}
