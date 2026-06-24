import * as LucideIcons from "lucide-react";
import type { LucideIcon } from "lucide-react";

// 类型安全的 Lucide 图标查找，消除散落的 `as any` 类型断言
const iconMap = LucideIcons as unknown as Record<string, LucideIcon>;

export function getLucideIcon(name: string): LucideIcon {
  return iconMap[name] || LucideIcons.HelpCircle;
}
