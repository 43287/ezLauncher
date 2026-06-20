import { z } from 'zod';
import type { LaunchItem as RustLaunchItem } from './LaunchItem';
import type { Tab as RustTab } from './Tab';
import type { SettingsConfig as RustSettingsConfig } from './SettingsConfig';

export type Tab = RustTab;

export type LaunchItem = RustLaunchItem;

export type SettingsConfig = RustSettingsConfig;

// 由于 Zod 主要用于运行时校验（特别是防御无效的 JSON 文件或合并默认值），
// 我们可以基于自动生成的接口类型来定义 Zod Schema，从而保持两端的契约安全。

export const TabSchema = z.object({
  id: z.string(),
  name: z.string(),
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

export interface SettingSchema {
  id: string;
  category: string;
  label: string;
  description?: string;
  type: SettingType;
  options?: SettingOption[];
  defaultValue: unknown;
}

export interface ApiError {
  code: string;
  message: string;
}
