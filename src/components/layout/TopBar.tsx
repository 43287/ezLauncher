import { useState, useRef, useEffect, type RefObject, type MouseEvent, type KeyboardEvent } from "react";
import { useDroppable } from "@dnd-kit/core";
import { useDataStore } from "../../store/useDataStore";
import { useUIStore } from "../../store/useUIStore";
import { useContextMenuStore } from "../../store/useContextMenuStore";
import { Tab } from "../../types";

function DroppableTopTab({ 
  tab, 
  isActive, 
  isEditing, 
  editValue, 
  setEditValue, 
  saveTabName, 
  handleInputKeyDown, 
  setActiveTopTab, 
  handleTabDoubleClick, 
  handleTabContextMenu,
  editInputRef 
}: {
  tab: Tab;
  isActive: boolean;
  isEditing: boolean;
  editValue: string;
  setEditValue: (v: string) => void;
  saveTabName: () => void;
  handleInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  setActiveTopTab: (id: string) => void;
  handleTabDoubleClick: (t: Tab, e?: MouseEvent) => void;
  handleTabContextMenu: (e: MouseEvent, t: Tab) => void;
  editInputRef: RefObject<HTMLInputElement | null>;
}) {
  const { setNodeRef, isOver } = useDroppable({
    id: `topTab-${tab.id}`,
    data: { type: 'topTab', id: tab.id }
  });

  return (
    <div 
      ref={setNodeRef}
      className={`flex-1 min-w-0 transition-colors ${isOver ? 'ring-2 ring-blue-400 rounded-full' : ''}`}
      onContextMenu={(e) => handleTabContextMenu(e, tab)}
    >
      {isEditing ? (
        <div className="flex h-8 items-center relative w-full">
          <input
            ref={editInputRef as RefObject<HTMLInputElement>}
            type="text"
            value={editValue}
            aria-label="重命名顶部标签"
            onChange={(e) => setEditValue(e.target.value)}
            onBlur={saveTabName}
            onKeyDown={handleInputKeyDown}
            className="px-4 w-full h-full text-sm font-medium bg-white dark:bg-gray-800 border-2 border-blue-500 rounded-full outline-none text-gray-900 dark:text-gray-100 text-center box-border"
            onClick={(e) => e.stopPropagation()}
            onDoubleClick={(e) => e.stopPropagation()}
          />
        </div>
      ) : (
        <div className="flex h-8 items-center w-full">
          <button
            role="tab"
            aria-selected={isActive}
            onClick={() => setActiveTopTab(tab.id)}
            onDoubleClick={(e) => handleTabDoubleClick(tab, e)}
            className={`w-full px-2 h-full rounded-full text-sm font-medium transition-all apple-ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 active:scale-95 truncate ${
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
}

export function TopBar() {
  const { settings, updateSetting } = useDataStore();
  const { activeTopTab, setActiveTopTab, activeLeftTab } = useUIStore();
  const { openMenu } = useContextMenuStore();

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  const topTabs = settings.topTabs || {};
  const currentTopTabs = topTabs[activeLeftTab] || [];

  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  const handleTabDoubleClick = (tab: Tab, e?: MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTabId(tab.id);
    setEditValue(tab.name);
  };

  const saveTabName = () => {
    if (editingTabId) {
      if (editValue.trim() !== '') {
        const current = topTabs[activeLeftTab] || [];
        const newTabsMap = {
          ...topTabs,
          [activeLeftTab]: current.map((t: Tab) => t.id === editingTabId ? { ...t, name: editValue.trim() } : t)
        };
        updateSetting('topTabs', newTabsMap);
      }
    }
    setEditingTabId(null);
  };

  const handleInputKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      saveTabName();
    } else if (e.key === 'Escape') {
      setEditingTabId(null);
    }
  };

  const handleDeleteTab = (tabId: string) => {
    const current = topTabs[activeLeftTab] || [];
    const newTabs = current.filter((t: Tab) => t.id !== tabId);
    if (activeTopTab === tabId) {
      setActiveTopTab(newTabs.length > 0 ? newTabs[0].id : '');
    }
    const newTabsMap = {
      ...topTabs,
      [activeLeftTab]: newTabs
    };
    updateSetting('topTabs', newTabsMap);
  };

  const handleTabContextMenu = (e: MouseEvent, tab: Tab) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu([
      { label: '重命名', onClick: () => handleTabDoubleClick(tab) },
      { isSeparator: true, label: '' },
      { label: '删除', onClick: () => handleDeleteTab(tab.id) }
    ], e.clientX, e.clientY);
  };

  return (
    <div 
      className="flex px-4 pt-3 pb-2 gap-2 bg-transparent" 
      data-tauri-drag-region
      role="tablist"
      aria-label="次级导航"
    >
      {currentTopTabs.map((tab: Tab) => {
        const isActive = activeTopTab === tab.id;
        const isEditing = editingTabId === tab.id;

        return (
          <DroppableTopTab
            key={tab.id}
            tab={tab}
            isActive={isActive}
            isEditing={isEditing}
            editValue={editValue}
            setEditValue={setEditValue}
            saveTabName={saveTabName}
            handleInputKeyDown={handleInputKeyDown}
            setActiveTopTab={setActiveTopTab}
            handleTabDoubleClick={handleTabDoubleClick}
            handleTabContextMenu={handleTabContextMenu}
            editInputRef={editInputRef}
          />
        );
      })}
    </div>
  );
}
