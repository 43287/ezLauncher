# Data Model & State Transitions

## 1. Zustand State Models (Refined)

**Entity:** `useDataStore` (Persisted)
```typescript
interface DataStore {
  apps: LaunchItem[];
  leftTabs: Tab[];
  topTabs: Record<string, Tab[]>;
  
  // Actions
  setApps: (apps: LaunchItem[] | ((prev: LaunchItem[]) => LaunchItem[])) => void;
  setLeftTabs: (tabs: Tab[] | ((prev: Tab[]) => Tab[])) => void;
  setTopTabs: (tabs: Record<string, Tab[]> | ((prev: Record<string, Tab[]>) => Record<string, Tab[]>)) => void;
  addApp: (newApp: LaunchItem) => void;
  removeApp: (id: string) => void;
  updateApp: (id: string, updates: Partial<LaunchItem>) => void;
}
```

**Entity:** `useUIStore` (Transient)
```typescript
interface UIStore {
  activeLeftTab: string;
  activeTopTab: string;
  isRecordingShortcut: boolean;
  isDragging: boolean;
  
  // Actions
  setActiveLeftTab: (id: string) => void;
  setActiveTopTab: (id: string) => void;
  setIsRecordingShortcut: (val: boolean) => void;
  setIsDragging: (val: boolean) => void;
}
```

*Transitions/Usage*: `useUIStore`'s `setActiveLeftTab` action interacts with `useDataStore` to fetch the default or available top tabs for the new category, but updates its own state. `useAppStore` is completely removed.
