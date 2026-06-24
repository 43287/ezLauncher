import { open } from "@tauri-apps/plugin-dialog";
import { CollectorShell, CollectorCloseConsumer } from "../../components/collectors/CollectorShell";
import { type CollectorParams, useCollectorHistory, emitResult, emitCancel } from "./useCollector";

// 009: 文件/目录选择器（T024，FR-004）。
// directory=true 选目录，否则选文件；经系统对话框 + 历史复用。
// 交互：浏览对话框选定后【自动提交】（无确认按钮）；历史项【双击】提交。
// 采集值以带引号路径返回（与既有 {target_file} 约定一致）。

function quote(p: string): string {
  return p.startsWith('"') ? p : `"${p}"`;
}

export function FilePicker({
  params,
  label,
  directory,
}: {
  params: CollectorParams;
  label?: string;
  directory: boolean;
}) {
  const history = useCollectorHistory(params.itemId, params.type);

  return (
    <CollectorShell
      title={label ?? (directory ? "选择目录" : "选择文件")}
      ariaLabel={directory ? "目录选择" : "文件选择"}
      history={history}
      onPickHistory={(_v, display, closeWith) => {
        // 历史 display 存的是原始路径；双击即提交（终结）
        const path = display ?? _v.replace(/^"|"$/g, "");
        if (path) closeWith(() => emitResult(params, quote(path), path));
      }}
      onCancel={() => emitCancel(params)}
    >
      <CollectorCloseConsumer>
        {(closeWith) => {
          const pick = async () => {
            try {
              const result = await open({ directory, multiple: false });
              // 选定后自动提交；用户在系统对话框点取消则保持本窗口
              if (typeof result === "string") {
                closeWith(() => emitResult(params, quote(result), result));
              }
            } catch {
              /* 用户取消对话框 → 保持当前 */
            }
          };
          return (
            <div className="pt-2 space-y-3">
              <button
                type="button"
                onClick={pick}
                autoFocus
                className="w-full py-2 text-sm font-medium rounded-md bg-blue-500/10 text-blue-600 dark:text-blue-300 hover:bg-blue-500/20 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-400"
              >
                {directory ? "浏览目录…" : "浏览文件…"}
              </button>
              <div className="text-[11px] text-gray-400 dark:text-gray-500 text-center select-none">
                {directory ? "选定目录后自动确认" : "选定文件后自动确认"}
              </div>
            </div>
          );
        }}
      </CollectorCloseConsumer>
    </CollectorShell>
  );
}
