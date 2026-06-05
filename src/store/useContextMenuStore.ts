import { create } from 'zustand';
import React from 'react';

export interface ContextMenuItemData {
  label: string;
  onClick?: (e: React.MouseEvent) => void;
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

export const useContextMenuStore = create<ContextMenuState>((set) => ({
  isOpen: false,
  position: { x: 0, y: 0 },
  items: [],
  
  openMenu: (items, x, y) => {
    // Basic bounds checking
    const adjustedX = Math.min(x, window.innerWidth - 100);
    const adjustedY = Math.min(y, window.innerHeight - 200);
    set({ isOpen: true, items, position: { x: adjustedX, y: adjustedY } });
  },
  
  closeMenu: () => set({ isOpen: false, items: [] })
}));