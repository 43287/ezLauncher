import { z } from 'zod';
import type { LaunchItem as RustLaunchItem } from './LaunchItem';
import type { Tab as RustTab } from './Tab';
import type { SettingsConfig as RustSettingsConfig } from './SettingsConfig';

export type Tab = RustTab;

export type LaunchItem = RustLaunchItem;

export type SettingsConfig = RustSettingsConfig;
export * from './LaunchContext';

// 009: 交互式启动输入系统类型（ts-rs 生成）
export type { InputPipeline } from './InputPipeline';
export type { CollectionStep } from './CollectionStep';
export type { ParamPreset } from './ParamPreset';
export type { ProcessInfo } from './ProcessInfo';
export type { ResolveResult } from './ResolveResult';

// 由于 Zod 主要用于运行时校验（特别是防御无效的 JSON 文件或合并默认值），
// 我们可以基于自动生成的接口类型来定义 Zod Schema，从而保持两端的契约安全。

export const TabSchema = z.object({
  id: z.string(),
  name: z.string(),
});

// 009 输入系统的运行时校验 schema（FR-022）：取代 z.any()，与 ts-rs 生成类型对齐。
// Rust 端 Option<T> 序列化为 null，故可空字段用 nullable().optional()。
export const CollectionStepSchema = z.object({
  id: z.string(),
  collectorType: z.string(),
  targetPlaceholder: z.string(),
  label: z.string().nullable().optional(),
  options: z.array(z.string()).nullable().optional(),
  initialValue: z.string().nullable().optional(),
});

export const InputPipelineSchema = z.object({
  steps: z.array(CollectionStepSchema),
});

export const ParamPresetSchema = z.object({
  id: z.string(),
  displayName: z.string(),
  template: z.string(),
});

export const LaunchItemSchema = z.object({
  id: z.string(),
  name: z.string(),
  type: z.string(),
  url: z.string().optional(),
  executablePath: z.string().optional(),
  args: z.string().optional(),
  cwd: z.string().optional(),
  envVariables: z.string().optional(),
  runAsAdmin: z.boolean().optional(),
  inTerminal: z.boolean().optional(),
  isDir: z.boolean().optional(),
  iconUrl: z.string().optional(),
  shortcut: z.string().optional(),
  // 009: 可选的输入流程与多参数附加（具体 schema 校验，FR-022）
  inputPipeline: InputPipelineSchema.nullable().optional(),
  paramPresets: z.array(ParamPresetSchema).nullable().optional(),
  multiParamEnabled: z.boolean().optional(),
  categoryId: z.string(),
  columnId: z.string(),
});

export const SettingsSchema = z.object({
  columns: z.number().default(4),
  summonShortcut: z.string().default('Alt+Space'),
  summonMouseShortcut: z.string().nullable().default(null),
  dockPosition: z.enum(['left', 'right']).default('right'),
  leftTabs: z.array(TabSchema).default([
    { id: '1', name: 'App' },
    { id: '2', name: 'Work' }
  ]),
  topTabs: z.record(z.string(), z.array(TabSchema)).default({
    '1': [
      { id: 'top-1', name: 'Top 1' },
      { id: 'top-2', name: 'Top 2' }
    ]
  }),
  // 009: 历史记录条数上限（默认 10，FR-006/Q5）
  historyLimit: z.number().default(10),
});

export const AppListSchema = z.array(LaunchItemSchema);

export type LaunchItemType = 'app' | 'link' | 'script' | 'command' | 'separator';

export type SettingType = 'switch' | 'input' | 'select' | 'shortcut' | 'readonly_shortcut';

export interface SettingOption {
  label: string;
  value: string;
}

export type JsonValue = string | number | boolean | null | JsonValue[] | { [key: string]: JsonValue };

export type SettingValue = JsonValue;

// FR-012: 使用 discriminated union 替代 flat interface + as any，让 TypeScript 在各 type 分支自动窄化类型
interface BaseSetting {
  id: string;
  category: string;
  label: string;
  description?: string;
}

export interface SwitchSetting extends BaseSetting {
  type: 'switch';
  defaultValue: boolean;
}

export interface InputSetting extends BaseSetting {
  type: 'input';
  defaultValue: string;
}

export interface SelectSetting extends BaseSetting {
  type: 'select';
  defaultValue: string;
  options: SettingOption[];
}

export interface ShortcutSetting extends BaseSetting {
  type: 'shortcut';
  defaultValue: string;
}

export interface ReadonlyShortcutSetting extends BaseSetting {
  type: 'readonly_shortcut';
  defaultValue: string;
  appId?: string;
}

export type SettingSchema = SwitchSetting | InputSetting | SelectSetting | ShortcutSetting | ReadonlyShortcutSetting;

export interface ApiError {
  code: string;
  message: string;
}
