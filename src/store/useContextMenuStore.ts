import { create } from 'zustand';
import { type MouseEvent } from 'react';
import { CONTEXT_MENU_MIN_MARGIN_X, CONTEXT_MENU_MIN_MARGIN_Y } from '../constants/storage';

export interface ContextMenuItemData {
  label: string;
  onClick?: (e: MouseEvent) => void;
  children?: ContextMenuItemData[];
  isSeparator?: boolean;
}

interface ContextMenuState {
  isOpen: boolean;
  position: { x: number, y: number };
  items: ContextMenuItemData[];

  openMenu: (items: ContextMenuItemData[], x: number, y: number) => void;
  closeMenu: () => void;
}

// 边界检查仅在 store 层执行（单一真实来源，FR-022）
export const useContextMenuStore = create<ContextMenuState>((set) => ({
  isOpen: false,
  position: { x: 0, y: 0 },
  items: [],

  openMenu: (items, x, y) => {
    const adjustedX = Math.min(x, window.innerWidth - CONTEXT_MENU_MIN_MARGIN_X);
    const adjustedY = Math.min(y, window.innerHeight - CONTEXT_MENU_MIN_MARGIN_Y);
    set({ isOpen: true, items, position: { x: adjustedX, y: adjustedY } });
  },

  closeMenu: () => set({ isOpen: false, items: [] })
}));