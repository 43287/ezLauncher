import { create } from 'zustand';
import { useDataStore } from './useDataStore';

interface UIState {
  activeLeftTab: string;
  activeTopTab: string;
  isRecordingShortcut: boolean;
  isDragging: boolean;
  focusedAppId: string | null;
  
  // Actions
  setActiveLeftTab: (id: string) => void;
  setActiveTopTab: (id: string) => void;
  setIsRecordingShortcut: (val: boolean) => void;
  setIsDragging: (val: boolean) => void;
  setFocusedAppId: (id: string | null) => void;
}

export const useUIStore = create<UIState>((set, get) => ({
  activeLeftTab: '2',
  activeTopTab: '1',
  isRecordingShortcut: false,
  isDragging: false,
  focusedAppId: null,

  setFocusedAppId: (id) => set({ focusedAppId: id }),

  setActiveLeftTab: (id) => {
    const state = get();
    const dataStore = useDataStore.getState();
    const topTabs = dataStore.settings.topTabs || {};
    
    const oldTabs = topTabs[state.activeLeftTab] || [];
    const targetIndex = oldTabs.findIndex((t: any) => t.id === state.activeTopTab);
    const resolvedIndex = targetIndex >= 0 ? targetIndex : 0;

    let newTabs = topTabs[id] || [];

    if (newTabs.length === 0) {
      newTabs = [
        { id: crypto.randomUUID(), name: 'Tab 1' },
        { id: crypto.randomUUID(), name: 'Tab 2' },
        { id: crypto.randomUUID(), name: 'Tab 3' },
        { id: crypto.randomUUID(), name: 'Tab 4' }
      ];
      dataStore.updateSetting('topTabs', { ...topTabs, [id]: newTabs });
    }

    const finalIndex = Math.min(resolvedIndex, newTabs.length - 1);
    set({ 
      activeLeftTab: id,
      activeTopTab: newTabs[finalIndex]?.id || ''
    });
  },
  
  setActiveTopTab: (id) => set({ activeTopTab: id }),
  setIsRecordingShortcut: (val) => set({ isRecordingShortcut: val }),
  setIsDragging: (val) => set({ isDragging: val }),
}));
