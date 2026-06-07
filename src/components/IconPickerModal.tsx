import React, { useState, useMemo, useRef } from 'react';
import * as LucideIcons from 'lucide-react';
import { open } from '@tauri-apps/plugin-dialog';
import { invoke } from '@tauri-apps/api/core';
import { useVirtualizer } from '@tanstack/react-virtual';
import { SVG_ICONS } from '../utils/icons';

interface IconPickerModalProps {
  initialIconUrl: string;
  onClose: () => void;
  onSelect: (iconUrl: string) => void;
}

type TabType = 'system' | 'lucide' | 'url';

export const IconPickerModal: React.FC<IconPickerModalProps> = ({
  initialIconUrl,
  onClose,
  onSelect,
}) => {
  const [activeTab, setActiveTab] = useState<TabType>('system');
  const [searchQuery, setSearchQuery] = useState('');
  const [urlInput, setUrlInput] = useState(initialIconUrl || '');
  
  // Tabs
  const tabs = [
    { id: 'system', label: '系统默认' },
    { id: 'lucide', label: '内置库' },
    { id: 'url', label: 'URL' },
  ];

  // System Default Icons
  const systemIcons = Object.keys(SVG_ICONS);

  // Lucide Icons (Filter out non-icon exports)
  const lucideIconNames = useMemo(() => {
    return Object.keys(LucideIcons).filter(key => {
      // 过滤掉所有小写开头的导出（如 icons, createLucideIcon, default 等）
      // 过滤掉基础组件 Icon
      if (!/^[A-Z]/.test(key) || key === 'Icon') return false;
      
      const item = (LucideIcons as any)[key];
      // 确保是合法的 React 渲染对象（通常是 forwardRef 返回的 object 或 function）
      return item && (typeof item === 'object' || typeof item === 'function') && item.$$typeof;
    });
  }, []);

  const filteredLucideIcons = useMemo(() => {
    if (!searchQuery) return lucideIconNames;
    const lowerQuery = searchQuery.toLowerCase();
    return lucideIconNames.filter(name => name.toLowerCase().includes(lowerQuery));
  }, [lucideIconNames, searchQuery]);

  // Use a responsive grid column count for the virtualizer based on an estimated container width
  const columns = 8; 
  const rowCount = Math.ceil(filteredLucideIcons.length / columns);
  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 80, // Estimated height of each grid row (padding + icon + text)
    overscan: 5,
  });

  const handleLocalFileSelect = async () => {
    try {
      const selected = await open({
        multiple: false,
        filters: [{
          name: 'Images',
          extensions: ['png', 'jpg', 'jpeg', 'webp', 'svg', 'ico', 'exe']
        }]
      });
      if (selected && typeof selected === 'string') {
        // 调用后端 command 将本地图片复制到自定义图标目录
        const customUrl = await invoke<string>('copy_custom_icon', { srcPath: selected });
        onSelect(customUrl);
      }
    } catch (err) {
      console.error('Failed to select or copy local icon:', err);
    }
  };

  const handleUrlSelect = () => {
    if (urlInput.trim()) {
      onSelect(urlInput.trim());
    }
  };

  return (
    <div 
      className="fixed inset-0 z-[60] flex items-center justify-center bg-black/40 backdrop-blur-sm animate-fade-in"
      onClick={onClose}
    >
      <div 
        className="bg-white/95 dark:bg-gray-900/95 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-soft-xl rounded-xl w-[90vw] max-w-2xl h-[70vh] flex flex-col overflow-hidden animate-fade-up-scale"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Tabs and Close Button Header */}
        <div className="flex justify-between items-center border-b border-black/5 dark:border-white/10 px-2 pt-2">
          <div className="flex gap-1">
            {tabs.map(tab => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id as TabType)}
                className={`px-4 py-2 text-sm font-medium rounded-t-lg transition-colors ${
                  activeTab === tab.id
                    ? 'bg-white dark:bg-gray-800 text-blue-600 dark:text-blue-400 border-t border-l border-r border-black/5 dark:border-white/10'
                    : 'text-gray-600 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/5'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
          <button 
            onClick={onClose}
            className="w-7 h-7 mb-1 mr-2 flex items-center justify-center text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 rounded-md transition-colors"
          >
            <LucideIcons.X size={16} />
          </button>
        </div>

        {/* Content */}
        <div 
          className="flex-1 overflow-hidden p-4 flex flex-col min-h-0"
          onWheel={(e) => e.stopPropagation()}
        >
          {activeTab === 'system' && (
            <div 
              className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-4 overflow-y-auto custom-scrollbar pr-2 h-full content-start"
              onWheel={(e) => e.stopPropagation()}
            >
              {systemIcons.map(icon => (
                <button
                  key={icon}
                  onClick={() => onSelect(icon)}
                  className="flex flex-col items-center justify-center gap-2 p-3 rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors h-[84px]"
                  title={icon}
                >
                  <div 
                    className="w-10 h-10 shrink-0 [&>svg]:w-full [&>svg]:h-full"
                    dangerouslySetInnerHTML={{ __html: SVG_ICONS[icon] }}
                  />
                  <span className="text-[10px] text-gray-500 truncate w-full text-center leading-none mt-auto">{icon}</span>
                </button>
              ))}
            </div>
          )}

          {activeTab === 'lucide' && (
            <div className="flex flex-col h-full gap-4">
              <div className="relative shrink-0">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none">
                  <LucideIcons.Search size={16} className="text-gray-400" />
                </div>
                <input
                  type="text"
                  placeholder="搜索内置图标 (如: Smile, File, Folder)..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-md pl-9 pr-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                />
              </div>
              <div 
                ref={parentRef} 
                className="overflow-y-auto custom-scrollbar min-h-0 flex-1 w-full relative"
                onWheel={(e) => e.stopPropagation()}
              >
                <div
                  style={{
                    height: `${rowVirtualizer.getTotalSize()}px`,
                    width: '100%',
                    position: 'relative',
                  }}
                >
                  {rowVirtualizer.getVirtualItems().map((virtualRow) => {
                    const fromIndex = virtualRow.index * columns;
                    const rowIcons = filteredLucideIcons.slice(fromIndex, fromIndex + columns);

                    return (
                      <div
                        key={virtualRow.key}
                        className="grid grid-cols-4 sm:grid-cols-6 md:grid-cols-8 gap-3"
                        style={{
                          position: 'absolute',
                          top: 0,
                          left: 0,
                          width: '100%',
                          height: `${virtualRow.size}px`,
                          transform: `translateY(${virtualRow.start}px)`,
                        }}
                      >
                        {rowIcons.map(iconName => {
                          const IconComponent = (LucideIcons as any)[iconName];
                          if (!IconComponent) return null;
                          return (
                            <button
                              key={iconName}
                              onClick={() => onSelect(`lucide://${iconName}`)}
                              className="flex flex-col items-center justify-center gap-2 p-2 h-[72px] rounded-lg hover:bg-black/5 dark:hover:bg-white/10 transition-colors group"
                              title={iconName}
                            >
                              <IconComponent size={28} className="text-gray-700 dark:text-gray-300 group-hover:text-blue-500 transition-colors shrink-0" />
                              <span className="text-[10px] text-gray-500 truncate w-full text-center leading-none mt-auto">{iconName}</span>
                            </button>
                          );
                        })}
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>
          )}

          {activeTab === 'url' && (
            <div 
              className="flex flex-col items-center justify-center h-full gap-8 max-w-lg mx-auto w-full overflow-y-auto custom-scrollbar pr-2"
              onWheel={(e) => e.stopPropagation()}
            >
              {/* 本地文件选择部分 */}
              <div className="flex flex-col items-center gap-3 w-full">
                <LucideIcons.Image size={40} className="text-gray-300 dark:text-gray-600" />
                <button
                  onClick={handleLocalFileSelect}
                  className="mt-2 px-6 py-2 bg-blue-500 hover:bg-blue-600 text-white rounded-md font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2"
                >
                  浏览本地文件...
                </button>
              </div>

              {/* 分隔线 */}
              <div className="w-full flex items-center gap-4">
                <div className="h-px bg-black/5 dark:bg-white/10 flex-1"></div>
                <span className="text-xs text-gray-400 dark:text-gray-500">或者输入链接</span>
                <div className="h-px bg-black/5 dark:bg-white/10 flex-1"></div>
              </div>

              {/* URL 输入部分 */}
              <div className="flex flex-col items-center gap-3 w-full">
                <LucideIcons.Link size={40} className="text-gray-300 dark:text-gray-600" />
                <p className="text-sm text-gray-500 dark:text-gray-400 text-center">
                  输入网络图片 URL 或 Base64 编码字符串。
                </p>
                <div className="w-full flex gap-2 mt-1">
                  <input
                    type="text"
                    placeholder="https://... 或 data:image/png;base64,..."
                    value={urlInput}
                    onChange={(e) => setUrlInput(e.target.value)}
                    className="flex-1 bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-md px-3 py-2 text-sm text-gray-900 dark:text-gray-100 focus:outline-none focus:ring-1 focus:ring-blue-400 transition-colors"
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') handleUrlSelect();
                    }}
                  />
                  <button
                    onClick={handleUrlSelect}
                    disabled={!urlInput.trim()}
                    className="px-4 py-2 bg-blue-500 hover:bg-blue-600 disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-md font-medium transition-colors"
                  >
                    确认
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
