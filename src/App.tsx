import { useState, useEffect, useRef } from "react";
import { AppGrid } from "./components/AppGrid";
import { AppEntity } from "./types";
import { getCurrentWindow, currentMonitor, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { CustomTitlebar } from "./components/CustomTitlebar";
import "./App.css";

type Tab = {
  id: string;
  name: string;
};

function App() {
  const [apps, setApps] = useState<AppEntity[]>([]);
  // 默认为 false，配合 tauri.conf.json 的 visible: false
  const [isVisible, setIsVisible] = useState(false);
  
  const [leftTabs, setLeftTabs] = useState<Tab[]>([
    { id: '1', name: 'All' },
    { id: '2', name: 'Work' },
    { id: '3', name: 'Game' }
  ]);
  const [topTabs, setTopTabs] = useState<Tab[]>([
    { id: '1', name: 'Tab 1' },
    { id: '2', name: 'Tab 2' },
    { id: '3', name: 'Tab 3' },
    { id: '4', name: 'Tab 4' }
  ]);

  const [activeLeftTab, setActiveLeftTab] = useState('1');
  const [activeTopTab, setActiveTopTab] = useState('1');

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabType, setEditingTabType] = useState<'left' | 'top' | null>(null);
  const [editValue, setEditValue] = useState('');
  
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  useEffect(() => {
    const setupWindow = async () => {
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
      const unlistenHide = await listen("force_hide_animation", () => {
        setIsVisible(false);
      });

      return () => {
        unlistenShow();
        unlistenHide();
      };
    };

    setupWindow();
  }, []);

  const handleAppAdd = (newApp: AppEntity) => {
    // 检查是否已经存在相同路径的应用
    if (!apps.some((app) => app.executable_path === newApp.executable_path)) {
      setApps((prev) => [...prev, newApp]);
    }
  };

  const handleAppRemove = (id: string) => {
    setApps((prev) => prev.filter((app) => app.id !== id));
  };

  const handleTabDoubleClick = (tab: Tab, type: 'left' | 'top') => {
    setEditingTabId(tab.id);
    setEditingTabType(type);
    setEditValue(tab.name);
  };

  const saveTabName = () => {
    if (editingTabId && editingTabType) {
      if (editValue.trim() !== '') {
        if (editingTabType === 'left') {
          setLeftTabs(tabs => tabs.map(t => t.id === editingTabId ? { ...t, name: editValue.trim() } : t));
        } else {
          setTopTabs(tabs => tabs.map(t => t.id === editingTabId ? { ...t, name: editValue.trim() } : t));
        }
      }
    }
    setEditingTabId(null);
    setEditingTabType(null);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveTabName();
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
      setEditingTabType(null);
    }
  };

  const wheelTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (editingTabId) return;
    
    // 简单的节流，防止一次滚动触发太多次切换
    if (wheelTimeoutRef.current) return;
    wheelTimeoutRef.current = setTimeout(() => {
      wheelTimeoutRef.current = null;
    }, 150);

    if (e.shiftKey) {
      const currentIndex = topTabs.findIndex(t => t.id === activeTopTab);
      if (e.deltaY > 0) {
        setActiveTopTab(topTabs[(currentIndex + 1) % topTabs.length].id);
      } else {
        setActiveTopTab(topTabs[(currentIndex - 1 + topTabs.length) % topTabs.length].id);
      }
    } else {
      const currentIndex = leftTabs.findIndex(t => t.id === activeLeftTab);
      if (e.deltaY > 0) {
        setActiveLeftTab(leftTabs[(currentIndex + 1) % leftTabs.length].id);
      } else {
        setActiveLeftTab(leftTabs[(currentIndex - 1 + leftTabs.length) % leftTabs.length].id);
      }
    }
  };

  const handleClick = (e: React.MouseEvent) => {
    if (e.shiftKey && !editingTabId) {
      const currentIndex = topTabs.findIndex(t => t.id === activeTopTab);
      setActiveTopTab(topTabs[(currentIndex + 1) % topTabs.length].id);
    }
  };

  return (
    <div 
      className="h-screen w-screen bg-transparent overflow-hidden"
      onWheel={handleWheel}
      onClick={handleClick}
    >
      <div 
        className={`flex flex-col h-full bg-white/95 dark:bg-gray-900/95 backdrop-blur-md border-l border-gray-200 dark:border-gray-800 shadow-2xl transition-transform duration-300 ease-in-out ${
          isVisible ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <CustomTitlebar />
        <div className="flex flex-1 overflow-hidden" data-tauri-drag-region>
          {/* 左侧纵向 Tabs */}
          <nav 
            className="w-16 flex flex-col items-center py-4 space-y-4 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50"
            data-tauri-drag-region
            role="tablist"
            aria-orientation="vertical"
            aria-label="主要导航"
          >
            {leftTabs.map((tab) => {
              const isActive = activeLeftTab === tab.id;
              const isEditing = editingTabId === tab.id && editingTabType === 'left';

              return (
                <div key={tab.id} className="w-10 h-10 flex items-center justify-center">
                  {isEditing ? (
                    <input
                      ref={editInputRef}
                      type="text"
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      onBlur={saveTabName}
                      onKeyDown={handleInputKeyDown}
                      className="w-10 h-10 text-center text-xs font-medium bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-xl outline-none text-gray-900 dark:text-gray-100"
                      title="重命名"
                      onClick={(e) => e.stopPropagation()}
                      onDoubleClick={(e) => e.stopPropagation()}
                    />
                  ) : (
                    <button
                      role="tab"
                      aria-selected={isActive}
                      onClick={() => setActiveLeftTab(tab.id)}
                      onDoubleClick={() => handleTabDoubleClick(tab, 'left')}
                      className={`w-full h-full flex items-center justify-center rounded-xl transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                        isActive 
                          ? 'bg-blue-500 text-white shadow-md' 
                          : 'text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100'
                      }`}
                      title={tab.name}
                    >
                      <span className="text-xs font-medium">{tab.name.slice(0, 2)}</span>
                    </button>
                  )}
                </div>
              );
            })}
          </nav>

          {/* 右侧主内容区 */}
          <main className="flex-1 flex flex-col bg-white/50 dark:bg-gray-900/50" data-tauri-drag-region>
            {/* 顶部横向 Tabs */}
            <div className="flex px-4 pt-3 pb-2 space-x-2" data-tauri-drag-region role="tablist" aria-label="次级导航">
              {topTabs.map((tab) => {
                const isActive = activeTopTab === tab.id;
                const isEditing = editingTabId === tab.id && editingTabType === 'top';

                return (
                  <div key={tab.id} className="flex">
                    {isEditing ? (
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editValue}
                        onChange={(e) => setEditValue(e.target.value)}
                        onBlur={saveTabName}
                        onKeyDown={handleInputKeyDown}
                        className="px-2 py-1.5 w-24 text-sm font-medium bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-full outline-none text-gray-900 dark:text-gray-100 text-center"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                      />
                    ) : (
                      <button
                        role="tab"
                        aria-selected={isActive}
                        onClick={() => setActiveTopTab(tab.id)}
                        onDoubleClick={() => handleTabDoubleClick(tab, 'top')}
                        className={`px-4 py-1.5 rounded-full text-sm font-medium transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                          isActive
                            ? 'bg-gray-800 text-white dark:bg-gray-100 dark:text-gray-900 shadow'
                            : 'text-gray-600 dark:text-gray-400 hover:bg-gray-200 dark:hover:bg-gray-800'
                        }`}
                      >
                        {tab.name}
                      </button>
                    )}
                  </div>
                );
              })}
            </div>

            {/* 应用网格区 */}
            <div className="flex-1 p-4 overflow-y-auto text-gray-900 dark:text-gray-100">
              <AppGrid apps={apps} onAppAdd={handleAppAdd} onAppRemove={handleAppRemove} />
            </div>
          </main>
        </div>
      </div>
    </div>
  );
}

export default App;
