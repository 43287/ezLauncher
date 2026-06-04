import React, { useState } from "react";
import { LaunchItem } from "../types";

interface PropertiesModalProps {
  app: LaunchItem;
  onClose: () => void;
  onSave: (updatedApp: LaunchItem) => void;
}

export const PropertiesModal: React.FC<PropertiesModalProps> = ({ app, onClose, onSave }) => {
  const [activeCategory, setActiveCategory] = useState<'通用' | '图标' | '高级'>('通用');
  const categories = ['通用', '图标', '高级'];
  const wheelTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(null);

  const [name, setName] = useState(app.name);
  const [shortcut, setShortcut] = useState(app.shortcut || "");
  const [executablePath, setExecutablePath] = useState(app.executablePath || "");
  const [url, setUrl] = useState(app.url || "");
  const [iconBase64, setIconBase64] = useState(app.iconBase64 || "");
  
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
      // args, runAsAdmin could be added to LaunchItem in the future
    });
    onClose();
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
          <h2 className="text-base font-semibold text-gray-900 dark:text-gray-100">
            {app.name === "新建快捷方式" ? "添加快捷方式" : "属性设置"}
          </h2>
          <button 
            onClick={onClose} 
            className="text-gray-500 hover:text-gray-900 dark:text-gray-400 dark:hover:text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 rounded"
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
            if (!wheelTimeoutRef.current) {
              const currentIndex = categories.findIndex(c => c === activeCategory);
              if (e.deltaY > 0 && currentIndex < categories.length - 1) {
                setActiveCategory(categories[currentIndex + 1] as any);
              } else if (e.deltaY < 0 && currentIndex > 0) {
                setActiveCategory(categories[currentIndex - 1] as any);
              }
              wheelTimeoutRef.current = setTimeout(() => {
                wheelTimeoutRef.current = null;
              }, 150);
            }
          }}
        >
          {/* Left Sidebar (Categories) */}
          <div className="w-1/5 border-r border-gray-200/50 dark:border-gray-800/50 bg-gray-50/30 dark:bg-gray-800/30 p-2 space-y-1 overflow-y-auto flex flex-col items-center">
            {categories.map(category => (
              <button
                key={category}
                onClick={() => setActiveCategory(category as any)}
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

          {/* Right Content */}
          <div className="flex-1 p-4 space-y-6 overflow-y-auto">
            {activeCategory === '通用' && (
              <>
                <div className="flex justify-between items-center">
                  <div className="text-gray-900 dark:text-gray-100 font-medium text-sm whitespace-nowrap">名称</div>
                  <div className="ml-4 flex-1 max-w-[200px]">
                    <input
                      type="text"
                      value={name}
                      aria-label="名称"
                      onChange={(e) => setName(e.target.value)}
                      className="w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {app.type === 'app' && (
                  <div className="flex justify-between items-center">
                    <div className="text-gray-900 dark:text-gray-100 font-medium text-sm whitespace-nowrap">目标路径</div>
                    <div className="ml-4 flex-1 max-w-[200px]">
                      <input
                        type="text"
                        value={executablePath}
                        aria-label="目标路径"
                        onChange={(e) => setExecutablePath(e.target.value)}
                        className="w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                )}

                {app.type === 'link' && (
                  <div className="flex justify-between items-center">
                    <div className="text-gray-900 dark:text-gray-100 font-medium text-sm whitespace-nowrap">URL</div>
                    <div className="ml-4 flex-1 max-w-[200px]">
                      <input
                        type="text"
                        value={url}
                        aria-label="URL"
                        onChange={(e) => setUrl(e.target.value)}
                        className="w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                      />
                    </div>
                  </div>
                )}
                {app.type === 'app' && (
                  <div className="flex justify-between items-start">
                    <div className="text-gray-900 dark:text-gray-100 font-medium text-sm whitespace-nowrap pt-1">启动参数</div>
                    <div className="ml-4 flex-1 max-w-[200px]">
                      <textarea
                        value={args}
                        aria-label="启动参数"
                        onChange={(e) => setArgs(e.target.value)}
                        placeholder="如: --hidden\n每行一个参数"
                        rows={3}
                        className="w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 resize-none"
                      />
                    </div>
                  </div>
                )}
              </>
            )}

            {activeCategory === '图标' && (
              <div className="flex flex-col items-center space-y-4">
                <div className="w-20 h-20 bg-gray-100 dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-2xl flex items-center justify-center overflow-hidden shadow-inner">
                  {iconBase64 ? (
                    <img src={iconBase64} alt="Preview" className="w-16 h-16 object-contain" />
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
                      value={iconBase64}
                      aria-label="图标 URL 或 Base64"
                      onChange={(e) => setIconBase64(e.target.value)}
                      placeholder="手动输入图片 URL 或 Base64"
                      className="w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1.5 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                    <div className="flex space-x-2">
                      <button 
                        className="flex-1 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-gray-100 dark:bg-gray-800 hover:bg-gray-200 dark:hover:bg-gray-700 rounded transition-colors"
                        onClick={() => {
                          // TODO: 接入系统文件选择器
                        }}
                      >
                        浏览本地图片...
                      </button>
                      <button 
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-50 dark:bg-red-900/20 hover:bg-red-100 dark:hover:bg-red-900/40 rounded transition-colors"
                        onClick={() => setIconBase64("")}
                      >
                        清除
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {activeCategory === '高级' && (
              <>
                <div className="flex justify-between items-center">
                  <div className="text-gray-900 dark:text-gray-100 font-medium text-sm whitespace-nowrap">全局快捷键</div>
                  <div className="ml-4 flex-1 max-w-[200px]">
                    <input
                      type="text"
                      value={shortcut}
                      aria-label="全局快捷键"
                      onChange={(e) => setShortcut(e.target.value)}
                      placeholder="如: Ctrl+Shift+A"
                      className="w-full bg-transparent border border-gray-300 dark:border-gray-600 rounded px-2 py-1 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400"
                    />
                  </div>
                </div>

                {app.type === 'app' && (
                  <>
                    <div className="flex justify-between items-center">
                      <div className="text-gray-900 dark:text-gray-100 font-medium text-sm whitespace-nowrap">管理员权限</div>
                      <div className="ml-4 flex-shrink-0">
                        <label className="relative inline-flex items-center cursor-pointer">
                          <input
                            type="checkbox"
                            className="sr-only peer"
                            aria-label="管理员权限"
                            checked={runAsAdmin}
                            onChange={(e) => setRunAsAdmin(e.target.checked)}
                          />
                          <div className="w-10 h-5 bg-gray-300 dark:bg-gray-600 rounded-full peer peer-checked:bg-blue-500 peer-focus:ring-2 peer-focus:ring-blue-300 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-4 after:w-4 after:transition-all peer-checked:after:translate-x-full"></div>
                        </label>
                      </div>
                    </div>
                  </>
                )}
              </>
            )}
          </div>
        </div>

        {/* Footer */}
        <div className="px-6 py-2.5 border-t border-gray-200/50 dark:border-gray-800/50 flex justify-end space-x-3 bg-gray-50/50 dark:bg-gray-800/50">
          <button
            onClick={onClose}
            className="px-4 py-1.5 text-sm font-medium text-gray-700 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-700 rounded-lg transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-400"
          >
            取消
          </button>
          <button
            onClick={handleSave}
            className="px-4 py-1.5 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors shadow-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          >
            保存
          </button>
        </div>
      </div>
    </div>
  );
};
