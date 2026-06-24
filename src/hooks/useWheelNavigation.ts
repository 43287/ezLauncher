import { useEffect, useRef, type WheelEvent } from 'react';
import { Tab } from '../types';

export function useWheelNavigation(
  isLocked: boolean,
  topTabs: Tab[],
  activeTopTab: string,
  setActiveTopTab: (id: string) => void,
  leftTabs: Tab[],
  activeLeftTab: string,
  setActiveLeftTab: (id: string) => void
) {
  const wheelTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    return () => {
      if (wheelTimeoutRef.current) clearTimeout(wheelTimeoutRef.current);
    };
  }, []);

  const handleWheel = (e: WheelEvent) => {
    if (isLocked) return;
    
    if (Math.abs(e.deltaX) < 10 && Math.abs(e.deltaY) < 10) return; // 忽略过小的滚动

    if (wheelTimeoutRef.current) return;
    wheelTimeoutRef.current = setTimeout(() => {
      wheelTimeoutRef.current = null;
    }, 150);

    const isHorizontalScroll = Math.abs(e.deltaX) > Math.abs(e.deltaY);

    if (e.shiftKey || isHorizontalScroll) {
      if (topTabs.length === 0) return;
      e.preventDefault(); // 阻止浏览器将 Shift+滚轮 当作横向滚动作用于 grid 容器
      const currentIndex = topTabs.findIndex(t => t.id === activeTopTab);
      const delta = isHorizontalScroll ? e.deltaX : e.deltaY;

      if (delta > 0) {
        setActiveTopTab(topTabs[(currentIndex + 1) % topTabs.length].id);
      } else if (delta < 0) {
        setActiveTopTab(topTabs[(currentIndex - 1 + topTabs.length) % topTabs.length].id);
      }
    } else {
      if (leftTabs.length === 0) return;
      e.preventDefault(); // 阻止浏览器将滚轮事件传递给可滚动子元素
      const currentIndex = leftTabs.findIndex(t => t.id === activeLeftTab);
      if (e.deltaY > 0) {
        setActiveLeftTab(leftTabs[(currentIndex + 1) % leftTabs.length].id);
      } else if (e.deltaY < 0) {
        setActiveLeftTab(leftTabs[(currentIndex - 1 + leftTabs.length) % leftTabs.length].id);
      }
    }
  };

  return { handleWheel };
}
