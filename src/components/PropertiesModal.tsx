import React, { useState } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import * as LucideIcons from "lucide-react";
import { LaunchItem } from "../types";
import { ShortcutCatcher } from "./ShortcutCatcher";
import { resolveIcon } from "../utils/icons";
import { IconPickerModal } from "./IconPickerModal";

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
  multiline?: boolean;
  tooltip?: string;
}> = ({ label, value, onChange, multiline, tooltip }) => (
  <div className={cn("flex flex-col gap-1.5", multiline ? "items-start" : "items-start")}>
    <div className="flex items-center">
      <label className={cn("text-gray-900 dark:text-gray-100 font-medium text-xs ml-0.5", multiline && "pt-1")}>
        {label}
      </label>
      {tooltip && (
        <div className="group flex items-center ml-1">
          <svg className="w-3.5 h-3.5 text-gray-400 hover:text-blue-500 transition-colors cursor-help" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
          <div className="fixed hidden group-hover:block w-48 p-2 bg-gray-900 text-white text-[10px] leading-relaxed rounded-md shadow-lg z-[9999] whitespace-normal mt-6">
            {tooltip.split('\\n').map((line, i) => (
              <React.Fragment key={i}>
                {line}
                {i !== tooltip.split('\\n').length - 1 && <br />}
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </div>
    <div className="w-full">
      {multiline ? (
        <textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors custom-scrollbar"
          style={{ minHeight: '80px', maxHeight: '200px', resize: 'vertical' }}
        />
      ) : (
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
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
  const [iconUrl, setIconUrl] = useState(app.iconUrl || "");
  const [isIconPickerOpen, setIsIconPickerOpen] = useState(false);
  
  // 附加参数
  const [args, setArgs] = useState(app.args || "");
  const [cwd, setCwd] = useState(app.cwd || "");
  const [envVariables, setEnvVariables] = useState(app.envVariables || "");
  const [runAsAdmin, setRunAsAdmin] = useState(app.runAsAdmin || false);

  // 脚本专属参数
  const [scriptPath, setScriptPath] = useState(app.type === 'script' ? (app.args || "") : "");
  const [executorPath, setExecutorPath] = useState(app.type === 'script' ? (app.executablePath || "") : "");

  // 命令专属参数
  const [commandText, setCommandText] = useState(app.type === 'command' ? (app.args || "") : "");
  const [shell, setShell] = useState<'pwsh' | 'cmd' | 'bash'>(
    app.type === 'command' ? ((app.executablePath as any) || 'pwsh') : 'pwsh'
  );
  const [inTerminal, setInTerminal] = useState(app.type === 'command' ? (app.inTerminal || false) : false);

  const handleScriptPathChange = (path: string) => {
    setScriptPath(path);
    // 尝试自动匹配执行器
    if (!executorPath) {
      const lowerPath = path.toLowerCase();
      if (lowerPath.endsWith('.py')) {
        setExecutorPath('python.exe');
      } else if (lowerPath.endsWith('.js')) {
        setExecutorPath('node.exe');
      } else if (lowerPath.endsWith('.bat') || lowerPath.endsWith('.cmd')) {
        setExecutorPath('cmd.exe');
      } else if (lowerPath.endsWith('.ps1')) {
        setExecutorPath('powershell.exe');
      } else if (lowerPath.endsWith('.sh')) {
        setExecutorPath('bash.exe');
      } else if (lowerPath.endsWith('.lua')) {
        setExecutorPath('lua.exe');
      }
    }
    // 尝试自动填充名称
    if (!name && path) {
      const match = path.match(/[^\\/]+$/);
      if (match) {
        setName(match[0].replace(/\.[^/.]+$/, ""));
      }
    }
  };

  const handleSave = () => {
    const finalApp = {
      ...app,
      name,
      shortcut: shortcut || null,
      iconUrl,
      cwd,
      envVariables,
      runAsAdmin,
    };

    if (app.type === 'script') {
      finalApp.executablePath = executorPath;
      finalApp.args = scriptPath;
      if (!finalApp.cwd) {
        finalApp.cwd = "{target_path}"; // 默认起始位置为目标路径
      }
    } else if (app.type === 'command') {
      finalApp.executablePath = shell;
      finalApp.args = commandText;
      finalApp.inTerminal = inTerminal;
    } else {
      finalApp.executablePath = executablePath;
      finalApp.url = url;
      finalApp.args = args;
    }

    onSave(finalApp);
    handleClose();
  };

  const resolvedIcon = resolveIcon(app.isDir ? 'dir_fallback_icon' : iconUrl);

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
            // Only switch tabs if not scrolling inside a textarea
            const target = e.target as HTMLElement;
            if (target.tagName.toLowerCase() === 'textarea') {
              e.stopPropagation();
              return;
            }
            
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

                  {(app.type === 'app' || app.isDir) && (
                    <InputGroup label="目标路径" value={executablePath} onChange={setExecutablePath} multiline />
                  )}

                  {app.type === 'link' && (
                    <InputGroup label="URL" value={url} onChange={setUrl} />
                  )}

                  {app.type === 'script' && (
                    <>
                      <InputGroup 
                        label="脚本文件路径" 
                        value={scriptPath} 
                        onChange={handleScriptPathChange} 
                        multiline 
                      />
                      <InputGroup 
                        label="执行器路径" 
                        value={executorPath} 
                        onChange={setExecutorPath} 
                      />
                    </>
                  )}

                  {app.type === 'command' && (
                    <InputGroup
                      label="执行命令"
                      value={commandText}
                      onChange={setCommandText}
                      multiline
                    />
                  )}

                  {(app.type === 'app' || app.isDir) && (
                    <InputGroup 
                      label="启动参数" 
                      value={args} 
                      onChange={setArgs} 
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
                    {resolvedIcon?.type === 'lucide' ? (
                      <div className="w-12 h-12 flex items-center justify-center text-gray-800 dark:text-gray-200">
                        {React.createElement((LucideIcons as any)[resolvedIcon.content] || LucideIcons.HelpCircle, { size: '100%', strokeWidth: 1.5 })}
                      </div>
                    ) : resolvedIcon?.type === 'svg' ? (
                      <div 
                        className={`w-16 h-16 flex items-center justify-center [&>svg]:w-full [&>svg]:h-full ${app.isDir ? 'drop-shadow-sm' : ''}`}
                        dangerouslySetInnerHTML={{ __html: resolvedIcon.content }}
                      />
                    ) : resolvedIcon?.type === 'url' ? (
                      <img 
                        src={resolvedIcon.content} 
                        alt="Preview" 
                        className="w-16 h-16 object-contain" 
                      />
                    ) : (
                      <span className="text-3xl text-gray-400 font-bold">
                        {name ? name.charAt(0).toUpperCase() : '?'}
                      </span>
                    )}
                  </div>
                  
                  <div className="w-full space-y-2 flex flex-col items-center">
                    <div className="flex space-x-2 w-full max-w-[250px] mt-2">
                      <button 
                        className="flex-1 py-1.5 text-xs font-medium text-gray-700 dark:text-gray-200 bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 rounded-md transition-colors apple-ease"
                        onClick={() => setIsIconPickerOpen(true)}
                      >
                        更改图标...
                      </button>
                      <button 
                        className="px-3 py-1.5 text-xs font-medium text-red-600 bg-red-500/10 hover:bg-red-500/20 rounded-md transition-colors apple-ease"
                        onClick={() => setIconUrl("")}
                      >
                        清除
                      </button>
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
                  <div className="flex flex-col gap-1.5 items-start">
                    <label className="text-gray-900 dark:text-gray-100 font-medium text-xs ml-0.5">
                      全局快捷键
                    </label>
                    <ShortcutCatcher
                      value={shortcut}
                      onChange={setShortcut}
                    />
                  </div>

                  {app.type === 'command' && (
                    <div className="flex flex-col gap-1.5 items-start">
                      <label className="text-gray-900 dark:text-gray-100 font-medium text-xs ml-0.5">
                        Shell
                      </label>
                      <select
                        value={shell}
                        onChange={(e) => setShell(e.target.value as any)}
                        className="w-full bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
                      >
                        <option value="pwsh" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">PowerShell 7 (pwsh)</option>
                        <option value="powershell" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Windows PowerShell</option>
                        <option value="cmd" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Command Prompt (cmd)</option>
                        <option value="bash" className="bg-white dark:bg-gray-800 text-gray-900 dark:text-gray-100">Bash</option>
                      </select>
                    </div>
                  )}

                  {(app.type === 'app' || app.type === 'script' || app.type === 'command' || app.isDir) && (
                    <>
                      <InputGroup 
                        label="起始位置 (CWD)" 
                        value={cwd} 
                        onChange={setCwd} 
                      />

                      <InputGroup 
                        label="环境变量" 
                        value={envVariables} 
                        onChange={setEnvVariables} 
                        multiline
                      />

                      {app.type === 'command' && (
                        <ToggleGroup 
                          label="以终端进程启动" 
                          checked={inTerminal} 
                          onChange={setInTerminal} 
                        />
                      )}

                      <ToggleGroup 
                        label="管理员权限" 
                        checked={runAsAdmin} 
                        onChange={setRunAsAdmin} 
                      />
                    </>
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
      
      {isIconPickerOpen && (
        <IconPickerModal
          initialIconUrl={iconUrl}
          onClose={() => setIsIconPickerOpen(false)}
          onSelect={(url) => {
            setIconUrl(url);
            setIsIconPickerOpen(false);
          }}
        />
      )}
    </div>
  );
};
