// 布局相关常量（消除 App.tsx 中的魔法数字）
// 与各组件 Tailwind 配置保持同步：ShortcutItem max-w-[80px]、AppGrid gap-1、Sidebar w-14

export const SHORTCUT_ITEM_MAX_WIDTH = 80;
export const GRID_GAP_PX = 4; // gap-1 = 0.25rem = 4px
export const GRID_PADDING_X = 16; // p-2 = 0.5rem = 8px, total horizontal = 8+8 = 16
export const SCROLLBAR_RESERVE = 16; // Windows 纵向滚动条预留宽度
export const SIDEBAR_WIDTH = 56; // w-14 = 3.5rem = 56px
