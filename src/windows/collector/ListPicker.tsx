import { CollectorShell, useCollectorClose } from "../../components/collectors/CollectorShell";
import { type CollectorParams, emitResult, emitCancel } from "./useCollector";

function ListPickerOptions({ params, options }: { params: CollectorParams; options: string[] }) {
  const closeWith = useCollectorClose();
  return (
    <div className="pt-2 flex flex-col gap-1.5" role="listbox" aria-label="选项列表">
      {options.length === 0 ? (
        <div className="text-xs text-gray-400 dark:text-gray-500 py-4 text-center">无可选项</div>
      ) : (
        options.map((opt, i) => (
          <button
            key={`${opt}-${i}`}
            type="button"
            role="option"
            aria-selected={false}
            onClick={() => closeWith(() => emitResult(params, opt, opt))}
            className="text-left text-sm px-3 py-2 rounded-md bg-black/5 dark:bg-white/5 hover:bg-blue-500/10 hover:text-blue-600 dark:hover:text-blue-300 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
          >
            {opt}
          </button>
        ))
      )}
    </div>
  );
}

// 009: 列表选择器（T026，FR-004）。单击即选定并 emit。
// 复用于 US2 多参数附加预设选择（选项=预设显示名）。

export function ListPicker({
  params,
  label,
  options,
}: {
  params: CollectorParams;
  label?: string;
  options: string[];
}) {
  return (
    <CollectorShell
      title={label ?? "选择"}
      ariaLabel="列表选择"
      onCancel={() => emitCancel(params)}
    >
      <ListPickerOptions params={params} options={options} />
    </CollectorShell>
  );
}
