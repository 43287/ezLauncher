import React, { useState, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useDataStore } from '../store/useDataStore';
import { SettingSchema } from '../types';
import { ShortcutCatcher } from './ShortcutCatcher';

const SETTINGS_SCHEMA: SettingSchema[] = [
  {
    id: 'summonShortcut',
    category: '快捷键管理',
    label: '键盘呼出',
    description: '全局键盘快捷键，用于快速唤醒 ezLaunch 面板',
    type: 'shortcut',
    defaultValue: 'Alt+Space',
  },
  {
    id: 'summonMouseShortcut',
    category: '快捷键管理',
    label: '鼠标呼出',
    description: '全局鼠标快捷键，用于快速唤醒 ezLaunch 面板',
    type: 'shortcut',
    defaultValue: 'Mouse4',
  },
  {
    id: 'autoStart',
    category: '通用',
    label: '开机自启',
    description: '随系统启动时自动运行',
    type: 'switch',
    defaultValue: false,
  },
  {
    id: 'dockPosition',
    category: '通用',
    label: '侧边停靠',
    description: '选择主窗口贴靠在屏幕的哪一边',
    type: 'select',
    options: [
      { label: '靠右', value: 'right' },
      { label: '靠左', value: 'left' },
    ],
    defaultValue: 'right',
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
    description: '主界面应用列表的列数 (1-12)',
    type: 'input',
    defaultValue: '4',
  }
];

interface SettingsWindowProps {
  onClose: () => void;
}

export const SettingsWindow: React.FC<SettingsWindowProps> = ({ onClose }) => {
  const { settings, updateSetting, apps } = useDataStore();
  
  // 提取应用自身配置的快捷键
  const appShortcuts = apps
    .filter(app => app.shortcut)
    .map(app => ({
      id: `shortcut_${app.id}`,
      category: '快捷键管理',
      label: `启动 ${app.name}`,
      description: `用于快速启动 ${app.name}`,
      type: 'readonly_shortcut' as any,
      defaultValue: app.shortcut,
      appId: app.id
    }));

  const fullSchema = [...appShortcuts, ...SETTINGS_SCHEMA];
  
  // 提取所有唯一分类，并排序（确保"快捷键管理"在合适位置）
  const categories = Array.from(new Set(fullSchema.map(s => s.category)));
  // 我们强制把快捷键管理放在通用后面，或者就保持目前的顺序（按声明顺序，所以把 appShortcuts 放在后面或者手动指定顺序）
  const orderedCategories = ['通用', '快捷键管理', '外观'].filter(c => categories.includes(c));
  const finalCategories = Array.from(new Set([...orderedCategories, ...categories]));

  const [activeCategory, setActiveCategory] = useState(finalCategories[0]);
  const wheelTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [isVisible, setIsVisible] = useState(false);
  const [isClosing, setIsClosing] = useState(false);
  const [tooltipData, setTooltipData] = useState<{ text: string; x: number; y: number } | null>(null);

  useEffect(() => {
    const timer = requestAnimationFrame(() => setIsVisible(true));
    return () => cancelAnimationFrame(timer);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const handleMouseEnter = (e: React.MouseEvent, text: string) => {
    const rect = e.currentTarget.getBoundingClientRect();
    setTooltipData({
      text,
      x: rect.right + 8,
      y: rect.top + rect.height / 2
    });
  };

  const handleMouseLeave = () => {
    setTooltipData(null);
  };

  // 取消对 isLoaded 的渲染拦截，直接渲染配置窗口
  // 若尚未加载完毕，对应的控件会暂时展示 schema.defaultValue

  const renderControl = (schema: SettingSchema) => {
    const key = schema.id as keyof typeof settings;
    const value = settings[key] !== undefined ? settings[key] : schema.defaultValue;

    switch (schema.type) {
      case 'switch':
        return (
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={value as boolean}
              onChange={(e) => updateSetting(key as any, e.target.checked as any)}
            />
            <div className="w-9 h-5 bg-black/10 dark:bg-white/10 rounded-full peer peer-checked:bg-blue-500 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400 peer-focus-visible:ring-offset-2 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-black/5 after:border after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-[16px] shadow-inner"></div>
          </label>
        );
      case 'input':
        return (
          <input
            type="text"
            className="w-20 bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-md px-2 py-1 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
            value={value as string}
            onChange={(e) => {
              if (schema.id === 'columns') {
                const parsed = parseInt(e.target.value);
                if (!isNaN(parsed) && parsed >= 1 && parsed <= 12) {
                  updateSetting(schema.id as any, parsed);
                } else if (e.target.value === '') {
                  // Allow clearing temporarily while typing
                }
              } else {
                updateSetting(schema.id as any, e.target.value);
              }
            }}
          />
        );
      case 'select':
        return (
          <div className="relative">
            <select
              className="appearance-none pr-6 bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-md px-2 py-1 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors cursor-pointer"
              value={value as string}
              onChange={(e) => updateSetting(key, e.target.value)}
            >
              {schema.options?.map((opt) => (
                <option key={opt.value} value={opt.value} className="bg-white dark:bg-gray-800">
                  {opt.label}
                </option>
              ))}
            </select>
            <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
              <svg className="w-3 h-3" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7"></path></svg>
            </div>
          </div>
        );
      case 'shortcut':
        return (
          <ShortcutCatcher
            value={value as string}
            onChange={(val) => updateSetting(key, val)}
            defaultValue={schema.defaultValue as string}
          />
        );
      case 'readonly_shortcut':
        return (
          <div className="flex items-center space-x-2">
            <span className="text-xs font-mono bg-black/5 dark:bg-white/10 px-2 py-1 rounded-md text-gray-700 dark:text-gray-300">
              {schema.defaultValue as string}
            </span>
          </div>
        );
      default:
        return null;
    }
  };

  return (
    <>
      <div 
        className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${isVisible && !isClosing ? 'opacity-100' : 'opacity-0'}`}
        onClick={handleClose}
        onWheel={(e) => e.stopPropagation()}
      >
        <div 
          className={`bg-white/80 dark:bg-gray-900/80 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-soft-lg rounded-xl w-full max-w-[90%] sm:max-w-[400px] mx-4 sm:mx-8 flex flex-col overflow-hidden ${isVisible && !isClosing ? 'animate-fade-up-scale' : 'animate-fade-down-scale'}`}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header - 横向 Tab + 占位 (无保存) */}
          <div className="flex justify-between items-center px-4 py-2 bg-transparent">
            <div className="flex gap-1 overflow-x-auto scrollbar-hidden">
              {finalCategories.map(category => (
                <button
                  key={category}
                  onClick={() => setActiveCategory(category)}
                  className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 whitespace-nowrap ${
                    activeCategory === category 
                      ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-gray-100' 
                      : 'text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10'
                  }`}
                >
                  {category}
                </button>
              ))}
            </div>
            
            <div className="flex items-center ml-2">
              <button
                onClick={handleClose}
                className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded-md"
                aria-label="关闭设置"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          </div>

          <div 
            className="flex flex-col p-4 bg-transparent rounded-b-xl overflow-hidden" 
            onWheel={(e) => {
              e.stopPropagation();
              if (!wheelTimeoutRef.current) {
                const currentIndex = finalCategories.findIndex(c => c === activeCategory);
                if (e.deltaY > 0 && currentIndex < finalCategories.length - 1) {
                  setActiveCategory(finalCategories[currentIndex + 1]);
                } else if (e.deltaY < 0 && currentIndex > 0) {
                  setActiveCategory(finalCategories[currentIndex - 1]);
                }
                wheelTimeoutRef.current = setTimeout(() => {
                  wheelTimeoutRef.current = null;
                }, 150);
              }
            }}
          >
            <div className="flex-1 overflow-y-auto scrollbar-hidden pr-1">
              <div className="grid grid-cols-1 grid-rows-1">
                {finalCategories.map((category) => (
                  <div key={category} className={activeCategory === category ? 'col-start-1 row-start-1 space-y-4' : 'col-start-1 row-start-1 space-y-4 invisible pointer-events-none'}>
                    {fullSchema.filter(schema => schema.category === category).map((schema) => (
                      <div key={schema.id} className="flex justify-between items-center bg-black/5 dark:bg-white/5 px-3 h-11 rounded-md">
                        <div className="flex items-center space-x-1">
                          <div className="text-gray-900 dark:text-gray-100 font-medium text-xs whitespace-nowrap">{schema.label}</div>
                          {schema.description && (
                            <div 
                              className="relative flex items-center"
                              onMouseEnter={(e) => handleMouseEnter(e, schema.description!)}
                              onMouseLeave={handleMouseLeave}
                            >
                              <div className="w-3.5 h-3.5 rounded-full border border-gray-400 text-gray-500 dark:border-gray-500 dark:text-gray-400 flex items-center justify-center text-[9px] font-bold cursor-help ml-1">
                                ?
                              </div>
                            </div>
                          )}
                        </div>
                        <div className="ml-4 flex-shrink-0 flex items-center">
                          {renderControl(schema)}
                        </div>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
      {tooltipData && createPortal(
        <div 
          className="fixed z-[60] p-2 bg-gray-800 text-white text-xs rounded shadow-lg pointer-events-none transition-opacity"
          style={{
            left: tooltipData.x,
            top: tooltipData.y,
            transform: 'translateY(-50%)',
            maxWidth: '200px',
            wordWrap: 'break-word'
          }}
        >
          {tooltipData.text}
          <div className="absolute top-1/2 -left-1 -mt-1 border-4 border-transparent border-r-gray-800"></div>
        </div>,
        document.body
      )}
    </>
  );
};
