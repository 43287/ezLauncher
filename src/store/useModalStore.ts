import { create } from "zustand";
import { LaunchItem, LaunchItemType } from "../types";

interface ModalState {
  isSettingsOpen: boolean;
  editingApp: LaunchItem | null;
  isAddingApp: boolean;
  addingAppType: LaunchItemType;
  isSystemAppOpen: boolean;

  openSettings: () => void;
  closeSettings: () => void;

  openEditApp: (app: LaunchItem) => void;
  closeEditApp: () => void;

  openAddApp: (type: LaunchItemType) => void;
  closeAddApp: () => void;

  openSystemApp: () => void;
  closeSystemApp: () => void;
}

export const useModalStore = create<ModalState>((set) => ({
  isSettingsOpen: false,
  editingApp: null,
  isAddingApp: false,
  addingAppType: "app",
  isSystemAppOpen: false,

  openSettings: () => set({ isSettingsOpen: true }),
  closeSettings: () => set({ isSettingsOpen: false }),

  openEditApp: (app) => set({ editingApp: app }),
  closeEditApp: () => set({ editingApp: null }),

  openAddApp: (type) => set({ isAddingApp: true, addingAppType: type }),
  closeAddApp: () => set({ isAddingApp: false }),

  openSystemApp: () => set({ isSystemAppOpen: true }),
  closeSystemApp: () => set({ isSystemAppOpen: false }),
}));
