export type LaunchItemType = 'app' | 'link' | 'script' | 'separator';

export interface LaunchItem {
  id: string;
  name: string;
  type: LaunchItemType;
  executablePath?: string; // for 'app', 'script'
  url?: string;             // for 'link'
  shortcut: string | null;
  iconBase64?: string;
  iconUrl?: string;
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

export type SettingValue = boolean | string | number | object | any[];

export interface SettingSchema {
  id: string;
  category: string;
  label: string;
  description?: string;
  type: SettingType;
  options?: SettingOption[];
  defaultValue: SettingValue;
}
