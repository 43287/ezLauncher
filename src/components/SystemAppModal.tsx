import React, { useState, useEffect, useMemo, useRef } from "react";
import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { useVirtualizer } from "@tanstack/react-virtual";
import { tauriApi } from "../api/tauri";
import { useAppStore } from "../store/useAppStore";
import { LaunchItem } from "../types";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface SystemApp {
  name: string;
  path: string;
  iconUrl: string;
}

interface SystemAppModalProps {
  onClose: () => void;
}

export const SystemAppModal: React.FC<SystemAppModalProps> = ({ onClose }) => {
  const [isClosing, setIsClosing] = useState(false);
  const [isVisible, setIsVisible] = useState(false);
  const [apps, setApps] = useState<SystemApp[]>([]);
  const [searchQuery, setSearchQuery] = useState("");
  const [isLoading, setIsLoading] = useState(true);

  const { addApp, activeLeftTab, activeTopTab } = useAppStore();

  useEffect(() => {
    setIsVisible(true);

    // 获取系统应用
    tauriApi
      .getSystemApps()
      .then((fetchedApps) => {
        setApps(fetchedApps);
        setIsLoading(false);
      })
      .catch((err) => {
        console.error("Failed to fetch system apps", err);
        setIsLoading(false);
      });
  }, []);

  const handleClose = () => {
    setIsClosing(true);
    setTimeout(() => {
      onClose();
    }, 200);
  };

  const filteredApps = useMemo(() => {
    const query = searchQuery.toLowerCase().trim();
    if (!query) return apps;

    return apps.filter(
      (app) =>
        app.name.toLowerCase().includes(query) ||
        app.path.toLowerCase().includes(query),
    );
  }, [apps, searchQuery]);

  const parentRef = useRef<HTMLDivElement>(null);

  const rowVirtualizer = useVirtualizer({
    count: filteredApps.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => 56,
    overscan: 5,
  });

  const handleSelectApp = (app: SystemApp) => {
    const newApp: LaunchItem = {
      id: Date.now().toString(),
      name: app.name,
      type: "app",
      shortcut: null,
      executablePath: app.path,
      iconUrl: app.iconUrl,
      categoryId: activeLeftTab,
      columnId: activeTopTab,
    };

    addApp(newApp);
    handleClose();
  };

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center bg-black/40 backdrop-blur-sm transition-opacity duration-200 ${isClosing || !isVisible ? "opacity-0" : "opacity-100"}`}
      onClick={handleClose}
      onWheel={(e) => e.stopPropagation()}
    >
      <div
        className={`bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl border border-black/5 dark:border-white/10 shadow-soft-lg rounded-xl w-full max-w-[90%] sm:max-w-[400px] h-[500px] mx-4 sm:mx-8 flex flex-col overflow-hidden ${isClosing || !isVisible ? "animate-fade-down-scale" : "animate-fade-up-scale"}`}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Search */}
        <div className="p-3 bg-transparent border-b border-black/5 dark:border-white/10">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="搜索系统程序..."
            className="w-full bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-md px-3 py-2 text-gray-900 dark:text-gray-100 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
            autoFocus
          />
        </div>

        {/* Content */}
        <div 
          ref={parentRef}
          className="flex-1 overflow-y-auto custom-scrollbar"
        >
          {isLoading ? (
            <div className="flex justify-center items-center h-full text-sm text-gray-500 dark:text-gray-400">
              <svg
                className="animate-spin -ml-1 mr-2 h-4 w-4 text-gray-500"
                xmlns="http://www.w3.org/2000/svg"
                fill="none"
                viewBox="0 0 24 24"
              >
                <circle
                  className="opacity-25"
                  cx="12"
                  cy="12"
                  r="10"
                  stroke="currentColor"
                  strokeWidth="4"
                ></circle>
                <path
                  className="opacity-75"
                  fill="currentColor"
                  d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
                ></path>
              </svg>
              加载中...
            </div>
          ) : filteredApps.length > 0 ? (
            <div 
              className="relative w-full"
              style={{ height: `${rowVirtualizer.getTotalSize()}px` }}
            >
              {rowVirtualizer.getVirtualItems().map((virtualItem) => {
                const app = filteredApps[virtualItem.index];
                return (
                  <div
                    key={virtualItem.key}
                    className="absolute top-0 left-0 w-full px-2 py-[2px]"
                    style={{
                      height: `${virtualItem.size}px`,
                      transform: `translateY(${virtualItem.start}px)`,
                    }}
                  >
                    <button
                      onClick={() => handleSelectApp(app)}
                      className="w-full h-full flex items-center gap-3 p-2 hover:bg-black/5 dark:hover:bg-white/10 rounded-lg transition-colors text-left group"
                    >
                      <div className="w-8 h-8 flex-shrink-0 bg-black/5 dark:bg-white/5 rounded-md flex items-center justify-center overflow-hidden">
                        {app.iconUrl ? (
                          <img
                            src={app.iconUrl}
                            alt={app.name}
                            className="w-6 h-6 object-contain"
                            onError={(e) => {
                              e.currentTarget.style.display = "none";
                            }}
                          />
                        ) : (
                          <span className="text-xs text-gray-500 font-bold">
                            {app.name.charAt(0)}
                          </span>
                        )}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 dark:text-gray-100 truncate">
                          {app.name}
                        </div>
                        <div className="text-xs text-gray-500 dark:text-gray-400 truncate opacity-70">
                          {app.path}
                        </div>
                      </div>
                      <div className="opacity-0 group-hover:opacity-100 text-blue-500 mr-2 transition-opacity">
                        <svg
                          className="w-4 h-4"
                          fill="none"
                          stroke="currentColor"
                          viewBox="0 0 24 24"
                        >
                          <path
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeWidth={2}
                            d="M12 4v16m8-8H4"
                          />
                        </svg>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <div className="flex justify-center items-center h-full text-sm text-gray-500 dark:text-gray-400">
              未找到相关程序
            </div>
          )}
        </div>
      </div>
    </div>
  );
};
