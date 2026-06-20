import { useCallback, useRef } from "react";
import { DragStartEvent, DragOverEvent, DragEndEvent } from "@dnd-kit/core";
import { arrayMove } from "@dnd-kit/sortable";
import { useDataStore } from "../store/useDataStore";
import { useUIStore } from "../store/useUIStore";
import { LaunchItem, Tab } from "../types";

export function useGlobalDragAndDrop() {
  const originalApps = useRef<LaunchItem[]>([]);
  const originalLeftTabs = useRef<Tab[]>([]);

  const handleDragStart = useCallback((_event: DragStartEvent) => {
    originalApps.current = useDataStore.getState().apps;
    originalLeftTabs.current = useDataStore.getState().settings.leftTabs || [];
    useUIStore.getState().setIsDragging(true);
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);
    
    const { activeLeftTab, activeTopTab, setActiveLeftTab, setActiveTopTab } = useUIStore.getState();
    const { apps, setApps, settings } = useDataStore.getState();
    const topTabs = settings.topTabs || {};

    if (activeId.startsWith('item-')) {
      const appId = activeId.replace('item-', '');
      const appIndex = apps.findIndex(a => a.id === appId);
      if (appIndex === -1) return;

      if (overId.startsWith('leftTab-')) {
        const targetTabId = overId.replace('leftTab-', '');
        if (targetTabId !== activeLeftTab) {
          setActiveLeftTab(targetTabId);
          setApps((prev) => {
            const newApps = [...prev];
            const app = { ...newApps[appIndex], categoryId: targetTabId };
            const targetTopTabs = topTabs[targetTabId] || [];
            if (targetTopTabs.length > 0 && !targetTopTabs.some((t: Tab) => t.id === app.columnId)) {
                app.columnId = targetTopTabs[0].id;
                setActiveTopTab(app.columnId as string);
              } else {
                setActiveTopTab((app.columnId as string) || '');
              }
            newApps[appIndex] = app;
            return newApps;
          });
        }
      } else if (overId.startsWith('topTab-')) {
        const targetTopTabId = overId.replace('topTab-', '');
        if (targetTopTabId !== activeTopTab) {
          setActiveTopTab(targetTopTabId);
          setApps((prev) => {
            const newApps = [...prev];
            newApps[appIndex] = { ...newApps[appIndex], columnId: targetTopTabId };
            return newApps;
          });
        }
      }
    }
  }, []);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    useUIStore.getState().setIsDragging(false);
    
    const { active, over } = event;
    if (!over) {
      // 恢复原状
      useDataStore.getState().setApps(originalApps.current);
      useDataStore.getState().updateSetting('leftTabs', originalLeftTabs.current);
      return;
    }

    const activeId = String(active.id);
    const overId = String(over.id);

    const { activeLeftTab, activeTopTab } = useUIStore.getState();
    const { apps, setApps, updateSetting, settings } = useDataStore.getState();
    const leftTabs = settings.leftTabs || [];

    if (activeId.startsWith('item-')) {
      const activeAppId = activeId.replace('item-', '');
      
      const filteredApps = apps.filter(
        (app: LaunchItem) => app.categoryId === activeLeftTab && app.columnId === activeTopTab
      );
      
      let newFilteredApps = [...filteredApps];
      
      if (overId.startsWith('item-')) {
        const overAppId = overId.replace('item-', '');
        const oldIndex = filteredApps.findIndex((app: LaunchItem) => app.id === activeAppId);
        const newIndex = filteredApps.findIndex((app: LaunchItem) => app.id === overAppId);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          newFilteredApps = arrayMove(filteredApps, oldIndex, newIndex);
        }
      }

      setApps((prev: LaunchItem[]) => {
        const otherApps = prev.filter(
          (app: LaunchItem) => app.categoryId !== activeLeftTab || app.columnId !== activeTopTab
        );
        return [...otherApps, ...newFilteredApps];
      });

    } else if (activeId.startsWith('leftTab-')) {
      const activeTabId = activeId.replace('leftTab-', '');
      const overTabId = overId.replace('leftTab-', '');
      
      if (activeId !== overId) {
        const oldIndex = leftTabs.findIndex((t: Tab) => t.id === activeTabId);
        const newIndex = leftTabs.findIndex((t: Tab) => t.id === overTabId);
        if (oldIndex !== -1 && newIndex !== -1) {
          updateSetting('leftTabs', arrayMove(leftTabs, oldIndex, newIndex));
        }
      }
    }
  }, []);

  const handleDragCancel = useCallback(() => {
    useUIStore.getState().setIsDragging(false);
    useDataStore.getState().setApps(originalApps.current);
    useDataStore.getState().updateSetting('leftTabs', originalLeftTabs.current);
  }, []);

  return {
    handleDragStart,
    handleDragOver,
    handleDragEnd,
    handleDragCancel,
  };
}