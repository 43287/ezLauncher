import { useState } from "react";
import { CollectorShell } from "../../components/collectors/CollectorShell";
import { type CollectorParams, useCollectorHistory, emitResult, emitCancel } from "./useCollector";

// 009: 文本输入器（T025，FR-004）

export function TextInput({ params, label, initialValue }: { params: CollectorParams; label?: string; initialValue?: string }) {
  const [value, setValue] = useState(initialValue ?? "");
  const history = useCollectorHistory(params.itemId, params.type);

  return (
    <CollectorShell
      title={label ?? "输入参数"}
      ariaLabel="文本输入"
      history={history}
      onPickHistory={(v, _d, closeWith) => closeWith(() => emitResult(params, v, v))}
      onConfirm={() => emitResult(params, value, value)}
      onCancel={() => emitCancel(params)}
      confirmDisabled={value.trim() === ""}
    >
      <div className="pt-2">
        <input
          autoFocus
          type="text"
          value={value}
          onChange={(e) => setValue(e.target.value)}
          aria-label="文本输入框"
          className="w-full bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-md px-3 py-2 text-sm focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors"
          placeholder="输入后按 Enter 确认"
        />
      </div>
    </CollectorShell>
  );
}
