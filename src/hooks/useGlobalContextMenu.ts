import React, { useCallback } from 'react';
import { useContextMenuStore } from '../store/useContextMenuStore';
import { useModalStore } from '../store/useModalStore';
import { useDataStore } from '../store/useDataStore';
import { useUIStore } from '../store/useUIStore';
import { LaunchItem } from '../types';

export function useGlobalContextMenu() {
  const { openMenu } = useContextMenuStore();
  const { openAddApp, openSystemApp } = useModalStore();
  const addApp = useDataStore((state) => state.addApp);
  const { activeLeftTab, activeTopTab } = useUIStore();

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      e.stopPropagation();
      const x = Math.min(e.clientX, window.innerWidth - 100);
      const y = Math.min(e.clientY, window.innerHeight - 200);
      openMenu(
        [
          {
            label: "添加",
            children: [
              {
                label: "可执行程序",
                onClick: () => openAddApp("app"),
              },
              {
                label: "网页链接",
                onClick: () => openAddApp("link"),
              },
              { label: "系统程序", onClick: () => openSystemApp() },
              { label: "脚本", onClick: () => openAddApp("script") },
              {
                label: "命令",
                onClick: () => openAddApp("command"),
              },
            ],
          },
          {
            label: "添加分隔符",
            onClick: () => {
              const newApp = {
                id: crypto.randomUUID(),
                name: "分隔符",
                type: "separator",
                shortcut: null,
                categoryId: activeLeftTab,
                columnId: activeTopTab,
                url: null,
                executablePath: null,
                args: null,
                cwd: null,
                envVariables: null,
                runAsAdmin: false,
                inTerminal: false,
                isDir: false,
                iconUrl: null,
              } as LaunchItem;
              addApp(newApp);
            },
          },
        ],
        x,
        y,
      );
    },
    [openMenu, openAddApp, openSystemApp, addApp, activeLeftTab, activeTopTab]
  );

  return { handleContextMenu };
}