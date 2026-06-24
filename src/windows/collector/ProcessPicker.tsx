import { useEffect, useMemo, useRef, useState } from "react";
import { getCurrentWindow } from "@tauri-apps/api/window";
import { CollectorShell, CollectorCloseConsumer } from "../../components/collectors/CollectorShell";
import { platform } from "../../api/platform";
import { type CollectorParams, useCollectorHistory, emitResult, emitCancel } from "./useCollector";
import type { ProcessInfo, ResolveResult } from "../../types";

// 009: 进程选择器（T027，FR-002/003/019a，Q4）
// 列表（搜索/过滤、可见窗口优先）+ 目标拾取靶心（节流轮询解析光标下窗口进程）。
// 采集值=PID；display=进程名（历史按名复用，research R8）。

const PICK_POLL_MS = 90;

const REASON_TEXT: Record<string, string> = {
  self: "不能选择本程序自身",
  desktop: "桌面不是有效目标",
  taskbar: "任务栏不是有效目标",
  unknown: "无法解析该窗口",
};

export function ProcessPicker({ params, label }: { params: CollectorParams; label?: string }) {
  const [procs, setProcs] = useState<ProcessInfo[]>([]);
  const [query, setQuery] = useState("");
  const [picking, setPicking] = useState(false);
  const [hover, setHover] = useState<{ pid: number; name: string; title?: string | null } | null>(null);
  const [hint, setHint] = useState<string>("");
  const history = useCollectorHistory(params.itemId, params.type);
  const pollTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // 初始枚举
  useEffect(() => {
    let cancelled = false;
    platform
      .enumerateProcesses()
      .then((list) => {
        if (!cancelled) setProcs(list);
      })
      .catch(() => {
        if (!cancelled) setHint("无法枚举进程");
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return procs;
    return procs.filter(
      (p) => p.name.toLowerCase().includes(q) || (p.title ?? "").toLowerCase().includes(q) || String(p.pid).includes(q),
    );
  }, [procs, query]);

  // 目标拾取：进入拾取态 → 窗口忽略鼠标事件并轮询解析光标下进程
  const stopPicking = async () => {
    if (pollTimer.current) {
      clearInterval(pollTimer.current);
      pollTimer.current = null;
    }
    setPicking(false);
    try {
      await getCurrentWindow().setIgnoreCursorEvents(false);
      await getCurrentWindow().setFocus();
    } catch {
      /* ignore */
    }
  };

  const startPicking = async () => {
    setPicking(true);
    setHint("移动到目标窗口，松开鼠标或点击按钮以选定");
    try {
      await getCurrentWindow().setIgnoreCursorEvents(true);
    } catch {
      /* ignore */
    }
    pollTimer.current = setInterval(async () => {
      try {
        const r: ResolveResult = await platform.resolveWindowProcessAtCursor();
        if (r.kind === "process") {
          setHover({ pid: r.process.pid, name: r.process.name, title: r.process.title });
          setHint(`目标：${r.process.name} (PID ${r.process.pid})`);
        } else {
          setHover(null);
          setHint(REASON_TEXT[r.reason] ?? "无效目标");
        }
      } catch {
        /* ignore single poll error */
      }
    }, PICK_POLL_MS);
  };

  const confirmPick = async (closeWith: (a: () => void) => void) => {
    await stopPicking();
    if (hover) {
      closeWith(() => emitResult(params, String(hover.pid), hover.name));
    } else {
      setHint("当前不是有效目标，请重新拾取");
    }
  };

  useEffect(() => {
    return () => {
      if (pollTimer.current) clearInterval(pollTimer.current);
    };
  }, []);

  const choose = (p: ProcessInfo) => emitResult(params, String(p.pid), p.name);

  return (
    <CollectorShell
      title={label ?? "选择进程"}
      ariaLabel="进程选择"
      history={history}
      onPickHistory={(_v, display, closeWith) => {
        // 历史按名复用（双击触发）：在当前列表按名找最新 PID（research R8 / FR-019a）。
        // 命中→提交并淡出关窗；未运行→仅提示并回填搜索框，窗口保留待用户另选。
        const name = display ?? _v;
        const match = procs.find((p) => p.name.toLowerCase() === name.toLowerCase());
        if (match) {
          closeWith(() => emitResult(params, String(match.pid), match.name));
        } else {
          setHint(`“${name}” 当前未运行`);
          setQuery(name);
        }
      }}
      onCancel={() => {
        void stopPicking();
        emitCancel(params);
      }}
    >
      <CollectorCloseConsumer>
        {(closeWith) => (
          <div className="pt-2 space-y-2">
            <div className="flex gap-2">
              <input
                type="text"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="搜索进程名 / PID / 标题"
                aria-label="搜索进程"
                className="flex-1 bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-md px-3 py-1.5 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
              />
              {!picking ? (
                <button
                  type="button"
                  onClick={startPicking}
                  title="目标拾取：拖到目标窗口"
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400 whitespace-nowrap"
                >
                  ◎ 拾取
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => confirmPick(closeWith)}
                  className="px-3 py-1.5 text-xs font-medium rounded-md bg-blue-500 text-white hover:bg-blue-600 transition-colors whitespace-nowrap"
                >
                  选定此目标
                </button>
              )}
            </div>

            {hint && (
              <div className="text-[11px] text-gray-500 dark:text-gray-400 px-1 truncate" title={hint}>
                {hint}
              </div>
            )}

            <div className="flex flex-col gap-0.5 max-h-72 overflow-y-auto custom-scrollbar" role="listbox" aria-label="进程列表">
              {filtered.map((p) => (
                <button
                  key={p.pid}
                  type="button"
                  role="option"
                  aria-selected={false}
                  onClick={() => closeWith(() => choose(p))}
                  className="flex items-center justify-between text-left px-2.5 py-1.5 rounded-md hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
                >
                  <span className="flex flex-col min-w-0">
                    <span className="text-sm truncate">{p.name}</span>
                    {p.title && <span className="text-[11px] text-gray-400 dark:text-gray-500 truncate">{p.title}</span>}
                  </span>
                  <span className="text-[11px] text-gray-400 dark:text-gray-500 ml-2 shrink-0">PID {p.pid}</span>
                </button>
              ))}
              {filtered.length === 0 && (
                <div className="text-xs text-gray-400 dark:text-gray-500 py-4 text-center">无匹配进程</div>
              )}
            </div>
          </div>
        )}
      </CollectorCloseConsumer>
    </CollectorShell>
  );
}
