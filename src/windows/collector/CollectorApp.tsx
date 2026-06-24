import { useMemo } from "react";
import { parseCollectorParams, emitCancel } from "./useCollector";
import { ProcessPicker } from "./ProcessPicker";
import { FilePicker } from "./FilePicker";
import { TextInput } from "./TextInput";
import { ListPicker } from "./ListPicker";
import { CollectorShell } from "../../components/collectors/CollectorShell";

// 009: 采集子窗口入口（T003）。按 hash 路由的 type 渲染对应采集器。

export function CollectorApp() {
  const params = useMemo(() => parseCollectorParams(), []);
  const { type, config } = params;

  switch (type) {
    case "process":
      return <ProcessPicker params={params} label={config.label} />;
    case "file":
      return <FilePicker params={params} label={config.label} directory={false} />;
    case "directory":
      return <FilePicker params={params} label={config.label} directory={true} />;
    case "text":
      return <TextInput params={params} label={config.label} initialValue={config.initialValue} />;
    case "list":
      return <ListPicker params={params} label={config.label} options={config.options ?? []} />;
    default:
      return (
        <CollectorShell title="未知采集器" onCancel={() => emitCancel(params)}>
          <div className="pt-4 text-sm text-gray-500 dark:text-gray-400">
            不支持的采集器类型：{type}
          </div>
        </CollectorShell>
      );
  }
}
