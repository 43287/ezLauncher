import { useRef, useCallback, useEffect, type WheelEvent } from "react";

// 统一的滚轮切换标签页 Hook（消除 PropertiesModal 与 SettingsWindow 中的重复模式）
export function useWheelTabSwitch<T>(
  categories: readonly T[],
  activeCategory: T,
  setActiveCategory: (c: T) => void,
  debounceMs = 150
) {
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
    };
  }, []);

  const handleWheel = useCallback(
    (e: WheelEvent) => {
      e.stopPropagation();
      if (timeoutRef.current) return;
      const idx = categories.indexOf(activeCategory);
      if (e.deltaY > 0 && idx < categories.length - 1) {
        setActiveCategory(categories[idx + 1]);
      } else if (e.deltaY < 0 && idx > 0) {
        setActiveCategory(categories[idx - 1]);
      }
      timeoutRef.current = setTimeout(() => {
        timeoutRef.current = null;
      }, debounceMs);
    },
    [categories, activeCategory, setActiveCategory, debounceMs]
  );

  return { handleWheel };
}
