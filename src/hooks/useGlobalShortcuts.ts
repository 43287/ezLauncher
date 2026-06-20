import { useEffect } from "react";
import { tauriApi } from "../api/tauri";
import { useUIStore } from "../store/useUIStore";
import { useDataStore } from "../store/useDataStore";

export function useGlobalShortcuts(isVisible: boolean) {
  const { settings } = useDataStore();
  const isRecordingShortcut = useUIStore((state) => state.isRecordingShortcut);

  useEffect(() => {
    // 逃生舱：当 WebView 获得焦点时，WebView2 的输入拦截级别极高。
    // 我们通过在最前端捕获并主动调用 hideWindow，来确保面板总能被关闭。
    const handleKeyDown = (e: KeyboardEvent) => {
      if (isRecordingShortcut || !isVisible) return;
      
      const summonShortcut = (settings.summonShortcut as string) || 'Alt+Space';
      const summonMouseShortcut = (settings.summonMouseShortcut as string) || 'Mouse4';
      if (!summonShortcut && !summonMouseShortcut) return;

      if (summonShortcut) {
        if (isShortcutMatch(e, summonShortcut)) {
          e.preventDefault();
          e.stopPropagation();
          tauriApi.hideWindow();
        }
      }
    };

    const handlePointerDown = (e: PointerEvent) => {
      if (isRecordingShortcut || !isVisible) return;
      const summonMouseShortcut = (settings.summonMouseShortcut as string) || 'Mouse4';
      if (!summonMouseShortcut) return;
      
      if (isMouseMatch(e, summonMouseShortcut)) {
        e.preventDefault();
        e.stopPropagation();
        tauriApi.hideWindow();
      }
    };

    document.addEventListener('keydown', handleKeyDown, { capture: true });
    document.addEventListener('pointerdown', handlePointerDown, { capture: true });
    
    return () => {
      document.removeEventListener('keydown', handleKeyDown, { capture: true });
      document.removeEventListener('pointerdown', handlePointerDown, { capture: true });
    };
  }, [settings.summonShortcut, settings.summonMouseShortcut, isVisible, isRecordingShortcut]);
}

function isShortcutMatch(e: KeyboardEvent, shortcutString: string): boolean {
  const keys = shortcutString.toLowerCase().split('+');
  const needsCtrl = keys.includes('ctrl') || keys.includes('control');
  const needsAlt = keys.includes('alt');
  const needsShift = keys.includes('shift');
  const needsMeta = keys.includes('meta') || keys.includes('super') || keys.includes('win');
  
  const primaryKey = keys.filter(k => !['ctrl', 'control', 'alt', 'shift', 'meta', 'super', 'win'].includes(k))[0];

  if (!primaryKey) return false;

  let keyMatched = false;
  if (primaryKey === 'space') {
    keyMatched = e.code === 'Space' || e.key === ' ' || e.key.toLowerCase() === 'space';
  } else if (primaryKey === '\\') {
    keyMatched = e.code === 'Backslash';
  } else {
    keyMatched = e.key.toLowerCase() === primaryKey || e.code.toLowerCase() === `key${primaryKey}`;
  }

  return keyMatched &&
    e.ctrlKey === needsCtrl &&
    e.altKey === needsAlt &&
    e.shiftKey === needsShift &&
    e.metaKey === needsMeta;
}

function isMouseMatch(e: PointerEvent, shortcutString: string): boolean {
  const keys = shortcutString.toLowerCase().split('+');
  const needsCtrl = keys.includes('ctrl') || keys.includes('control');
  const needsAlt = keys.includes('alt');
  const needsShift = keys.includes('shift');
  const needsMeta = keys.includes('meta') || keys.includes('super') || keys.includes('win');
  
  const primaryKey = keys.filter(k => !['ctrl', 'control', 'alt', 'shift', 'meta', 'super', 'win'].includes(k))[0];
  
  if (!primaryKey) return false;

  let buttonMatched = false;
  if (primaryKey === 'mouse4' && e.button === 3) buttonMatched = true;
  if (primaryKey === 'mouse5' && e.button === 4) buttonMatched = true;
  
  return buttonMatched &&
      e.ctrlKey === needsCtrl &&
      e.altKey === needsAlt &&
      e.shiftKey === needsShift &&
      e.metaKey === needsMeta;
}