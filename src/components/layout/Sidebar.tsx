import React, { useState, useRef, useEffect } from "react";
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
import { useAppStore, Tab } from "../../store/useAppStore";
import { useContextMenuStore } from "../../store/useContextMenuStore";

interface SortableTabProps {
  tab: Tab;
  isActive: boolean;
  isEditing: boolean;
  editValue: string;
  setEditValue: (val: string) => void;
  saveTabName: () => void;
  handleInputKeyDown: (e: React.KeyboardEvent<HTMLInputElement>) => void;
  setActiveLeftTab: (id: string) => void;
  handleTabDoubleClick: (tab: Tab, e?: React.MouseEvent) => void;
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
      className="w-10 h-10 flex items-center justify-center"
      onContextMenu={(e) => onContextMenu(e, tab)}
    >
      {isEditing ? (
        <input
          ref={editInputRef as React.RefObject<HTMLInputElement>}
          type="text"
          value={editValue}
          aria-label="重命名标签"
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
          onDoubleClick={(e) => handleTabDoubleClick(tab, e)}
          className={`w-full h-full flex items-center justify-center rounded-xl transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
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

interface SidebarProps {
  onOpenSettings: () => void;
}

export function Sidebar({ onOpenSettings }: SidebarProps) {
  const { leftTabs, setLeftTabs, activeLeftTab, setActiveLeftTab } = useAppStore();
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
        setLeftTabs((tabs: Tab[]) => tabs.map(t => t.id === editingTabId ? { ...t, name: editValue.trim() } : t));
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
    setLeftTabs((prev: Tab[]) => {
      const newTabs = prev.filter(t => t.id !== tabId);
      if (activeLeftTab === tabId && newTabs.length > 0) {
        setActiveLeftTab(newTabs[0].id);
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

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: { distance: 5 },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (over && active.id !== over.id) {
      setLeftTabs((items: Tab[]) => {
        const oldIndex = items.findIndex((t) => t.id === active.id);
        const newIndex = items.findIndex((t) => t.id === over.id);
        return arrayMove(items, oldIndex, newIndex);
      });
    }
  };

  return (
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
          setLeftTabs((prev: Tab[]) => [...prev, { id: newId, name: 'New' }]);
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
            {leftTabs.map((tab) => (
              <SortableTab
                key={tab.id}
                tab={tab}
                isActive={activeLeftTab === tab.id}
                isEditing={editingTabId === tab.id}
                editValue={editValue}
                setEditValue={setEditValue}
                saveTabName={saveTabName}
                handleInputKeyDown={handleInputKeyDown}
                setActiveLeftTab={setActiveLeftTab}
                handleTabDoubleClick={handleTabDoubleClick}
                onContextMenu={handleTabContextMenu}
                editInputRef={editInputRef}
              />
            ))}
          </SortableContext>
        </DndContext>
      </div>
      
      <div className="mt-auto mb-2 w-10 h-10 flex items-center justify-center" data-tauri-drag-region>
        <button
          onClick={onOpenSettings}
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
  );
}
