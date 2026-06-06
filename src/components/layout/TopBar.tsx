import React, { useState, useRef, useEffect } from "react";
import { useAppStore, Tab } from "../../store/useAppStore";
import { useContextMenuStore } from "../../store/useContextMenuStore";

export function TopBar() {
  const { topTabs, setTopTabs, activeTopTab, setActiveTopTab } = useAppStore();
  const { openMenu } = useContextMenuStore();

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  const handleTabDoubleClick = (tab: Tab, e?: React.MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTabId(tab.id);
    setEditValue(tab.name);
  };

  const saveTabName = () => {
    if (editingTabId) {
      if (editValue.trim() !== '') {
        setTopTabs((tabs: Tab[]) => tabs.map(t => t.id === editingTabId ? { ...t, name: editValue.trim() } : t));
      }
    }
    setEditingTabId(null);
  };

  const handleInputKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveTabName();
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  };

  const handleDeleteTab = (tabId: string) => {
    setTopTabs((prev: Tab[]) => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeTopTab === tabId && newTabs.length > 0) {
        setActiveTopTab(newTabs[0].id);
      }
      return newTabs;
    });
  };

  const handleTabContextMenu = (e: React.MouseEvent, tab: Tab) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu([
      { label: '重命名', onClick: () => handleTabDoubleClick(tab) },
      { isSeparator: true, label: '' },
      { label: '删除', onClick: () => handleDeleteTab(tab.id) }
    ], e.clientX, e.clientY);
  };

  return (
    <div className="flex px-4 pt-3 pb-2 gap-2 bg-transparent" data-tauri-drag-region role="tablist" aria-label="次级导航">
      {topTabs.map((tab) => {
        const isActive = activeTopTab === tab.id;
        const isEditing = editingTabId === tab.id;

        return (
          <div 
            key={tab.id} 
            className="flex"
            onContextMenu={(e) => handleTabContextMenu(e, tab)}
          >
            {isEditing ? (
              <div className="flex h-8 items-center relative">
                <input
                  ref={editInputRef}
                  type="text"
                  value={editValue}
                  aria-label="重命名顶部标签"
                  onChange={(e) => setEditValue(e.target.value)}
                  onBlur={saveTabName}
                  onKeyDown={handleInputKeyDown}
                  className="px-4 h-full text-sm font-medium bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-full outline-none text-gray-900 dark:text-gray-100 text-center box-border absolute left-1/2 -translate-x-1/2 min-w-full z-10"
                  onClick={(e) => e.stopPropagation()}
                  onDoubleClick={(e) => e.stopPropagation()}
                  style={{ width: `calc(32px + ${editValue.length}ch)` }}
                />
                <div className="px-4 h-full text-sm font-medium invisible whitespace-nowrap">
                  {tab.name}
                </div>
              </div>
            ) : (
              <div className="flex h-8 items-center">
                <button
                  role="tab"
                  aria-selected={isActive}
                  onClick={() => setActiveTopTab(tab.id)}
                  onDoubleClick={(e) => handleTabDoubleClick(tab, e)}
                  className={`px-4 h-full rounded-full text-sm font-medium transition-all apple-ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 active:scale-95 ${
                    isActive
                      ? 'bg-black/80 text-white dark:bg-white/90 dark:text-gray-900 shadow-soft'
                      : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  {tab.name}
                </button>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}
