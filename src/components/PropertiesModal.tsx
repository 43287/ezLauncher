import React, { useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { LaunchItem } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface PropertiesModalProps {
  app: LaunchItem;
  onClose: () => void;
  onSave: (updatedApp: LaunchItem) => void;
}

// 提取的 UI 小组件
const InputGroup: React.FC<{
  label: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  multiline?: boolean;
}> = ({ label, value, onChange, placeholder, multiline }) => (
  <div className={cn("flex flex-col gap-1.5", multiline ? "items-start" : "items-start")}>
    <label className={cn("text-gray-900 dark:text-gray-100 font-medium text-xs ml-0.5", multiline && "pt-1")}>
      {label}
    </label>
    <div className="w-full">
      {multiline ? (
        <textarea
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          rows={3}
          className="w-full bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none transition-colors"
        />
      ) : (
        <input
          type="text"
          value={value}
          aria-label={label}
          onChange={(e) => onChange(e.target.value)}
          placeholder={placeholder}
          className="w-full bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
        />
      )}
    </div>
  </div>
);

const ToggleGroup: React.FC<{
  label: string;
  checked: boolean;
  onChange: (val: boolean) => void;
}> = ({ label, checked, onChange }) => (
  <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 px-3 h-11 rounded-md">
    <div className="text-gray-900 dark:text-gray-100 font-medium text-sm whitespace-nowrap">{label}</div>
    <div className="ml-4 flex-shrink-0 flex items-center">
      <label className="relative inline-flex items-center cursor-pointer">
        <input
          type="checkbox"
          className="sr-only peer"
          aria-label={label}
          checked={checked}
          onChange={(e) => onChange(e.target.checked)}
        />
        <div className="w-9 h-5 bg-black/10 dark:bg-white/10 rounded-full peer peer-checked:bg-blue-500 peer-focus-visible:ring-2 peer-focus-visible:ring-blue-400 peer-focus-visible:ring-offset-2 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-black/5 after:border after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-[16px] shadow-inner"></div>
      </label>
    </div>
  </div>
);

export const PropertiesModal: React.FC<PropertiesModalProps> = ({ app, onClose, onSave }) => {
  const [activeCategory, setActiveCategory] = useState<'通用' | '图标' | '高级'>('通用');
  const categories = ['通用', '图标', '高级'];
  const wheelTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  React.useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const [name, setName] = useState(app.name);
  const [shortcut, setShortcut] = useState(app.shortcut || "");
  const [executablePath, setExecutablePath] = useState(app.executablePath || "");
  const [url, setUrl] = useState(app.url || "");
  const [iconBase64, setIconBase64] = useState(app.iconBase64 || "");
  const [iconUrl, setIconUrl] = useState(app.iconUrl || "");
  
  // 附加参数 (mock properties for the future)
  const [args, setArgs] = useState("");
  const [runAsAdmin, setRunAsAdmin] = useState(false);

  const handleSave = () => {
    onSave({
      ...app,
      name,
      shortcut: shortcut || null,
      executablePath,
      url,
      iconBase64,
      iconUrl,
      // args, runAsAdmin could be added to LaunchItem in the future
    });
    handleClose();
  };

  return (
    <div 
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${isClosing || !isVisible ? 'opacity-0' : 'opacity-100'}`}
      onClick={handleClose}
      onWheel={(e) => e.stopPropagation()}
    >
      <div 
        className={`bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-soft-lg rounded-xl w-full max-w-[90%] sm:max-w-[400px] mx-4 sm:mx-8 flex flex-col overflow-hidden ${isClosing || !isVisible ? 'animate-fade-down-scale' : 'animate-fade-up-scale'}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Header - 横向 Tab */}
        <div 
          className="flex justify-between items-center px-4 py-2 bg-transparent"
          onWheel={(e) => {
            e.stopPropagation();
            if (!wheelTimeoutRef.current) {
              const currentIndex = categories.findIndex(c => c === activeCategory);
              if (e.deltaY > 0 && currentIndex < categories.length - 1) {
                setActiveCategory(categories[currentIndex + 1] as '通用' | '图标' | '高级');
              } else if (e.deltaY < 0 && currentIndex > 0) {
                setActiveCategory(categories[currentIndex - 1] as '通用' | '图标' | '高级');
              }
              wheelTimeoutRef.current = setTimeout(() => {
                wheelTimeoutRef.current = null;
              }, 150);
            }
          }}
        >
          <div className="flex gap-1">
            {categories.map(category => (
              <button
                key={category}
                type="button"
                onClick={() => setActiveCategory(category as '通用' | '图标' | '高级')}
                className={`px-3 py-1.5 rounded-md text-xs font-medium transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 focus-visible:ring-offset-2 ${
                  activeCategory === category 
                    ? 'bg-black/5 dark:bg-white/10 text-gray-900 dark:text-gray-100' 
                    : 'text-gray-500 dark:text-gray-400 hover:bg-black/5 dark:hover:bg-white/10'
                }`}
              >
                {category}
              </button>
            ))}
          </div>
          
          <div className="flex items-center gap-2">
            <button 
              type="button"
              onClick={handleClose} 
              className="w-7 h-7 flex items-center justify-center text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400 rounded-md"
              title="取消"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div 
          className="flex flex-col p-4 bg-transparent rounded-b-xl overflow-hidden" 
          onWheel={(e) => {
            e.stopPropagation();
            if (!wheelTimeoutRef.current) {
              const currentIndex = categories.findIndex(c => c === activeCategory);
              if (e.deltaY > 0 && currentIndex < categories.length - 1) {
                setActiveCategory(categories[currentIndex + 1] as '通用' | '图标' | '高级');
              } else if (e.deltaY < 0 && currentIndex > 0) {
                setActiveCategory(categories[currentIndex - 1] as '通用' | '图标' | '高级');
              }
              wheelTimeoutRef.current = setTimeout(() => {
                wheelTimeoutRef.current = null;
              }, 150);
            }
          }}
        >
          <div className="flex-1 overflow-y-auto scrollbar-hidden">
            <div className="grid grid-cols-1 grid-rows-1 min-h-full">
              <div className={activeCategory === '通用' ? 'col-start-1 row-start-1 flex flex-col h-full' : 'col-start-1 row-start-1 flex flex-col h-full invisible pointer-events-none'}>
                <div className="space-y-4">
                  <InputGroup label="名称" value={name} onChange={setName} />

                  {app.type === 'app' && (
                    <InputGroup label="目标路径" value={executablePath} onChange={setExecutablePath} multiline />
                  )}

                  {app.type === 'link' && (
                    <InputGroup label="URL" value={url} onChange={setUrl} />
                  )}

                  {app.type === 'app' && (
                    <InputGroup 
                      label="启动参数" 
                      value={args} 
                      onChange={setArgs} 
                      placeholder="如: --hidden\n每行一个参数" 
                      multiline 
                    />
                  )}
                </div>
                
                <div className="mt-auto pt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors apple-ease shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    保存
                  </button>
                </div>
              </div>

              <div className={activeCategory === '图标' ? 'col-start-1 row-start-1 flex flex-col h-full' : 'col-start-1 row-start-1 flex flex-col h-full invisible pointer-events-none'}>
                <div className="flex flex-col items-center space-y-4">
                  <div className="w-20 h-20 bg-black/5 dark:bg-white/5 border border-black/5 dark:border-white/10 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner">
                    {iconUrl || iconBase64 ? (
                      <img src={iconUrl || iconBase64} alt="Preview" className="w-16 h-16 object-contain" />
                    ) : (
                      <span className="text-3xl text-gray-400 font-bold">
                        {name ? name.charAt(0).toUpperCase() : '?'}
                      </span>
                    )}
                  </div>
                  
                  <div className="w-full space-y-2">
                    <label className="block text-xs text-center text-gray-500 dark:text-gray-400">
                      默认将尝试从目标路径自动提取图标
                    </label>
                    <div className="flex flex-col space-y-2">
                      <input
                        type="text"
                        value={(iconUrl && iconUrl.startsWith('http://ezicon.localhost/')) ? decodeURIComponent(iconUrl.replace('http://ezicon.localhost/', '')) : (iconUrl || iconBase64)}
                        aria-label="图标 URL 或 Base64"
                        onChange={(e) => {
                          const val = e.target.value;
                          if (val.startsWith("data:")) {
                            setIconBase64(val);
                            setIconUrl("");
                          } else {
                            // 如果用户输入了普通路径，且不是 http 或 ezicon 开头，尝试将其转换为 ezicon
                            if (val && !val.startsWith("http") && !val.startsWith("ezicon:")) {
                              const encodedPath = encodeURIComponent(val).replace(/['()]/g, escape).replace(/\*/g, '%2A');
                              setIconUrl(`http://ezicon.localhost/${encodedPath}`);
                            } else {
                              setIconUrl(val);
                            }
                            setIconBase64("");
                          }
                        }}
                        placeholder="手动输入图片 URL、路径或 Base64"
                        className="w-full bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
                      />
                      <div className="flex space-x-2">
                        <button 
                          className="flex-1 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-md transition-colors apple-ease"
                          onClick={() => {
                            // TODO: 接入系统文件选择器
                          }}
                        >
                          浏览本地图片...
                        </button>
                        <button 
                          className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors apple-ease"
                          onClick={() => { setIconBase64(""); setIconUrl(""); }}
                        >
                          清除
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
                
                <div className="mt-auto pt-6 flex justify-end w-full">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors apple-ease shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    保存
                  </button>
                </div>
              </div>

              <div className={activeCategory === '高级' ? 'col-start-1 row-start-1 flex flex-col h-full' : 'col-start-1 row-start-1 flex flex-col h-full invisible pointer-events-none'}>
                <div className="space-y-4">
                  <InputGroup 
                    label="全局快捷键" 
                    value={shortcut} 
                    onChange={setShortcut} 
                    placeholder="如: Ctrl+Shift+A" 
                  />

                  {app.type === 'app' && (
                    <ToggleGroup 
                      label="管理员权限" 
                      checked={runAsAdmin} 
                      onChange={setRunAsAdmin} 
                    />
                  )}
                </div>
                
                <div className="mt-auto pt-6 flex justify-end">
                  <button
                    type="button"
                    onClick={handleSave}
                    className="px-4 py-1.5 text-xs font-medium text-white bg-blue-500 hover:bg-blue-600 rounded-md transition-colors apple-ease shadow-soft focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2"
                  >
                    保存
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
