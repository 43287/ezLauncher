import React from "react";
import type { CollectionStep, InputPipeline, ParamPreset } from "../types";
import { generateId } from "../constants/ids";
import { DEFAULT_PLACEHOLDER_BY_COLLECTOR } from "../constants/placeholders";

// 009: 输入流程 + 多参数附加 编辑器（T030/T031）。
// 受控组件：父组件持有 inputPipeline / multiParamEnabled / paramPresets 状态。

const COLLECTOR_TYPES: { value: string; label: string }[] = [
  { value: "drop", label: "接收拖入" },
  { value: "file", label: "文件选择" },
  { value: "directory", label: "目录选择" },
  { value: "process", label: "进程选择" },
  { value: "text", label: "文本输入" },
  { value: "list", label: "列表选择" },
];

interface Props {
  pipeline: InputPipeline | null;
  onPipelineChange: (p: InputPipeline | null) => void;
  multiParamEnabled: boolean;
  onMultiParamEnabledChange: (v: boolean) => void;
  presets: ParamPreset[];
  onPresetsChange: (p: ParamPreset[]) => void;
}

const fieldCls =
  "w-full bg-black/5 dark:bg-white/5 border border-transparent hover:border-black/10 dark:hover:border-white/20 rounded-md px-2.5 py-1.5 text-gray-900 dark:text-gray-100 text-xs focus:outline-none focus:border-blue-400 focus:ring-1 focus:ring-blue-400 transition-colors";

export const InteractiveParamsEditor: React.FC<Props> = ({
  pipeline,
  onPipelineChange,
  multiParamEnabled,
  onMultiParamEnabledChange,
  presets,
  onPresetsChange,
}) => {
  const steps = pipeline?.steps ?? [];

  const setSteps = (next: CollectionStep[]) => {
    onPipelineChange(next.length > 0 ? { steps: next } : null);
  };

  const addStep = () => {
    const collectorType = "file";
    const newStep: CollectionStep = {
      id: generateId(),
      collectorType,
      targetPlaceholder: DEFAULT_PLACEHOLDER_BY_COLLECTOR[collectorType] ?? "selected_path",
      label: null,
      options: null,
      initialValue: null,
    };
    setSteps([...steps, newStep]);
  };

  const updateStep = (id: string, patch: Partial<CollectionStep>) => {
    setSteps(steps.map((s) => (s.id === id ? { ...s, ...patch } : s)));
  };

  const removeStep = (id: string) => setSteps(steps.filter((s) => s.id !== id));

  const moveStep = (index: number, dir: -1 | 1) => {
    const ni = index + dir;
    if (ni < 0 || ni >= steps.length) return;
    const next = [...steps];
    [next[index], next[ni]] = [next[ni], next[index]];
    setSteps(next);
  };

  // 校验：targetPlaceholder 重复、drop 非首步（data-model §1）
  const duplicatePlaceholders = new Set(
    steps.map((s) => s.targetPlaceholder).filter((ph, i, arr) => arr.indexOf(ph) !== i),
  );
  const dropNotFirst = steps.some((s, i) => s.collectorType === "drop" && i !== 0);

  const addPreset = () => {
    onPresetsChange([...presets, { id: generateId(), displayName: "", template: "" }]);
  };
  const updatePreset = (id: string, patch: Partial<ParamPreset>) => {
    onPresetsChange(presets.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const removePreset = (id: string) => onPresetsChange(presets.filter((p) => p.id !== id));

  return (
    <div className="space-y-5">
      {/* 多参数附加 */}
      <section className="space-y-2">
        <div className="flex justify-between items-center bg-black/5 dark:bg-white/5 px-3 h-10 rounded-md">
          <div className="text-gray-900 dark:text-gray-100 font-medium text-xs">多参数附加</div>
          <label className="relative inline-flex items-center cursor-pointer">
            <input
              type="checkbox"
              className="sr-only peer"
              checked={multiParamEnabled}
              onChange={(e) => onMultiParamEnabledChange(e.target.checked)}
            />
            <div className="w-9 h-5 bg-black/10 dark:bg-white/10 rounded-full peer peer-checked:bg-blue-500 transition-colors after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:rounded-full after:h-4 after:w-4 after:transition-transform peer-checked:after:translate-x-[16px]"></div>
          </label>
        </div>

        {multiParamEnabled && (
          <div className="space-y-2">
            {presets.length === 0 && (
              <p className="text-[11px] text-gray-400 dark:text-gray-500">添加预设：每条含显示名称与参数/命令模板（可含 {"{target_file}"} 等占位符）。</p>
            )}
            {presets.map((p) => (
              <div key={p.id} className="flex gap-1.5 items-start">
                <input
                  className={`${fieldCls} flex-[0_0_30%]`}
                  placeholder="显示名称"
                  value={p.displayName}
                  onChange={(e) => updatePreset(p.id, { displayName: e.target.value })}
                />
                <input
                  className={`${fieldCls} flex-1`}
                  placeholder="参数/命令模板"
                  value={p.template}
                  onChange={(e) => updatePreset(p.id, { template: e.target.value })}
                />
                <button
                  type="button"
                  onClick={() => removePreset(p.id)}
                  aria-label="删除预设"
                  className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                >
                  ×
                </button>
              </div>
            ))}
            <button
              type="button"
              onClick={addPreset}
              className="text-xs font-medium text-gray-700 dark:text-gray-200 px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
            >
              + 添加预设
            </button>
          </div>
        )}
      </section>

      {/* 输入流程 */}
      <section className="space-y-2">
        <div className="flex justify-between items-center">
          <div className="text-gray-900 dark:text-gray-100 font-medium text-xs ml-0.5">输入流程（按序采集）</div>
          <button
            type="button"
            onClick={addStep}
            className="text-xs px-2.5 py-1 rounded-md bg-black/5 dark:bg-white/10 hover:bg-black/10 dark:hover:bg-white/20 transition-colors"
          >
            + 添加步骤
          </button>
        </div>

        {steps.length === 0 ? (
          <p className="text-[11px] text-gray-400 dark:text-gray-500">无步骤时按现状直接启动。添加步骤后，启动前将按序弹出采集界面。</p>
        ) : (
          <div className="space-y-2">
            {steps.map((s, i) => (
              <div key={s.id} className="bg-black/5 dark:bg-white/5 rounded-md p-2 space-y-1.5">
                <div className="flex gap-1.5 items-center">
                  <span className="text-[11px] text-gray-400 w-4 text-center shrink-0">{i + 1}</span>
                  <select
                    className={`${fieldCls} flex-1`}
                    value={s.collectorType}
                    onChange={(e) => {
                      const ct = e.target.value;
                      updateStep(s.id, {
                        collectorType: ct,
                        targetPlaceholder: DEFAULT_PLACEHOLDER_BY_COLLECTOR[ct] ?? s.targetPlaceholder,
                      });
                    }}
                  >
                    {COLLECTOR_TYPES.map((t) => (
                      <option key={t.value} value={t.value} className="bg-white dark:bg-gray-800">
                        {t.label}
                      </option>
                    ))}
                  </select>
                  <div className="flex flex-col shrink-0">
                    <button type="button" onClick={() => moveStep(i, -1)} aria-label="上移" className="text-[10px] leading-none px-1 text-gray-500 hover:text-blue-500 disabled:opacity-30" disabled={i === 0}>▲</button>
                    <button type="button" onClick={() => moveStep(i, 1)} aria-label="下移" className="text-[10px] leading-none px-1 text-gray-500 hover:text-blue-500 disabled:opacity-30" disabled={i === steps.length - 1}>▼</button>
                  </div>
                  <button
                    type="button"
                    onClick={() => removeStep(s.id)}
                    aria-label="删除步骤"
                    className="shrink-0 w-7 h-7 flex items-center justify-center rounded-md text-red-500 hover:bg-red-500/10 transition-colors"
                  >
                    ×
                  </button>
                </div>
                <div className="flex gap-1.5 items-center pl-6">
                  <span className="text-[11px] text-gray-400 shrink-0">占位符</span>
                  <input
                    className={`${fieldCls} flex-1`}
                    placeholder="如 target_file / target_process / text"
                    value={s.targetPlaceholder}
                    onChange={(e) => updateStep(s.id, { targetPlaceholder: e.target.value })}
                  />
                </div>
                {s.collectorType === "list" && (
                  <div className="flex gap-1.5 items-center pl-6">
                    <span className="text-[11px] text-gray-400 shrink-0">选项</span>
                    <input
                      className={`${fieldCls} flex-1`}
                      placeholder="用逗号分隔，如 选项A,选项B"
                      value={(s.options ?? []).join(",")}
                      onChange={(e) =>
                        updateStep(s.id, {
                          options: e.target.value ? e.target.value.split(",").map((x) => x.trim()) : null,
                        })
                      }
                    />
                  </div>
                )}
              </div>
            ))}
          </div>
        )}

        {/* 校验警告（data-model §1） */}
        {(duplicatePlaceholders.size > 0 || dropNotFirst) && (
          <div className="text-[11px] text-amber-600 dark:text-amber-400 space-y-0.5">
            {duplicatePlaceholders.size > 0 && <div>⚠ 占位符重复：{Array.from(duplicatePlaceholders).join(", ")}（会相互覆盖）</div>}
            {dropNotFirst && <div>⚠ “接收拖入”只能作为第一步</div>}
          </div>
        )}
      </section>
    </div>
  );
};
