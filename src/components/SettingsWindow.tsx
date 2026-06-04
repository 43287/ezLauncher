import React, { useState } from 'react';
import { useSettings } from '../hooks/useSettings';
import { SettingSchema } from '../types';

const SETTINGS_SCHEMA: SettingSchema[] = [
  {
    id: 'autoStart',
    category: '通用',
    label: '开机自启',
    description: '随系统启动时自动运行',
    type: 'switch',
    defaultValue: false,
  },
  {
    id: 'wheelReverse',
    category: '通用',
    label: '滚轮反转',
    description: '鼠标上下滚动效果反转',
    type: 'switch',
    defaultValue: false,
  },
  {
    id: 'theme',
    category: '外观',
    label: '主题模式',
    description: '选择应用外观',
    type: 'select',
    options: [
      { label: '跟随系统', value: 'system' },
      { label: '浅色', value: 'light' },
      { label: '深色', value: 'dark' },
    ],
    defaultValue: 'system',
  },
  {
    id: 'columns',
    category: '外观',
    label: '网格列数',
    description: '主界面应用列表的列数',
    type: 'input',
    defaultValue: '4',
  }
];

interface SettingsWindowProps {
  onClose: () => void;
}

export const SettingsWindow: React.FC<SettingsWindowProps> = ({ onClose }) => {
  const { settings, updateSetting } = useSettings();
  
  // 提取所有唯一分类
  const categories = Array.from(new Set(SETTINGS_SCHEMA.map(s => s.category)));
  const [activeCategory, setActiveCategory] = useState(categories[0]);
  const wheelTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  // 取消对 isLoaded 的渲染拦截，直接渲染配置窗口
  // 若尚未加载完毕，对应的控件会暂时展示 schema.defaultValue

  const renderControl = (schema: SettingSchema) => {
    const value = settings[schema.id] !== undefined ? settings[schema.id] : schema.defaultValue;

    switch (schema.type) {
      case 'switch':
        return (
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={value}
              onChange={(e) => updateSetting(schema.id, e.target.checked)}
            />
            <div className="w-10 h-5 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-blue-500 peer-focus:ring-2 peer-focus:ring-blue-300 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
          </label>
        );
      case 'input':
        return (
          <input
            type="text"
            className="w-20 bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            value={value}
            onChange={(e) => updateSetting(schema.id, e.target.value)}
          />
        );
      case 'select':
        return (
          <select
            className="bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
            value={value}
            onChange={(e) => updateSetting(schema.id, e.target.value)}
          >
            {schema.options?.map((opt) => (
              <option key={opt.value} value={opt.value}>
                {opt.label}
              </option>
            ))}
          </select>
        );
      default:
        return null;
    }
  };

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm"
      onClick={onClose}
      onWheel={(e) => e.stopPropagation()}
    >
      <div 
        className="bg-white/95 dark:bg-gray-900/95 border border-gray-200/50 dark:border-gray-700/50 rounded-2xl shadow-2xl w-[500px] h-[432px] mx-8 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header */}
        <div className="flex justify-between items-center px-6 py-3 border-b border-gray-200/50 dark:border-gray-800/50 bg-gray-50/50 dark:bg-gray-800/50">
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">设置</h2>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
            aria-label="关闭设置"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content (2 Columns) */}
        <div 
          className="flex flex-1 overflow-hidden"
          onWheel={(e) => {
            e.stopPropagation();
            // 在整个设置内容区支持滚轮切换分类，并且进行节流处理避免滚动过快
            if (!wheelTimeoutRef.current) {
              const currentIndex = categories.findIndex(c => c === activeCategory);
              if (e.deltaY > 0 && currentIndex < categories.length - 1) {
                setActiveCategory(categories[currentIndex + 1]);
              } else if (e.deltaY < 0 && currentIndex > 0) {
                setActiveCategory(categories[currentIndex - 1]);
              }
              wheelTimeoutRef.current = setTimeout(() => {
                wheelTimeoutRef.current = null;
              }, 150);
            }
          }}
        >
          {/* Left Sidebar (Categories) */}
          <div 
            className="w-1/5 border-r border-gray-200/50 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/30 p-2 space-y-1 overflow-y-auto flex flex-col items-center"
          >
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category)}
                className={`w-full text-center px-2 py-2 rounded-lg text-sm font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 ${
                  activeCategory === category 
                    ? 'bg-blue-50 dark:bg-blue-900/30 text-blue-600 dark:text-blue-400' 
                    : 'text-gray-600 dark:text-gray-400 hover:bg-gray-100 dark:hover:bg-gray-800'
                }`}
                style={{ whiteSpace: 'nowrap' }}
              >
                {category}
              </button>
            ))}
          </div>

          {/* Right Content (Settings Items) */}
          <div className="flex-1 p-4 space-y-6">
            {SETTINGS_SCHEMA.filter(schema => schema.category === activeCategory).map((schema) => (
              <div key={schema.id} className="flex justify-between items-center">
                <div className="flex items-center space-x-1">
                  <div className="text-gray-900 dark:text-gray-100 font-medium text-sm whitespace-nowrap">{schema.label}</div>
                  {schema.description && (
                    <div className="relative group flex items-center">
                      <div className="w-3.5 h-3.5 rounded-full border border-gray-400 text-gray-500 dark:border-gray-500 dark:text-gray-400 flex items-center justify-center text-[9px] font-bold cursor-help">
                        ?
                      </div>
                      <div className="absolute left-full ml-2 w-48 p-2 bg-gray-800 text-white text-xs rounded shadow-lg opacity-0 invisible group-hover:opacity-100 group-hover:visible transition-all z-10 pointer-events-none">
                        {schema.description}
                        {/* Tooltip arrow */}
                        <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-gray-800"></div>
                      </div>
                    </div>
                  )}
                </div>
                <div className="ml-4 flex-shrink-0">
                  {renderControl(schema)}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
};
