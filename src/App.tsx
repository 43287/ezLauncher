import { useState, useEffect, useCallback, useRef } from "react";
import { AppGrid } from "./components/AppGrid";
import { LaunchItem, Tab } from "./types";
import { CustomTitlebar } from "./components/CustomTitlebar";
import { useSettings } from "./hooks/useSettings";
import { useStoreSync } from "./hooks/useStoreSync";
import { useAppStore } from "./store/useAppStore";
import { useContextMenuStore } from "./store/useContextMenuStore";
import { useModalStore } from "./store/useModalStore";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { GlobalContextMenu } from "./components/layout/GlobalContextMenu";
import { AppModals } from "./components/AppModals";
import { useTauriEvents } from "./hooks/useTauriEvents";
import { useWheelNavigation } from "./hooks/useWheelNavigation";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragStartEvent,
  DragOverEvent,
  DragEndEvent,
  DragCancelEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  sortableKeyboardCoordinates,
} from "@dnd-kit/sortable";
import "./App.css";

function App() {
  const { settings, updateSetting, isLoaded } = useSettings();
  const [hasInitialized, setHasInitialized] = useState(false);

  const setApps = useAppStore((state) => state.setApps);
  const leftTabs = useAppStore((state) => state.leftTabs);
  const setLeftTabs = useAppStore((state) => state.setLeftTabs);
  const topTabs = useAppStore((state) => state.topTabs);
  const setTopTabs = useAppStore((state) => state.setTopTabs);
  const activeLeftTab = useAppStore((state) => state.activeLeftTab);
  const setActiveLeftTab = useAppStore((state) => state.setActiveLeftTab);
  const activeTopTab = useAppStore((state) => state.activeTopTab);
  const setActiveTopTab = useAppStore((state) => state.setActiveTopTab);
  const addApp = useAppStore((state) => state.addApp);

  const { openMenu } = useContextMenuStore();
  const { 
    openAddApp, 
    openSystemApp,
    isSettingsOpen,
    editingApp,
    isAddingApp,
    isSystemAppOpen
  } = useModalStore();

  const isAnyModalOpen = isSettingsOpen || editingApp !== null || isAddingApp || isSystemAppOpen;

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isLoaded && !hasInitialized) {
      if (settings.apps) setApps(settings.apps as unknown as LaunchItem[]);
      if (settings.leftTabs) setLeftTabs(settings.leftTabs as unknown as Tab[]);
      if (settings.topTabs) {
        if (Array.isArray(settings.topTabs)) {
          // migrate array to dictionary based on current activeLeftTab (or default '2' if not available)
          const currentLeftTab = (settings.activeLeftTab as string) || activeLeftTab || '2';
          setTopTabs({ [currentLeftTab]: settings.topTabs as unknown as Tab[] });
        } else {
          setTopTabs(settings.topTabs as unknown as Record<string, Tab[]>);
        }
      }
      setHasInitialized(true);
    }
  }, [isLoaded, hasInitialized, settings, setApps, setLeftTabs, setTopTabs, activeLeftTab]);

  useStoreSync(updateSetting, hasInitialized);

  useTauriEvents(setIsVisible, (settings.summonShortcut as string) || 'Alt+Space');

  const { handleWheel } = useWheelNavigation(
    isAnyModalOpen,
    topTabs[activeLeftTab] || [],
    activeTopTab,
    setActiveTopTab,
    leftTabs,
    activeLeftTab,
    setActiveLeftTab,
  );

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const originalApps = useRef<LaunchItem[]>([]);
  const originalLeftTabs = useRef<Tab[]>([]);

  const handleDragStart = useCallback((_event: DragStartEvent) => {
    originalApps.current = useAppStore.getState().apps;
    originalLeftTabs.current = useAppStore.getState().leftTabs;
  }, []);

  const handleDragOver = useCallback((event: DragOverEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('item-')) {
      const appId = activeId.replace('item-', '');
      const appIndex = useAppStore.getState().apps.findIndex(a => a.id === appId);
      if (appIndex === -1) return;

      if (overId.startsWith('leftTab-')) {
        const targetTabId = overId.replace('leftTab-', '');
        if (targetTabId !== activeLeftTab) {
          setActiveLeftTab(targetTabId);
          // 移动该 app 到新的分类，使其保持挂载状态
          setApps((prev) => {
            const newApps = [...prev];
            const app = { ...newApps[appIndex], categoryId: targetTabId };
            // 如果新分类下没有该 column，可能需要重置为第一个或者默认的
            const targetTopTabs = topTabs[targetTabId] || [];
            if (targetTopTabs.length > 0 && !targetTopTabs.some(t => t.id === app.columnId)) {
              app.columnId = targetTopTabs[0].id;
              setActiveTopTab(app.columnId);
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
  }, [activeLeftTab, activeTopTab, setActiveLeftTab, setActiveTopTab, setApps, topTabs]);

  const handleDragEnd = useCallback((event: DragEndEvent) => {
    const { active, over } = event;
    if (!over) return;

    const activeId = String(active.id);
    const overId = String(over.id);

    if (activeId.startsWith('item-')) {
      const activeAppId = activeId.replace('item-', '');
      
      // Get the final current apps in current tab
      const currentApps = useAppStore.getState().apps;
      const filteredApps = currentApps.filter(
        app => app.categoryId === activeLeftTab && app.columnId === activeTopTab
      );
      
      let newFilteredApps = [...filteredApps];
      
      if (overId.startsWith('item-')) {
        const overAppId = overId.replace('item-', '');
        const oldIndex = filteredApps.findIndex(app => app.id === activeAppId);
        const newIndex = filteredApps.findIndex(app => app.id === overAppId);
        if (oldIndex !== -1 && newIndex !== -1 && oldIndex !== newIndex) {
          newFilteredApps = arrayMove(filteredApps, oldIndex, newIndex);
        }
      } else if (overId.startsWith('leftTab-') || overId.startsWith('topTab-')) {
        // Drag over a tab finishes. The item is already moved in onDragOver and placed at the end of the filtered list.
        // We just need to ensure it's saved. No arrayMove needed unless we want to put it at a specific index.
      }

      setApps((prev) => {
        const otherApps = prev.filter(
          app => app.categoryId !== activeLeftTab || app.columnId !== activeTopTab
        );
        return [...otherApps, ...newFilteredApps];
      });

    } else if (activeId.startsWith('leftTab-') && overId.startsWith('leftTab-')) {
      const activeTabId = activeId.replace('leftTab-', '');
      const overTabId = overId.replace('leftTab-', '');
      
      if (activeTabId !== overTabId) {
        setLeftTabs((items) => {
          const oldIndex = items.findIndex(t => t.id === activeTabId);
          const newIndex = items.findIndex(t => t.id === overTabId);
          return arrayMove(items, oldIndex, newIndex);
        });
      }
    }
  }, [activeLeftTab, activeTopTab, setApps, setLeftTabs]);

  const handleDragCancel = useCallback((_event: DragCancelEvent) => {
    setApps(originalApps.current);
    setLeftTabs(originalLeftTabs.current);
  }, [setApps, setLeftTabs]);

  return (
    <div
      className="h-screen w-screen bg-transparent overflow-hidden"
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <DndContext
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragStart={handleDragStart}
        onDragOver={handleDragOver}
        onDragEnd={handleDragEnd}
        onDragCancel={handleDragCancel}
      >
        <div
        className={`flex flex-col h-full bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl shadow-soft-lg transition-transform duration-300 ease-in-out ${
          isVisible ? "translate-x-0" : "translate-x-full"
        }`}
      >
        <CustomTitlebar />
        <div className="flex flex-1 overflow-hidden" data-tauri-drag-region>
          <main
            className="flex-1 flex flex-col bg-transparent"
            data-tauri-drag-region
          >
            <TopBar />

            <div
              className="flex-1 p-4 overflow-y-auto text-gray-900 dark:text-gray-100 relative h-full w-full"
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const x = Math.min(e.clientX, window.innerWidth - 100);
                const y = Math.min(e.clientY, window.innerHeight - 200);
                openMenu(
                  [
                    {
                      label: "添加",
                      children: [
                        {
                          label: "可执行程序",
                          onClick: () => openAddApp("app"),
                        },
                        {
                          label: "网页链接",
                          onClick: () => openAddApp("link"),
                        },
                        { label: "系统程序", onClick: () => openSystemApp() },
                        { label: "脚本", onClick: () => openAddApp("script") },
                        {
                          label: "命令",
                          onClick: () => openAddApp("command"),
                        },
                      ],
                    },
                    {
                      label: "添加分隔符",
                      onClick: () => {
                        const newApp: LaunchItem = {
                          id: Date.now().toString(),
                          name: "分隔符",
                          type: "separator",
                          shortcut: null,
                          categoryId: activeLeftTab,
                          columnId: activeTopTab,
                        };
                        addApp(newApp);
                      },
                    },
                  ],
                  x,
                  y,
                );
              }}
            >
              <AppGrid />
            </div>
          </main>

          <Sidebar />
        </div>
      </div>
      </DndContext>

      <AppModals />
      <GlobalContextMenu />
    </div>
  );
}

export default App;
