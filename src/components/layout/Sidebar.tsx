import { useState, useRef, useEffect, type RefObject, type MouseEvent, type KeyboardEvent } from "react";
import { createPortal } from "react-dom";
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { useDataStore } from "../../store/useDataStore";
import { useUIStore } from "../../store/useUIStore";
import { useContextMenuStore } from "../../store/useContextMenuStore";
import { useModalStore } from "../../store/useModalStore";
import { Tab } from "../../types";
import { getTruncatedTabName } from "../../utils/tabDisplay";
import { resolveIcon } from "../../utils/icons";
import { getLucideIcon } from "../../utils/lucide";
import { IconPickerModal } from "../IconPickerModal";

// 标签内容：根据是否配置 iconUrl 切换文字/图标显示
interface TabContentProps {
  tab: Tab;
  isActive: boolean;
}

function TabContent({ tab, isActive }: TabContentProps) {
  if (tab.iconUrl) {
    const resolvedIcon = resolveIcon(tab.iconUrl);
    const iconColor = isActive
      ? 'text-white'
      : 'text-gray-700 dark:text-gray-300';

    if (resolvedIcon?.type === 'lucide') {
      const IconComponent = getLucideIcon(resolvedIcon.content);
      return (
        <div className="w-6 h-6 flex items-center justify-center">
          <IconComponent size={24} strokeWidth={1.5} className={iconColor} />
        </div>
      );
    }

    if (resolvedIcon?.type === 'svg') {
      return (
        <div
          className="w-6 h-6 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full"
          dangerouslySetInnerHTML={{ __html: resolvedIcon.content }}
        />
      );
    }

    if (resolvedIcon?.type === 'url') {
      return (
        <img
          src={resolvedIcon.content}
          alt={tab.name}
          className="w-6 h-6 object-contain"
          draggable={false}
        />
      );
    }
  }

  return (
    <span className="text-xs font-medium">
      {getTruncatedTabName(tab.name)}
    </span>
  );
}

interface SortableTabProps {
  tab: Tab;
  isActive: boolean;
  isEditing: boolean;
  editValue: string;
  setEditValue: (val: string) => void;
  saveTabName: () => void;
  handleInputKeyDown: (e: KeyboardEvent<HTMLInputElement>) => void;
  setActiveLeftTab: (id: string) => void;
  handleTabDoubleClick: (tab: Tab, e?: MouseEvent) => void;
  onContextMenu: (e: MouseEvent, tab: Tab) => void;
  editInputRef: RefObject<HTMLInputElement | null>;
  isHovered: boolean;
  onHoverEnter: () => void;
  onHoverLeave: () => void;
  dockPosition: 'left' | 'right';
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
  editInputRef,
  isHovered,
  onHoverEnter,
  onHoverLeave,
  dockPosition
}: SortableTabProps) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: `leftTab-${tab.id}` });

  // tab 元素引用，用于计算 tooltip 浮动坐标
  const tabRef = useRef<HTMLDivElement | null>(null);
  const [tooltipPos, setTooltipPos] = useState<{ top: number; left: number } | null>(null);

  // Use the sortable transition if available, otherwise apply a default smooth transition for entry
  const baseTransition = transition || "transform 300ms cubic-bezier(0.25, 1, 0.5, 1), opacity 300ms ease";

  const style = {
    transform: CSS.Transform.toString(transform),
    transition: baseTransition,
    zIndex: isDragging ? 10 : 1,
    opacity: isDragging ? 0.5 : 1,
  };

  // 仅图标模式下、非编辑态、已悬停时显示名称提示
  const showTooltip = !!tab.iconUrl && !isEditing && isHovered;

  // 悬停展开时，根据 tab 元素实际坐标计算 tooltip 位置
  // dockPosition=right（窗口贴屏幕右侧）→ 向左弹；left → 向右弹
  useEffect(() => {
    if (!showTooltip) {
      setTooltipPos(null);
      return;
    }
    const el = tabRef.current;
    if (!el) return;
    const rect = el.getBoundingClientRect();
    const GAP = 8;
    const top = rect.top + rect.height / 2;
    const left = dockPosition === 'right'
      ? rect.left - GAP
      : rect.right + GAP;
    setTooltipPos({ top, left });
  }, [showTooltip, dockPosition]);

  const setRef = (node: HTMLDivElement | null) => {
    setNodeRef(node);
    tabRef.current = node;
  };

  // We wrap the sortable element in an outer div that handles the entrance animation independently
  return (
    <div className="animate-slide-down-fade">
      <div
        ref={setRef}
        style={style}
        {...attributes}
        {...listeners}
        className="relative w-10 h-10 flex items-center justify-center"
        onContextMenu={(e) => onContextMenu(e, tab)}
        onMouseEnter={onHoverEnter}
        onMouseLeave={onHoverLeave}
      >
        {isEditing ? (
          <input
          ref={editInputRef as RefObject<HTMLInputElement>}
          type="text"
          value={editValue}
          aria-label="重命名标签"
          onChange={(e) => setEditValue(e.target.value)}
          onBlur={saveTabName}
          onKeyDown={handleInputKeyDown}
          className="w-10 h-10 text-center text-xs font-medium bg-black/5 dark:bg-white/10 border-2 border-blue-400 rounded-xl outline-none text-gray-900 dark:text-gray-100 transition-colors"
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
          className={`w-full h-full flex items-center justify-center rounded-xl transition-all apple-ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 active:scale-95 ${
            isActive
              ? 'bg-blue-500 text-white shadow-soft'
              : 'text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-gray-100'
          }`}
        >
          <TabContent tab={tab} isActive={isActive} />
        </button>
      )}
      </div>
      {showTooltip && tooltipPos && createPortal(
        <div
          role="tooltip"
          className="fixed z-50 bg-gray-900 text-white text-xs px-2 py-1 rounded-md shadow-lg whitespace-nowrap pointer-events-none animate-menu-pop"
          style={{
            top: tooltipPos.top,
            left: tooltipPos.left,
            transform: dockPosition === 'right' ? 'translate(-100%, -50%)' : 'translate(0, -50%)',
          }}
        >
          {tab.name}
        </div>,
        document.body
      )}
    </div>
  );
}

export function Sidebar() {
  const { apps, settings, updateSetting } = useDataStore();
  const leftTabs = settings.leftTabs || [];
  const { activeLeftTab, setActiveLeftTab } = useUIStore();
  const { openMenu } = useContextMenuStore();
  const { openSettings } = useModalStore();

  const [editingTabId, setEditingTabId] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');
  const editInputRef = useRef<HTMLInputElement>(null);

  // 图标模式下悬停显示名称：300ms 延迟避免快速划过闪烁
  const [hoveredTabId, setHoveredTabId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // 图标选择器：当前正在编辑图标的标签 id
  const [iconPickerTabId, setIconPickerTabId] = useState<string | null>(null);

  useEffect(() => {
    if (editingTabId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingTabId]);

  // 组件卸载时清理悬停计时器
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleHoverEnter = (tabId: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setHoveredTabId(tabId), 300);
  };

  const handleHoverLeave = () => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredTabId(null);
  };

  const handleTabDoubleClick = (tab: Tab, e?: MouseEvent) => {
    if (e) e.stopPropagation();
    setEditingTabId(tab.id);
    setEditValue(tab.name);
  };

  const saveTabName = () => {
    if (editingTabId) {
      if (editValue.trim() !== '') {
        updateSetting('leftTabs', leftTabs.map((t: Tab) => t.id === editingTabId ? { ...t, name: editValue.trim() } : t));
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
    const hasApps = apps.some(app => app.categoryId === tabId);
    if (hasApps) {
      if (!window.confirm("该标签下包含应用数据，确认删除吗？")) {
        return;
      }
    }
    const newTabs = leftTabs.filter((t: Tab) => t.id !== tabId);
    if (activeLeftTab === tabId && newTabs.length > 0) {
      setActiveLeftTab(newTabs[0].id);
    }
    updateSetting('leftTabs', newTabs);
  };

  // 图标选择回调：写入对应标签的 iconUrl
  const handleIconSelect = (iconUrl: string) => {
    if (iconPickerTabId) {
      updateSetting('leftTabs', leftTabs.map((t: Tab) =>
        t.id === iconPickerTabId ? { ...t, iconUrl: iconUrl || null } : t
      ));
    }
    setIconPickerTabId(null);
  };

  // 清除图标：恢复文字显示
  const handleIconClear = (tabId: string) => {
    updateSetting('leftTabs', leftTabs.map((t: Tab) =>
      t.id === tabId ? { ...t, iconUrl: null } : t
    ));
  };

  const handleTabContextMenu = (e: MouseEvent, tab: Tab) => {
    e.preventDefault();
    e.stopPropagation();
    openMenu([
      { label: '重命名', onClick: () => handleTabDoubleClick(tab) },
      { label: '设置图标', onClick: () => setIconPickerTabId(tab.id) },
      ...(tab.iconUrl ? [{ label: '清除图标', onClick: () => handleIconClear(tab.id) }] : []),
      { isSeparator: true, label: '' },
      { label: '删除', onClick: () => handleDeleteTab(tab.id) }
    ], e.clientX, e.clientY);
  };

  const editingIconTab = leftTabs.find((t: Tab) => t.id === iconPickerTabId) || null;

  return (
    <nav 
      className="w-14 flex flex-col items-center py-4 border-r border-black/5 dark:border-white/10 bg-white/40 dark:bg-gray-900/40 backdrop-blur-md"
      data-tauri-drag-region
      role="tablist"
      aria-orientation="vertical"
      aria-label="主要导航"
    >
      <div
        className="flex-1 w-full flex flex-col items-center overflow-y-auto gap-3 group"
      >
          <SortableContext
            items={leftTabs.map((t: Tab) => `leftTab-${t.id}`)}
            strategy={verticalListSortingStrategy}
          >
            {leftTabs.map((tab: Tab) => (
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
                isHovered={hoveredTabId === tab.id}
                onHoverEnter={() => handleHoverEnter(tab.id)}
                onHoverLeave={handleHoverLeave}
                dockPosition={(settings.dockPosition === 'left' ? 'left' : 'right')}
              />
            ))}
          </SortableContext>
          
          <button
            onClick={() => {
              const newId = crypto.randomUUID();
              updateSetting('leftTabs', [...leftTabs, { id: newId, name: 'New', iconUrl: null }]);
              setActiveLeftTab(newId);
              setEditingTabId(newId);
              setEditValue('New');
            }}
            className="w-10 h-10 flex items-center justify-center rounded-xl opacity-0 group-hover:opacity-100 transition-opacity duration-300 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 text-gray-500 dark:text-gray-400 active:scale-95 active:translate-y-2 transform transition-transform"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <line x1="12" y1="5" x2="12" y2="19"></line>
              <line x1="5" y1="12" x2="19" y2="12"></line>
            </svg>
          </button>
      </div>
      
      <div className="mt-auto mb-2 w-10 h-10 flex items-center justify-center" data-tauri-drag-region>
        <button
          onClick={openSettings}
          className="group w-full h-full flex items-center justify-center rounded-xl text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-gray-100 transition-all apple-ease focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 active:scale-95"
        >
          <svg className="w-5 h-5 transition-transform duration-300 apple-ease group-hover:rotate-90" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
          </svg>
        </button>
      </div>

      {iconPickerTabId && editingIconTab && createPortal(
        <IconPickerModal
          initialIconUrl={editingIconTab.iconUrl || ''}
          onClose={() => setIconPickerTabId(null)}
          onSelect={handleIconSelect}
        />,
        document.body
      )}
    </nav>
  );
}
