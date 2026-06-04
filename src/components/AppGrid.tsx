import React, { useState, useEffect } from "react";
import { LaunchItem } from "../types";
import { ShortcutItem } from "./ShortcutItem";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { invoke } from "@tauri-apps/api/core";
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
  rectSortingStrategy,
} from "@dnd-kit/sortable";

interface AppGridProps {
  apps: LaunchItem[];
  onAppAdd: (app: LaunchItem) => void;
  onAppRemove?: (id: string) => void;
  onAppReorder?: (apps: LaunchItem[]) => void;
  onAppRename?: (id: string, newName: string) => void;
  onEditProperties?: (app: LaunchItem) => void;
}

/**
 * 应用网格组件，支持拖拽添加应用
 */
export const AppGrid: React.FC<AppGridProps> = ({ apps, onAppAdd, onAppRemove, onAppReorder, onAppRename, onEditProperties }) => {
  const [isDraggingFile, setIsDraggingFile] = useState(false);

  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 5,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    })
  );

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;

    if (over && active.id !== over.id) {
      const oldIndex = apps.findIndex((app) => app.id === active.id);
      const newIndex = apps.findIndex((app) => app.id === over.id);

      const newApps = arrayMove(apps, oldIndex, newIndex);
      onAppReorder?.(newApps);
    }
  };

  useEffect(() => {
    const appWindow = getCurrentWindow();
    
    const unlistenPromise = appWindow.onDragDropEvent((event) => {
      if (event.payload.type === 'enter' || event.payload.type === 'over') {
        setIsDraggingFile(true);
      } else if (event.payload.type === 'leave') {
        setIsDraggingFile(false);
      } else if (event.payload.type === 'drop') {
        setIsDraggingFile(false);
        const files = event.payload.paths;
        if (files && files.length > 0) {
          const filePath = files[0];
          const fileNameMatch = filePath.match(/[^\\/]+$/);
          const fileName = fileNameMatch ? fileNameMatch[0].replace(/\.[^/.]+$/, "") : "Unknown";

          const createAndAddApp = async () => {
            let icon_base64: string | undefined = undefined;
            try {
              if (filePath.toLowerCase().endsWith('.exe') || filePath.toLowerCase().endsWith('.lnk')) {
                icon_base64 = await invoke<string>("extract_icon", { executablePath: filePath });
              }
            } catch (err) {
              console.error("Failed to extract icon:", err);
            }

            const newApp: LaunchItem = {
              id: crypto.randomUUID(),
              name: fileName,
              type: 'app',
              executable_path: filePath,
              shortcut: null,
              icon_base64,
            };
            
            onAppAdd(newApp);
          };

          createAndAddApp();
        }
      }
    });

    return () => {
      unlistenPromise.then((unlisten) => unlisten());
    };
  }, [onAppAdd]);

  return (
      <div
        className={`min-h-[300px] p-6 rounded-2xl transition-all duration-200 ${
          isDraggingFile
            ? "bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-400"
            : "bg-transparent border-2 border-transparent"
        }`}
        role="region"
        aria-label="应用快捷方式网格，支持拖拽文件添加"
      >
        {apps.length === 0 ? (
        <div className="h-full flex flex-col items-center justify-center text-gray-400 dark:text-gray-500 space-y-4">
          <div className="text-4xl">📁</div>
          <p className="text-sm font-medium">拖拽应用程序（.exe）到此处</p>
        </div>
      ) : (
        <DndContext
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
        >
          <SortableContext
            items={apps.map(app => app.id)}
            strategy={rectSortingStrategy}
          >
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4">
              {apps.map((app) => (
                <ShortcutItem
                  key={app.id}
                  app={app}
                  onRemove={onAppRemove}
                  onEditProperties={onEditProperties}
                  onRename={onAppRename}
                />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      )}
    </div>
  );
};
