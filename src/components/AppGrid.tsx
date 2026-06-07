import React, { useCallback, useMemo, useState } from "react";
import { LaunchItem } from "../types";
import { ShortcutItem } from "./ShortcutItem";
import {
  SortableContext,
  rectSortingStrategy,
} from "@dnd-kit/sortable";

import { useSettings } from "../hooks/useSettings";
import { useAppStore } from "../store/useAppStore";
import { useGlobalDrag } from "../hooks/useGlobalDrag";

interface AppGridProps {
}

/**
 * 应用网格组件，支持拖拽添加应用
 */
export const AppGrid: React.FC<AppGridProps> = () => {
  const { settings } = useSettings();
  const columns = parseInt(String(settings.columns || '4'), 10) || 4;

  const apps = useAppStore((state) => state.apps);
  const activeLeftTab = useAppStore((state) => state.activeLeftTab);
  const activeTopTab = useAppStore((state) => state.activeTopTab);

  const appsByCat = useMemo(() => {
    return apps.reduce(
      (acc, app) => {
        const catId = app.categoryId || "";
        if (!acc[catId]) acc[catId] = [];
        acc[catId].push(app);
        return acc;
      },
      {} as Record<string, LaunchItem[]>,
    );
  }, [apps]);

  const filteredApps = useMemo(() => {
    return (appsByCat[activeLeftTab] || []).filter(
      (app) => app.columnId === activeTopTab,
    );
  }, [appsByCat, activeLeftTab, activeTopTab]);

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

  return (
      <div
        className={`h-full w-full rounded-2xl transition-all duration-300 apple-ease flex-1 ${
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
              className="grid gap-2 items-start content-start" 
              style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
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
