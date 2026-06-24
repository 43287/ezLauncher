import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

// 统一的 className 合并工具（消除 PropertiesModal 与 SystemAppModal 中的重复定义）
export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
