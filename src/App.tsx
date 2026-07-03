import { useState, useEffect } from "react";
import { AppGrid } from "./components/AppGrid";
import { CustomTitlebar } from "./components/CustomTitlebar";
import { useDataStore, setCachedPortable } from "./store/useDataStore";
import { useHistoryStore, setHistoryCachedPortable, loadHistoryFromBackend } from "./store/useHistoryStore";
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
import { useUpdateChecker } from "./hooks/useUpdateChecker";
import { useGlobalContextMenu } from "./hooks/useGlobalContextMenu";
import { DragDropProvider } from "./components/providers/DragDropProvider";
import { platform } from "./api/platform";
import { SHORTCUT_ITEM_MAX_WIDTH, GRID_GAP_PX, GRID_PADDING_X, SCROLLBAR_RESERVE, SIDEBAR_WIDTH } from "./constants/layout";
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
        // 0. 从注册表读取便携标志，并缓存供持久化层使用
        const portableFlag = await platform.getPortableMode();
        setCachedPortable(portableFlag);

        // 1. 区分“全新首次使用”与“疑似数据丢失”（FR-002a/FR-003）
        const info = await platform.getStoreInitInfo(portableFlag);
        const suspectedLoss = portableFlag && info.hasRecord && (!info.settingsExists || !info.appsExists);
        if (suspectedLoss) {
          if (isMounted) {
            setRecoveryMessage("检测到便携模式下数据文件缺失（可能因移动程序位置导致）。可尝试从备份恢复，避免数据丢失。");
            setShowRecovery(true);
          }
          return; // 不静默用默认值覆盖
        }

        // 2. 尝试加载并解析 Settings
        const settingsJsonStr = await platform.loadSettings(portableFlag);
        const parsedSettings = JSON.parse(settingsJsonStr);
        // 通过 useDataStore 的默认合并机制自动兼容新增字段
        if (isMounted) setSettings({ ...settings, ...parsedSettings });

        // 2b. 同步历史记录上限与便携缓存，并加载历史（009）
        setHistoryCachedPortable(portableFlag);
        const mergedSettings = { ...settings, ...parsedSettings };
        if (typeof mergedSettings.historyLimit === 'number') {
          useHistoryStore.getState().setLimit(mergedSettings.historyLimit);
        }
        await loadHistoryFromBackend(portableFlag);

        // 3. 尝试加载并解析 Apps
        const appsJsonStr = await platform.loadApps(portableFlag);
        const parsedApps = JSON.parse(appsJsonStr);
        if (isMounted) setApps(parsedApps);

        if (isMounted) setIsLoaded(true);

        // 4. 持久化“已初始化”记录，使后续启动能检测疑似丢失（首次写入，不迁移）
        await platform.ensurePortableRecord();
      } catch (err: unknown) {
        console.error('Initialization failed:', err);
        // 基于后端 ApiError 契约的 code 判定，而非字符串匹配（FR-013）；
        // JSON.parse 失败为前端 SyntaxError，一并视为解析错误。
        const code: string | undefined =
          err && typeof err === 'object' ? (err as { code?: string }).code : undefined;
        const isParseError = code === 'PARSE_ERROR' || err instanceof SyntaxError;
        if (isParseError) {
          if (isMounted) {
            const message =
              err && typeof err === 'object' && 'message' in err
                ? String((err as { message?: string }).message)
                : String(err);
            setRecoveryMessage(message);
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

  // 设置中的历史上限变化时，同步到历史 store（009，FR-006/Q5）
  useEffect(() => {
    if (typeof settings.historyLimit === 'number') {
      useHistoryStore.getState().setLimit(settings.historyLimit);
    }
  }, [settings.historyLimit]);

  const handleRestoreBackup = async () => {
    try {
      const portableFlag = await platform.getPortableMode();
      await platform.restoreFromBackup(portableFlag);
      window.location.reload(); // 重载页面以重新触发初始化流程
    } catch (err) {
      alert("恢复失败：" + err);
    }
  };

  useTauriEvents(setIsVisible, isVisible, settings.summonShortcut, settings.summonMouseShortcut || undefined);
  useGlobalShortcuts(isVisible);
  // 仅在窗口首次可见且数据加载完成时检查一次新版本（启动提示，其它静默）
  useUpdateChecker(isVisible && isLoaded);

  // 根据 dockPosition 决定 flex 的排列方向
  const isLeftDock = settings.dockPosition === 'left';
  const flexDirectionClass = isLeftDock ? "flex-row-reverse" : "flex-row";
  
  // 根据 dockPosition 决定动画的滑入滑出方向
  const translateClass = isVisible 
    ? "translate-x-0" 
    : (isLeftDock ? "-translate-x-full" : "translate-x-full");

  // 根据列数动态计算宽度（常量定义见 src/constants/layout.ts）
  const columns = settings.columns || 4;
  const gridContainerWidth = (columns * SHORTCUT_ITEM_MAX_WIDTH) + ((columns - 1) * GRID_GAP_PX) + GRID_PADDING_X + SCROLLBAR_RESERVE;
  const totalWindowWidth = gridContainerWidth + SIDEBAR_WIDTH;

  useEffect(() => {
    if (isLoaded) {
      platform.updateWindowWidth(totalWindowWidth, settings.dockPosition === 'left').catch((e: unknown) => console.error(e));
    }
  }, [isLoaded, totalWindowWidth, settings.dockPosition]);

  // 当窗口首次可见时，确保调用一次 updateWindowWidth 来调整到最新设置的位置
  useEffect(() => {
    if (isVisible && isLoaded) {
        platform.updateWindowWidth(totalWindowWidth, settings.dockPosition === 'left').catch((e: unknown) => console.error(e));
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
