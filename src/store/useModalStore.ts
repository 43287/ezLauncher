import { create } from 'zustand';
import { LaunchItem, LaunchItemType } from '../types';

interface ModalState {
  isSettingsOpen: boolean;
  editingApp: LaunchItem | null;
  isAddingApp: boolean;
  addingAppType: LaunchItemType;

  openSettings: () => void;
  closeSettings: () => void;

  openEditApp: (app: LaunchItem) => void;
  closeEditApp: () => void;

  openAddApp: (type: LaunchItemType) => void;
  closeAddApp: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  isSettingsOpen: false,
  editingApp: null,
  isAddingApp: false,
  addingAppType: 'app',

  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),

  openEditApp: (app) => set({ editingApp: app }),
  closeEditApp: () => set({ editingApp: null }),

  openAddApp: (type) => set({ isAddingApp: true, addingAppType: type }),
  closeAddApp: () => set({ isAddingApp: false }),
}));
