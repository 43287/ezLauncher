import { useState, useEffect } from "react";
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
  const { openAddApp, openSystemApp } = useModalStore();

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
    null,
    topTabs[activeLeftTab] || [],
    activeTopTab,
    setActiveTopTab,
    leftTabs,
    activeLeftTab,
    setActiveLeftTab,
  );

  return (
    <div
      className="h-screen w-screen bg-transparent overflow-hidden"
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
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

      <AppModals />
      <GlobalContextMenu />
    </div>
  );
}

export default App;
