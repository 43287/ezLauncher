import React, { useCallback, useMemo, useState, useEffect, useRef } from "react";
import { ShortcutItem } from "./ShortcutItem";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

import { useDataStore } from "../store/useDataStore";
import { useUIStore } from "../store/useUIStore";
import { useGlobalDrag } from "../hooks/useGlobalDrag";
import { useGridNavigation } from "../hooks/useGridNavigation";

interface AppGridProps {
}

/**
 * 应用网格组件，支持拖拽添加应用
 */
export const AppGrid: React.FC<AppGridProps> = () => {
  const apps = useDataStore((state) => state.apps);
  const settings = useDataStore((state) => state.settings);
  const activeLeftTab = useUIStore((state) => state.activeLeftTab);
  const activeTopTab = useUIStore((state) => state.activeTopTab);
  const focusedAppId = useUIStore((state) => state.focusedAppId);

  const filteredApps = useMemo(() => {
    return apps.filter(
      (app) => app.categoryId === activeLeftTab && app.columnId === activeTopTab
    );
  }, [apps, activeLeftTab, activeTopTab]);

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  const handleSetIsDraggingFile = useCallback(
    (dragging: boolean) => setIsDraggingFile(dragging),
    [],
  );
  const handleSetHoveredItemId = useCallback(
    (id: string | null) => setHoveredItemId(id),
    [],
  );

  useGlobalDrag(handleSetIsDraggingFile, handleSetHoveredItemId);

  const { handleKeyDown: handleGridNav } = useGridNavigation();
  const gridRef = useRef<HTMLDivElement>(null);

  // 使得容器可以接收键盘事件
  useEffect(() => {
    if (gridRef.current) {
      gridRef.current.focus();
    }
  }, [activeLeftTab, activeTopTab]);

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && focusedAppId) {
      e.preventDefault();
      // 模拟双击事件以启动应用
      const el = document.querySelector(`[data-app-id="${focusedAppId}"]`);
      if (el) {
        const event = new MouseEvent('dblclick', {
          bubbles: true,
          cancelable: true,
          view: window
        });
        el.dispatchEvent(event);
      }
      return;
    }
    handleGridNav(e);
  };

  return (
      <div
        ref={gridRef}
        tabIndex={0}
        onKeyDown={handleKeyDown}
        className={`h-full w-full rounded-2xl transition-all duration-300 apple-ease flex-1 outline-none ${
          isDraggingFile
            ? hoveredItemId 
              ? "bg-transparent border-2 border-transparent" // Item hovered, no global highlight
              : "bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-400"
            : "bg-transparent border-2 border-transparent"
        } ${filteredApps.length === 0 ? '' : 'p-2'}`}
        role="region"
        aria-label="应用快捷方式网格，支持拖拽文件添加"
        aria-live="polite"
      >
        {filteredApps.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-4">
          <div className="text-4xl">📁</div>
          <p className="text-sm font-medium">拖拽应用程序（.exe）到此处</p>
        </div>
      ) : (
          <SortableContext
            items={filteredApps.map(app => `item-${app.id}`)}
            strategy={rectSortingStrategy}
          >
            <div 
              className="grid gap-1 items-start content-start justify-center" 
              style={{ gridTemplateColumns: `repeat(${settings.columns || 4}, 80px)` }}
            >
              {filteredApps.map((app) => (
                <ShortcutItem
                  key={app.id}
                  app={app}
                  isHovered={hoveredItemId === app.id}
                />
              ))}
            </div>
          </SortableContext>
      )}
    </div>
  );
};
