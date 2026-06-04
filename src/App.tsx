import { useState, useEffect, useRef } from "react";
import { AppGrid } from "./components/AppGrid";
import { LaunchItem } from "./types";
import { getCurrentWindow, currentMonitor, LogicalSize, LogicalPosition } from "@tauri-apps/api/window";
import { listen } from "@tauri-apps/api/event";
import { invoke } from "@tauri-apps/api/core";
import { CustomTitlebar } from "./components/CustomTitlebar";
import { SettingsWindow } from "./components/SettingsWindow";
import { PropertiesModal } from "./components/PropertiesModal";
import { ContextMenuItem } from "./components/ContextMenuItem";
import { useSettings } from "./hooks/useSettings";
import {
  DndContext,
  closestCenter,
  KeyboardSensor,
  PointerSensor,
  useSensor,
  useSensors,
  DragEndEvent,
} from "@dnd-kit/core";
import {
  arrayMove,
  SortableContext,
  sortableKeyboardCoordinates,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import "./App.css";

export type Tab = {
  id: string;
  name: string;
};

interface SortableTabProps {
  tab: Tab;
  isActive: boolean;
  isEditing: boolean;
  editValue: string;
  setEditValue: (val: string) => void;
  saveTabName: () => void;
  handleInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  setActiveLeftTab: (id: string) => void;
  handleTabDoubleClick: (tab: Tab, type: 'left' | 'top') => void;
  onContextMenu: (e: React.MouseEvent, tab: Tab) => void;
  editInputRef: React.RefObject<HTMLInputElement | null>;
}

function SortableTab({
  tab,
  isActive,
  isEditing,
  editValue,
  setEditValue,
  saveTabName,
  handleInputKeyDown,
  setActiveLeftTab,
  handleTabDoubleClick,
  onContextMenu,
  editInputRef
}: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: tab.id });

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  return (
    <div 
      ref={setNodeRef} 
      style={style} 
      {...attributes} 
      {...listeners}
      className="w-10 h-10 flex items-center justify-center mb-4 last:mb-0"
      onContextMenu={(e) => onContextMenu(e, tab)}
    >
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
          aria-label={tab.name}
        >
          <span className="text-xs font-medium">{tab.name.slice(0, 2)}</span>
        </button>
      )}
    </div>
  );
}


function App() {
  const { settings, updateSetting, isLoaded } = useSettings();
  const [hasInitialized, setHasInitialized] = useState(false);

  const [apps, setApps] = useState<LaunchItem[]>([]);
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

  useEffect(() => {
    if (isLoaded && !hasInitialized) {
      if (settings.apps) setApps(settings.apps);
      if (settings.leftTabs) setLeftTabs(settings.leftTabs);
      if (settings.topTabs) setTopTabs(settings.topTabs);
      setHasInitialized(true);
    }
  }, [isLoaded, hasInitialized, settings]);

  useEffect(() => {
    if (hasInitialized) updateSetting('apps', apps);
  }, [apps, hasInitialized]);

  useEffect(() => {
    if (hasInitialized) updateSetting('leftTabs', leftTabs);
  }, [leftTabs, hasInitialized]);

  useEffect(() => {
    if (hasInitialized) updateSetting('topTabs', topTabs);
  }, [topTabs, hasInitialized]);

  const [activeLeftTab, setActiveLeftTab] = useState('1');
  const [activeTopTab, setActiveTopTab] = useState('1');

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editingTabType, setEditingTabType] = useState<'left' | 'top' | null>(null);
  const [editValue, setEditValue] = useState('');
  
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [editingApp, setEditingApp] = useState<LaunchItem | null>(null);
  const [isAddingApp, setIsAddingApp] = useState(false);
  const [addingAppType, setAddingAppType] = useState<LaunchItem['type']>('app');

  const [contextMenuTab, setContextMenuTab] = useState<Tab | null>(null);
  const [contextMenuType, setContextMenuType] = useState<'tab' | 'grid' | null>(null);
  const [contextMenuPos, setContextMenuPos] = useState({ x: 0, y: 0 });

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

      // 监听 Tauri 原生的拖拽释放事件
      let isExtracting = false; // 防止重复触发
      const unlistenDrop = await listen("tauri://drag-drop", async (event: any) => {
        if (isExtracting) return;
        
        const paths = event.payload?.paths as string[];
        if (paths && paths.length > 0) {
          isExtracting = true;
          // 处理拖入的文件
          for (const path of paths) {
            try {
              const info: any = await invoke("extract_file_info", { filePath: path });
              
              const newApp: LaunchItem = {
                id: Date.now().toString() + Math.random().toString(36).substr(2, 9),
                name: info.name,
                type: 'app',
                executable_path: info.path,
                icon_base64: info.icon_base64 || undefined
              };
              
              // 使用函数式更新来避免闭包陷阱，同时在内部做去重校验
              setApps(prev => {
                if (newApp.type === 'app' && newApp.executable_path) {
                  if (prev.some(app => app.type === 'app' && app.executable_path === newApp.executable_path)) {
                    return prev;
                  }
                }
                return [...prev, newApp];
              });
            } catch (err) {
              console.error("Failed to extract file info:", err);
            }
          }
          
          // 稍微延迟解除锁定，防止系统的连续事件轰炸
          setTimeout(() => {
            isExtracting = false;
          }, 100);
        }
      });

      return () => {
        unlistenShow();
        unlistenHide();
        unlistenDrop();
      };
    };

    setupWindow();
  }, []); // Remove apps dependency to prevent re-binding event listeners on every app change

  const handleAppAdd = (newApp: LaunchItem) => {
    setApps((prev) => {
      // 检查是否已经存在相同路径的应用 (仅对 app 且 executable_path 存在的有效)
      if (newApp.type === 'app' && newApp.executable_path) {
        if (prev.some((app) => app.type === 'app' && app.executable_path === newApp.executable_path)) {
          return prev;
        }
      }
      return [...prev, newApp];
    });
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

  // ---------------- Drag and Drop & Tabs ----------------
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

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      setLeftTabs((items) => {
        const oldIndex = items.findIndex((t) => t.id === active.id);
        const newIndex = items.findIndex((t) => t.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };



  const handleTabContextMenu = (e: React.MouseEvent, tab: Tab) => {
    e.preventDefault();
    e.stopPropagation();
    setContextMenuType('tab');
    setContextMenuTab(tab);
    const x = Math.min(e.clientX, window.innerWidth - 145);
    const y = Math.min(e.clientY, window.innerHeight - 80);
    setContextMenuPos({ x, y });
  };

  const closeContextMenu = () => {
    setContextMenuType(null);
    setContextMenuTab(null);
  };

  const handleDeleteTab = () => {
    if (contextMenuTab) {
      setLeftTabs(prev => prev.filter(t => t.id !== contextMenuTab.id));
      if (activeLeftTab === contextMenuTab.id) {
        setActiveLeftTab(leftTabs[0]?.id || '');
      }
    }
    closeContextMenu();
  };

  const handleRenameTab = () => {
    if (contextMenuTab) {
      handleTabDoubleClick(contextMenuTab, 'left');
    }
    closeContextMenu();
  };

  // Close context menu on outside click
  useEffect(() => {
    const handleClickOutside = () => closeContextMenu();
    window.addEventListener('click', handleClickOutside);
    return () => window.removeEventListener('click', handleClickOutside);
  }, []);
  // ------------------------------------------------------

  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleWheel = (e: React.WheelEvent) => {
    if (editingTabId) return;
    
    // 简单的节流，防止一次滚动触发太多次切换
    if (wheelTimeoutRef.current) return;
    wheelTimeoutRef.current = setTimeout(() => {
      wheelTimeoutRef.current = null;
    }, 150);

    // 判断是垂直滚动还是水平滚动（侧键滚轮或触控板横滑）
    const isHorizontalScroll = Math.abs(e.deltaX) > Math.abs(e.deltaY);

    // 支持 shift+滚轮 或 真正的横向滚轮 切换顶部 Tab
    if (e.shiftKey || isHorizontalScroll) {
      const currentIndex = topTabs.findIndex(t => t.id === activeTopTab);
      // 如果是横向滚动，使用 deltaX，如果是 Shift+垂直滚动，使用 deltaY
      const delta = isHorizontalScroll ? e.deltaX : e.deltaY;
      
      if (delta > 0) {
        setActiveTopTab(topTabs[(currentIndex + 1) % topTabs.length].id);
      } else if (delta < 0) {
        setActiveTopTab(topTabs[(currentIndex - 1 + topTabs.length) % topTabs.length].id);
      }
    } else {
      // 纯粹的垂直滚动：切换左侧 Tab
      const currentIndex = leftTabs.findIndex(t => t.id === activeLeftTab);
      if (e.deltaY > 0) {
        setActiveLeftTab(leftTabs[(currentIndex + 1) % leftTabs.length].id);
      } else if (e.deltaY < 0) {
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
            className="w-16 flex flex-col items-center py-4 border-r border-gray-200 dark:border-gray-800 bg-gray-50 dark:bg-gray-900/50"
            data-tauri-drag-region
            role="tablist"
            aria-orientation="vertical"
            aria-label="主要导航"
          >
            <div 
              className="flex-1 space-y-4 w-full flex flex-col items-center overflow-y-auto" 
              data-tauri-drag-region
              onDoubleClick={() => {
                const newId = Date.now().toString();
                setLeftTabs(prev => [...prev, { id: newId, name: 'New' }]);
                setActiveLeftTab(newId);
              }}
            >
              <DndContext
                sensors={sensors}
                collisionDetection={closestCenter}
                onDragEnd={handleDragEnd}
              >
                <SortableContext
                  items={leftTabs.map(t => t.id)}
                  strategy={verticalListSortingStrategy}
                >
                  {leftTabs.map((tab) => {
                    const isActive = activeLeftTab === tab.id;
                    const isEditing = editingTabId === tab.id && editingTabType === 'left';

                    return (
                      <SortableTab
                        key={tab.id}
                        tab={tab}
                        isActive={isActive}
                        isEditing={isEditing}
                        editValue={editValue}
                        setEditValue={setEditValue}
                        saveTabName={saveTabName}
                        handleInputKeyDown={handleInputKeyDown}
                        setActiveLeftTab={setActiveLeftTab}
                        handleTabDoubleClick={handleTabDoubleClick}
                        onContextMenu={handleTabContextMenu}
                        editInputRef={editInputRef}
                      />
                    );
                  })}
                </SortableContext>
              </DndContext>
            </div>
            
            {/* 底部设置按钮 */}
            <div className="mt-auto mb-2 w-10 h-10 flex items-center justify-center" data-tauri-drag-region>
              <button
                onClick={() => setIsSettingsOpen(true)}
                className="w-full h-full flex items-center justify-center rounded-xl text-gray-500 hover:bg-gray-200 dark:hover:bg-gray-700 hover:text-gray-900 dark:hover:text-gray-100 transition-all focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                title="设置"
                aria-label="设置"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                </svg>
              </button>
            </div>
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
                        className="px-4 py-1.5 text-sm font-medium bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-full outline-none text-gray-900 dark:text-gray-100 text-center box-border"
                        onClick={(e) => e.stopPropagation()}
                        onDoubleClick={(e) => e.stopPropagation()}
                        style={{ width: `calc(32px + ${editValue.length}ch)` }}
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
            <div 
              className="flex-1 p-4 overflow-y-auto text-gray-900 dark:text-gray-100 relative"
              onContextMenu={(e) => {
                e.preventDefault();
                setContextMenuType('grid');
                // Ensure context menu stays within window bounds (window width is ~400, menu is ~140)
                const x = Math.min(e.clientX, window.innerWidth - 145);
                const y = Math.min(e.clientY, window.innerHeight - 150); // Approximate height
                setContextMenuPos({ x, y });
              }}
            >
              <AppGrid 
                apps={apps} 
                onAppAdd={handleAppAdd} 
                onAppRemove={handleAppRemove} 
                onAppReorder={setApps}
                onAppRename={(id, newName) => {
                  setApps(prev => prev.map(app => app.id === id ? { ...app, name: newName } : app));
                }}
                onEditProperties={(app) => {
                  setEditingApp(app);
                }}
              />
            </div>
          </main>
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
            setApps(prev => prev.map(app => app.id === updatedApp.id ? updatedApp : app));
            setEditingApp(null);
          }}
        />
      )}

      {isAddingApp && (
        <PropertiesModal
          app={{ id: Date.now().toString(), name: "新建快捷方式", type: addingAppType }}
          onClose={() => setIsAddingApp(false)}
          onSave={(newApp) => {
            handleAppAdd(newApp);
            setIsAddingApp(false);
          }}
        />
      )}

      {contextMenuType && (
        <>
          <div 
            className="fixed inset-0 z-40" 
            onClick={closeContextMenu}
            onContextMenu={(e) => {
              e.preventDefault();
              closeContextMenu();
            }}
          />
          <div 
            className="fixed z-50 bg-white/95 dark:bg-gray-800/95 backdrop-blur-md rounded-xl shadow-2xl border border-gray-200/50 dark:border-gray-700/50 py-1.5 w-24 overflow-visible"
            style={{ top: contextMenuPos.y, left: contextMenuPos.x }}
            onClick={(e) => e.stopPropagation()}
          >
            {contextMenuType === 'tab' && (
            <>
              <button 
                className="w-full px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-gray-100 dark:hover:bg-gray-700 text-gray-700 dark:text-gray-200 focus-visible:outline-none focus-visible:bg-gray-100 dark:focus-visible:bg-gray-700"
                onClick={handleRenameTab}
              >
                重命名
              </button>
              <div className="h-px bg-gray-200/50 dark:bg-gray-700/50 my-1 mx-2" />
              <button 
                className="w-full px-3 py-1.5 text-left text-xs font-medium transition-colors hover:bg-red-50 dark:hover:bg-red-500/10 text-red-600 dark:text-red-400 focus-visible:outline-none focus-visible:bg-red-50 dark:focus-visible:bg-red-500/10"
                onClick={handleDeleteTab}
              >
                删除
              </button>
            </>
          )}
          {contextMenuType === 'grid' && (
            <>
              <ContextMenuItem label="添加快捷方式">
                <ContextMenuItem 
                  label="可执行程序" 
                  onClick={() => { setAddingAppType('app'); setIsAddingApp(true); closeContextMenu(); }} 
                />
                <ContextMenuItem 
                  label="网页链接" 
                  onClick={() => { setAddingAppType('link'); setIsAddingApp(true); closeContextMenu(); }} 
                />
                <ContextMenuItem 
                  label="系统程序" 
                  onClick={() => { setAddingAppType('app'); setIsAddingApp(true); closeContextMenu(); }} 
                />
                <ContextMenuItem 
                  label="脚本" 
                  onClick={() => { setAddingAppType('app'); setIsAddingApp(true); closeContextMenu(); }} 
                />
                <ContextMenuItem 
                  label="pwsh/cmd命令" 
                  onClick={() => { setAddingAppType('app'); setIsAddingApp(true); closeContextMenu(); }} 
                />
              </ContextMenuItem>
              <ContextMenuItem 
                label="添加分隔符" 
                onClick={() => {
                  const newApp: LaunchItem = { id: Date.now().toString(), name: "分隔符", type: "separator" };
                  handleAppAdd(newApp);
                  closeContextMenu();
                }}
              />
            </>
          )}
        </div>
      </>
    )}
    </div>
  );
}

export default App;
