export type LaunchItemType = 'app' | 'link' | 'script' | 'separator';

export interface LaunchItem {
  id: string;
  name: string;
  type: LaunchItemType;
  executablePath?: string; // for 'app', 'script'
  url?: string;             // for 'link'
  shortcut: string | null;
  iconUrl?: string;
  args?: string;
  runAsAdmin?: boolean;
  categoryId?: string;
  columnId?: string;
}

export type SettingType = 'switch' | 'input' | 'select';

export type Tab = {
  id: string;
  name: string;
};

export interface SettingOption {
  label: string;
  value: string;
}

export type SettingValue = boolean | string | number | Record<string, unknown> | unknown[];

export interface SettingSchema {
  id: string;
  category: string;
  label: string;
  description?: string;
  type: SettingType;
  options?: SettingOption[];
  defaultValue: SettingValue;
}
