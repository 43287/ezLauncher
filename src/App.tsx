import { useState, useEffect, useRef, useMemo } from "react";
import { AppGrid } from "./components/AppGrid";
import { LaunchItem, Tab } from "./types";
import { CustomTitlebar } from "./components/CustomTitlebar";
import { SettingsWindow } from "./components/SettingsWindow";
import { PropertiesModal } from "./components/PropertiesModal";
import { useSettings } from "./hooks/useSettings";
import { useAppStore } from "./store/useAppStore";
import { useContextMenuStore } from "./store/useContextMenuStore";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { GlobalContextMenu } from "./components/layout/GlobalContextMenu";
import { useTauriEvents } from "./hooks/useTauriEvents";
import { useGlobalDrag } from "./hooks/useGlobalDrag";
import { useWheelNavigation } from "./hooks/useWheelNavigation";
import "./App.css";

function App() {
  const { settings, updateSetting, isLoaded } = useSettings();
  const [hasInitialized, setHasInitialized] = useState(false);

  const { apps, setApps, leftTabs, setLeftTabs, topTabs, setTopTabs, activeLeftTab, setActiveLeftTab, activeTopTab, setActiveTopTab, addApp, removeApp, updateApp } = useAppStore();
  const { openMenu } = useContextMenuStore();

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    if (isLoaded && !hasInitialized) {
      if (settings.apps) setApps(settings.apps as LaunchItem[]);
      if (settings.leftTabs) setLeftTabs(settings.leftTabs as Tab[]);
      if (settings.topTabs) setTopTabs(settings.topTabs as Tab[]);
      setHasInitialized(true);
    }
  }, [isLoaded, hasInitialized, settings, setApps, setLeftTabs, setTopTabs]);

  useEffect(() => {
    if (!hasInitialized) return;
    
    const unsubscribe = useAppStore.subscribe((state, prevState) => {
      if (state.apps !== prevState.apps) {
        updateSetting('apps', state.apps);
      }
      if (state.leftTabs !== prevState.leftTabs) {
        updateSetting('leftTabs', state.leftTabs);
      }
      if (state.topTabs !== prevState.topTabs) {
        updateSetting('topTabs', state.topTabs);
      }
    });

    return () => unsubscribe();
  }, [hasInitialized, updateSetting]);

  const activeTabsRef = useRef({ left: activeLeftTab, top: activeTopTab });
  useEffect(() => {
    activeTabsRef.current = { left: activeLeftTab, top: activeTopTab };
  }, [activeLeftTab, activeTopTab]);

  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<LaunchItem | null>(null);
  const [isAddingApp, setIsAddingApp] = useState(false);
  const [addingAppType, setAddingAppType] = useState<LaunchItem['type']>('app');

  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [hoveredItemId, setHoveredItemId] = useState<string | null>(null);

  useTauriEvents(setIsVisible);
  useGlobalDrag(setIsDraggingFile, setHoveredItemId);

  const handleAppAdd = (newApp: LaunchItem) => {
    addApp(newApp);
  };

  const handleAppRemove = (id: string) => {
    removeApp(id);
  };

  const { handleWheel } = useWheelNavigation(
    null,
    topTabs,
    activeTopTab,
    setActiveTopTab,
    leftTabs,
    activeLeftTab,
    setActiveLeftTab
  );

  const appsByCat = useMemo(() => {
    return apps.reduce((acc, app) => {
      const catId = app.categoryId || '';
      if (!acc[catId]) acc[catId] = [];
      acc[catId].push(app);
      return acc;
    }, {} as Record<string, LaunchItem[]>);
  }, [apps]);

  const filteredApps = useMemo(() => {
    return (appsByCat[activeLeftTab] || []).filter(app => app.columnId === activeTopTab);
  }, [appsByCat, activeLeftTab, activeTopTab]);

  return (
    <div 
      className="h-screen w-screen bg-transparent overflow-hidden"
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <div 
        className={`flex flex-col h-full bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl shadow-soft-lg transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <CustomTitlebar />
        <div className="flex flex-1 overflow-hidden" data-tauri-drag-region>
          <main className="flex-1 flex flex-col bg-transparent" data-tauri-drag-region>
            <TopBar />

            <div 
              className="flex-1 p-4 overflow-y-auto text-gray-900 dark:text-gray-100 relative h-full w-full"
              onContextMenu={(e) => {
                e.preventDefault();
                e.stopPropagation();
                const x = Math.min(e.clientX, window.innerWidth - 100);
                const y = Math.min(e.clientY, window.innerHeight - 200); 
                openMenu([
                  {
                    label: "添加",
                    children: [
                      { label: "可执行程序", onClick: () => { setAddingAppType('app'); setIsAddingApp(true); } },
                      { label: "网页链接", onClick: () => { setAddingAppType('link'); setIsAddingApp(true); } },
                      { label: "系统程序", onClick: () => { setAddingAppType('app'); setIsAddingApp(true); } },
                      { label: "脚本", onClick: () => { setAddingAppType('app'); setIsAddingApp(true); } },
                      { label: "pwsh/cmd命令", onClick: () => { setAddingAppType('app'); setIsAddingApp(true); } }
                    ]
                  },
                  {
                    label: "添加分隔符",
                    onClick: () => {
                      const newApp: LaunchItem = { id: Date.now().toString(), name: "分隔符", type: "separator", shortcut: null, categoryId: activeLeftTab, columnId: activeTopTab };
                      handleAppAdd(newApp);
                    }
                  }
                ], x, y);
              }}
            >
              <AppGrid 
                apps={filteredApps} 
                isDraggingFile={isDraggingFile}
                hoveredItemId={hoveredItemId}
                onAppRemove={handleAppRemove} 
                onAppReorder={(newFilteredApps) => {
                  setApps((prev: LaunchItem[]) => {
                    const otherApps = prev.filter(app => app.categoryId !== activeLeftTab || app.columnId !== activeTopTab);
                    return [...otherApps, ...newFilteredApps];
                  });
                }}
                onAppRename={(id, newName) => {
                  updateApp(id, { name: newName });
                }}
                onEditProperties={(app) => {
                  setEditingApp(app);
                }}
              />
            </div>
          </main>
          
          <Sidebar onOpenSettings={() => setIsSettingsOpen(true)} />
        </div>
      </div>

      {isSettingsOpen && (
        <SettingsWindow onClose={() => setIsSettingsOpen(false)} />
      )}

      {editingApp && (
        <PropertiesModal
          app={editingApp}
          onClose={() => setEditingApp(null)}
          onSave={(updatedApp) => {
            updateApp(updatedApp.id, updatedApp);
            setEditingApp(null);
          }}
        />
      )}

      {isAddingApp && (
        <PropertiesModal
          app={{ id: Date.now().toString(), name: "新建快捷方式", type: addingAppType, shortcut: null }}
          onClose={() => setIsAddingApp(false)}
          onSave={(newApp) => {
            handleAppAdd(newApp);
            setIsAddingApp(false);
          }}
        />
      )}

      <GlobalContextMenu />
    </div>
  );
}

export default App;
