import { useState, useCallback, useRef, useEffect } from "react";

// 统一的关闭动画 Hook（消除 PropertiesModal / SettingsWindow / SystemAppModal 中的重复模式）
export function useAnimatedClose(onClose: () => void, delayMs = 200) {
  const [isClosing, setIsClosing] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const handleClose = useCallback(() => {
    setIsClosing(true);
    timerRef.current = setTimeout(() => {
      onClose();
    }, delayMs);
  }, [onClose, delayMs]);

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, []);

  return { isClosing, handleClose };
}
