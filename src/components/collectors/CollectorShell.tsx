import React, { useEffect, useRef, useState, useCallback, createContext, useContext } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";

// 让 children（各采集器内部的列表项/行）也能触发统一的退场动画后再 emit。
const CollectorCloseContext = createContext<(action: () => void) => void>((a) => a());

// 采集器内部直接产出结果（如列表单击）时调用，复用 Shell 的淡出动画。
export function useCollectorClose(): (action: () => void) => void {
  return useContext(CollectorCloseContext);
}

// 渲染属性消费者：供"渲染 CollectorShell 的父组件"在其 children 中拿到 closeWith。
export const CollectorCloseConsumer: React.FC<{
  children: (closeWith: (action: () => void) => void) => React.ReactNode;
}> = ({ children }) => <>{children(useContext(CollectorCloseContext))}</>;

// 009: 采集器统一外框（T023）。明暗主题跟随系统，毛玻璃圆角，
// Enter 确认 / Esc 取消，焦点环与 aria 标签；含历史复用区。
// 入场：隐藏创建 → 首帧绘制后 show() + 淡入缩放，消除白屏闪烁。
// contracts/collector-windows.md，FR-022/005

export interface HistoryItem {
  value: string;
  display?: string;
}

// closeWith：播放退场动画并在结束后执行 action（通常是 emitResult）。
type CloseWith = (action: () => void) => void;

interface CollectorShellProps {
  title: string;
  children: React.ReactNode;
  history?: HistoryItem[];
  // 历史项【双击】触发。closeWith 交给采集器自行决定：终结式（提交并淡出关窗）调
  // closeWith(() => emitResult(...))；非终结式（如进程未运行）仅提示/回填、窗口保留。
  onPickHistory?: (value: string, display: string | undefined, closeWith: CloseWith) => void;
  onConfirm?: () => void;
  onCancel: () => void;
  confirmDisabled?: boolean;
  ariaLabel?: string;
}

// 入场/退场动画时长（ms）：入场略快、退场更利落；
// EXIT_MS 同时作为"淡出播完再关窗"的延时，与退场过渡时长一致以免被截断。
const ENTER_MS = 150;
const EXIT_MS = 100;

export const CollectorShell: React.FC<CollectorShellProps> = ({
  title,
  children,
  history,
  onPickHistory,
  onConfirm,
  onCancel,
  confirmDisabled = false,
  ariaLabel,
}) => {
  const rootRef = useRef<HTMLDivElement>(null);
  const [shown, setShown] = useState(false);   // 入场态
  const [closing, setClosing] = useState(false); // 退场态

  // 首帧绘制后再显示窗口并触发淡入：双 rAF 确保 opacity-0 初始帧已绘制，
  // 窗口以全透明态 show()，用户看不到白屏，随后平滑淡入缩放。
  useEffect(() => {
    let raf2 = 0;
    const raf1 = requestAnimationFrame(() => {
      raf2 = requestAnimationFrame(async () => {
        try {
          const w = getCurrentWindow();
          await w.show();
          await w.setFocus();
        } catch {
          /* 非 tauri 窗口环境忽略 */
        }
        setShown(true);
        rootRef.current?.focus();
      });
    });
    return () => {
      cancelAnimationFrame(raf1);
      if (raf2) cancelAnimationFrame(raf2);
    };
  }, []);

  // 退场后再执行真实动作（emit），让窗口优雅淡出而非生硬消失。
  // 关键：进入退场的【同一同步点】立即解除鼠标拦截 —— 淡出期间窗口虽可见但鼠标穿透，
  // 杜绝"内容已透明、窗口仍 visible+置顶吞掉点击"的隐形拦截（根因1，FR-003）。
  const closeWith = useCallback((action: () => void) => {
    setClosing(true);
    try {
      void getCurrentWindow().setIgnoreCursorEvents(true);
    } catch {
      /* 非 tauri 窗口环境忽略 */
    }
    window.setTimeout(action, EXIT_MS);
  }, []);

  const handleConfirm = useCallback(() => {
    if (onConfirm && !confirmDisabled) closeWith(onConfirm);
  }, [onConfirm, confirmDisabled, closeWith]);

  const handleCancel = useCallback(() => closeWith(onCancel), [onCancel, closeWith]);

  // 历史项【双击】提交：把 closeWith 交给采集器，由其决定终结(提交并淡出关窗)
  // 还是非终结(仅提示/回填、窗口保留)。单击不触发，避免误操作。
  const handlePickHistory = useCallback(
    (value: string, display?: string) => {
      onPickHistory?.(value, display, closeWith);
    },
    [onPickHistory, closeWith],
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Escape") {
      e.preventDefault();
      handleCancel();
    } else if (e.key === "Enter" && onConfirm && !confirmDisabled) {
      // 避免在 textarea 内 Enter 误触发（多行输入由组件自行处理）
      const tag = (e.target as HTMLElement).tagName.toLowerCase();
      if (tag !== "textarea") {
        e.preventDefault();
        handleConfirm();
      }
    }
  };

  return (
    <CollectorCloseContext.Provider value={closeWith}>
    <div
      ref={rootRef}
      tabIndex={-1}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-label={ariaLabel ?? title}
      style={{
        transition: `opacity ${closing ? EXIT_MS : ENTER_MS}ms cubic-bezier(0.22,1,0.36,1), transform ${closing ? EXIT_MS : ENTER_MS}ms cubic-bezier(0.22,1,0.36,1)`,
        opacity: shown && !closing ? 1 : 0,
        transform: closing ? "scale(0.97) translateY(4px)" : shown ? "scale(1) translateY(0)" : "scale(0.96) translateY(6px)",
      }}
      className="h-screen w-screen flex flex-col bg-white/90 dark:bg-gray-900/90 backdrop-blur-xl text-gray-900 dark:text-gray-100 rounded-xl border border-black/5 dark:border-white/10 shadow-soft-lg overflow-hidden outline-none"
    >
      {/* 标题栏（可拖动窗口） */}
      <div
        className="flex items-center justify-between px-4 py-2.5 shrink-0"
        data-tauri-drag-region
      >
        <span className="text-sm font-medium select-none">{title}</span>
        <button
          type="button"
          onClick={handleCancel}
          aria-label="取消"
          className="w-6 h-6 flex items-center justify-center rounded-md text-gray-500 hover:bg-black/5 dark:hover:bg-white/10 hover:text-gray-900 dark:hover:text-gray-100 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>

      {/* 主体 */}
      <div className="flex-1 px-4 pb-2 overflow-y-auto custom-scrollbar">{children}</div>

      {/* 历史复用区（最近优先、双击提交，FR-005）。单击不触发，避免误操作。 */}
      {history && history.length > 0 && (
        <div className="px-4 py-2 border-t border-black/5 dark:border-white/10 shrink-0">
          <div className="text-[11px] font-medium text-gray-400 dark:text-gray-500 mb-1.5">最近使用（双击使用）</div>
          <div className="flex flex-col gap-1 max-h-32 overflow-y-auto custom-scrollbar">
            {history.map((h, i) => (
              <button
                key={`${h.value}-${i}`}
                type="button"
                onDoubleClick={() => handlePickHistory(h.value, h.display)}
                title={`双击使用：${h.value}`}
                className="text-left text-xs px-2 py-1.5 rounded-md bg-black/5 dark:bg-white/5 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-300 truncate select-none transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {h.display ?? h.value}
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
    </CollectorCloseContext.Provider>
  );
};
