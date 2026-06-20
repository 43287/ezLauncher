import { useState, useEffect } from "react";
import { AppGrid } from "./components/AppGrid";
import { CustomTitlebar } from "./components/CustomTitlebar";
import { useDataStore } from "./store/useDataStore";
import { useUIStore } from "./store/useUIStore";
import { useModalStore } from "./store/useModalStore";
import { Sidebar } from "./components/layout/Sidebar";
import { TopBar } from "./components/layout/TopBar";
import { GlobalContextMenu } from "./components/layout/GlobalContextMenu";
import { AppModals } from "./components/AppModals";
import { ToastContainer } from "./components/ToastContainer";
import { useTauriEvents } from "./hooks/useTauriEvents";
import { useWheelNavigation } from "./hooks/useWheelNavigation";
import { useGlobalShortcuts } from "./hooks/useGlobalShortcuts";
import { useGlobalContextMenu } from "./hooks/useGlobalContextMenu";
import { DragDropProvider } from "./components/providers/DragDropProvider";
import { tauriApi } from "./api/tauri";
import "./App.css";

function App() {
  const { settings, setSettings, setApps, isLoaded, setIsLoaded } = useDataStore();
  const [showRecovery, setShowRecovery] = useState(false);
  const [recoveryMessage, setRecoveryMessage] = useState("");

  const activeLeftTab = useUIStore((state) => state.activeLeftTab);
  const setActiveLeftTab = useUIStore((state) => state.setActiveLeftTab);
  const activeTopTab = useUIStore((state) => state.activeTopTab);
  const setActiveTopTab = useUIStore((state) => state.setActiveTopTab);

  const { 
    isSettingsOpen,
    editingApp,
    isAddingApp,
    isSystemAppOpen
  } = useModalStore();

  const { handleContextMenu } = useGlobalContextMenu();

  const isAnyModalOpen = isSettingsOpen || editingApp !== null || isAddingApp || isSystemAppOpen || showRecovery;

  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    let isMounted = true;
    
    async function initializeStore() {
      if (isLoaded || showRecovery) return;
      
      try {
        const portableFlag = localStorage.getItem('portable_mode') !== 'false';
        
        // 1. 尝试加载并解析 Settings
        const settingsJsonStr = await tauriApi.loadSettings(portableFlag);
        const parsedSettings = JSON.parse(settingsJsonStr);
        // 通过 useDataStore 的默认合并机制自动兼容新增字段
        if (isMounted) setSettings({ ...settings, ...parsedSettings });

        // 2. 尝试加载并解析 Apps
        const appsJsonStr = await tauriApi.loadApps(portableFlag);
        const parsedApps = JSON.parse(appsJsonStr);
        if (isMounted) setApps(parsedApps);

        if (isMounted) setIsLoaded(true);
      } catch (err: any) {
        console.error('Initialization failed:', err);
        if (err.toString().includes('ParseError') || err.toString().includes('PARSE_ERROR') || err.toString().includes('SyntaxError')) {
          if (isMounted) {
            setRecoveryMessage(err.toString());
            setShowRecovery(true);
          }
        } else {
          // 非解析错误（可能只是初始空文件），放行
          if (isMounted) setIsLoaded(true);
        }
      }
    }

    initializeStore();
    
    return () => {
      isMounted = false;
    };
  }, []);

  const handleRestoreBackup = async () => {
    try {
      const portableFlag = localStorage.getItem('portable_mode') !== 'false';
      await tauriApi.restoreFromBackup(portableFlag);
      window.location.reload(); // 重载页面以重新触发初始化流程
    } catch (err) {
      alert("恢复失败：" + err);
    }
  };

  useTauriEvents(setIsVisible, isVisible, settings.summonShortcut, settings.summonMouseShortcut || undefined);
  useGlobalShortcuts(isVisible);

  // 根据 dockPosition 决定 flex 的排列方向
  const isLeftDock = settings.dockPosition === 'left';
  const flexDirectionClass = isLeftDock ? "flex-row-reverse" : "flex-row";
  
  // 根据 dockPosition 决定动画的滑入滑出方向
  const translateClass = isVisible 
    ? "translate-x-0" 
    : (isLeftDock ? "-translate-x-full" : "translate-x-full");

  // 根据列数动态计算宽度
  const columns = settings.columns || 4;
  // 精确计算紧凑模式：
  // 每个 ShortcutItem 的最大宽度调整为 80px (w-full max-w-[80px])
  // 网格 gap 保持 1 (0.25rem = 4px)
  // columns 个格子需要 columns * 80 的宽度
  // (columns - 1) 个 gap 需要 (columns - 1) * 4 的宽度
  // AppGrid 容器的 padding 缩小为 p-2 (0.5rem = 8px)，左右总共 16px
  // 加上 Sidebar 约 56px (w-14)
  // 再加上 16px 专门用于预留 Windows 纵向滚动条的宽度，防止内容溢出
  const gridContainerWidth = (columns * 80) + ((columns - 1) * 4) + 16 + 16;
  const totalWindowWidth = gridContainerWidth + 56; // 主内容 + Sidebar

  useEffect(() => {
    if (isLoaded) {
      tauriApi.updateWindowWidth(totalWindowWidth, settings.dockPosition === 'left').catch(console.error);
    }
  }, [isLoaded, totalWindowWidth, settings.dockPosition]);

  // 当窗口首次可见时，确保调用一次 updateWindowWidth 来调整到最新设置的位置
  useEffect(() => {
    if (isVisible && isLoaded) {
        tauriApi.updateWindowWidth(totalWindowWidth, settings.dockPosition === 'left').catch(console.error);
    }
  }, [isVisible, isLoaded]);

  const { handleWheel } = useWheelNavigation(
    isAnyModalOpen,
    (settings.topTabs || {})[activeLeftTab] || [],
    activeTopTab,
    setActiveTopTab,
    settings.leftTabs || [],
    activeLeftTab,
    setActiveLeftTab,
  );

  if (showRecovery) {
    return (
      <div className="h-screen w-screen bg-gray-900 text-white flex flex-col items-center justify-center p-8 text-center" data-tauri-drag-region>
        <div className="bg-red-500/20 border border-red-500 p-6 rounded-xl max-w-lg shadow-2xl z-50">
          <h1 className="text-2xl font-bold mb-4 flex items-center justify-center gap-2">
            <span>⚠️</span> 配置文件损坏
          </h1>
          <p className="text-red-200 mb-2">系统在加载您的配置文件时遇到了无法解析的错误。为了防止您的原始数据被错误覆盖，系统已安全阻断启动。</p>
          <div className="bg-black/40 p-3 rounded text-left text-xs font-mono text-red-300 mb-6 overflow-x-auto">
            {recoveryMessage}
          </div>
          <div className="flex gap-4 justify-center">
            <button 
              onClick={handleRestoreBackup}
              className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded font-medium transition-colors"
            >
              从备份恢复 (Restore from Backup)
            </button>
            <button 
              onClick={() => window.location.reload()}
              className="bg-gray-700 hover:bg-gray-600 text-white px-4 py-2 rounded font-medium transition-colors"
            >
              重试加载 (Retry)
            </button>
          </div>
        </div>
      </div>
    );
  }

  // 渲染正常的 App 内容 (如果尚未加载，可以选择渲染骨架屏，此处暂时保持透明等待)
  if (!isLoaded) return <div className="h-screen w-screen bg-transparent" data-tauri-drag-region />;

  return (
    <div
      className="h-screen w-screen bg-transparent overflow-hidden"
      onWheel={handleWheel}
      onContextMenu={(e) => e.preventDefault()}
    >
      <DragDropProvider>
        <div
          className={`flex flex-col h-full bg-white/90 dark:bg-gray-900/80 backdrop-blur-xl shadow-soft-lg transition-transform duration-300 ease-in-out ${translateClass}`}
        >
          <CustomTitlebar />
          <div className={`flex flex-1 overflow-hidden ${flexDirectionClass}`} data-tauri-drag-region>
            <main
              className="flex-1 flex flex-col bg-transparent"
              style={{ width: `${gridContainerWidth}px` }}
              data-tauri-drag-region
            >
              <TopBar />

              <div
                className="flex-1 p-2 overflow-y-auto overflow-x-hidden text-gray-900 dark:text-gray-100 relative h-full w-full"
                onContextMenu={handleContextMenu}
              >
                <AppGrid />
              </div>
            </main>

            <Sidebar />
          </div>
        </div>
      </DragDropProvider>

      <AppModals />
      <GlobalContextMenu />
      <ToastContainer />
    </div>
  );
}

export default App;
