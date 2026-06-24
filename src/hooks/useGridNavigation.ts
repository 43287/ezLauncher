import { useCallback, type KeyboardEvent } from 'react';
import { useDataStore } from '../store/useDataStore';
import { useUIStore } from '../store/useUIStore';

export function useGridNavigation() {
  const { apps, settings } = useDataStore();
  const { activeLeftTab, activeTopTab, focusedAppId, setFocusedAppId } = useUIStore();

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // 仅处理方向键和回车键
    if (!['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Enter'].includes(e.key)) {
      return;
    }

    const currentApps = apps.filter(
      app => app.categoryId === activeLeftTab && app.columnId === activeTopTab
    );

    if (currentApps.length === 0) return;

    const columns = settings.columns || 4;
    const currentIndex = focusedAppId 
      ? currentApps.findIndex(app => app.id === focusedAppId) 
      : -1;

    let nextIndex = currentIndex;

    if (e.key === 'Enter') {
      if (currentIndex !== -1) {
        // 阻止默认行为（例如表单提交等）
        e.preventDefault();
        // 获取对应的 DOM 元素并触发双击事件来启动（为了复用 ShortcutItem 中的逻辑）
        // 或者直接在这里调用 platform.launchApp。为了保持一致性，我们在 AppGrid 层面监听 Enter 键，
        // 在 hook 里只是返回指示。因此我们在外层处理 Enter。
        return;
      }
    }

    if (currentIndex === -1) {
      // 第一次按方向键，选中第一个
      nextIndex = 0;
    } else {
      switch (e.key) {
        case 'ArrowLeft':
          nextIndex = currentIndex > 0 ? currentIndex - 1 : currentIndex;
          break;
        case 'ArrowRight':
          nextIndex = currentIndex < currentApps.length - 1 ? currentIndex + 1 : currentIndex;
          break;
        case 'ArrowUp':
          nextIndex = currentIndex >= columns ? currentIndex - columns : currentIndex;
          break;
        case 'ArrowDown':
          nextIndex = currentIndex + columns < currentApps.length ? currentIndex + columns : currentIndex;
          break;
      }
    }

    if (nextIndex !== currentIndex) {
      e.preventDefault(); // 阻止页面滚动
      setFocusedAppId(currentApps[nextIndex].id);
      
      // 尝试让 DOM 元素也滚动入视野（仅在元素不可见时触发，避免不必要的重排）
      setTimeout(() => {
        const el = document.querySelector(`[data-app-id="${currentApps[nextIndex].id}"]`);
        if (el) {
          const container = el.closest('.overflow-y-auto');
          if (container) {
            const cRect = container.getBoundingClientRect();
            const eRect = el.getBoundingClientRect();
            const isVisible = eRect.top >= cRect.top && eRect.bottom <= cRect.bottom;
            if (!isVisible) {
              el.scrollIntoView({ behavior: 'instant', block: 'nearest' });
            }
          } else {
            el.scrollIntoView({ behavior: 'instant', block: 'nearest' });
          }
        }
      }, 0);
    }
  }, [apps, activeLeftTab, activeTopTab, focusedAppId, settings.columns, setFocusedAppId]);

  return { handleKeyDown };
}