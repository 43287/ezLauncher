import React from "react";
import { LaunchItem } from "../types";
import { ShortcutItem } from "./ShortcutItem";
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
  isDraggingFile?: boolean;
  onAppRemove?: (id: string) => void;
  onAppReorder?: (apps: LaunchItem[]) => void;
  onAppRename?: (id: string, newName: string) => void;
  onEditProperties?: (app: LaunchItem) => void;
}

/**
 * 应用网格组件，支持拖拽添加应用
 */
export const AppGrid: React.FC<AppGridProps> = ({ apps, isDraggingFile = false, onAppRemove, onAppReorder, onAppRename, onEditProperties }) => {
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

  return (
      <div
        className={`h-full w-full rounded-2xl transition-all duration-200 ${
          isDraggingFile
            ? "bg-blue-50 dark:bg-blue-900/20 border-2 border-dashed border-blue-400"
            : "bg-transparent border-2 border-transparent"
        } ${apps.length === 0 ? '' : 'p-2'}`}
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
            <div className="grid grid-cols-4 sm:grid-cols-5 md:grid-cols-6 gap-4 items-start content-start">
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
