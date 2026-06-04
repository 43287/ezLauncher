export type LaunchItemType = 'app' | 'link' | 'script' | 'separator';

export interface LaunchItem {
  id: string;
  name: string;
  type: LaunchItemType;
  executable_path?: string; // for 'app', 'script'
  url?: string;             // for 'link'
  shortcut: string | null;
  icon_base64?: string;
}

// Keep AppEntity for backward compatibility or replace it?
// The task says "将原有的 AppEntity 扩展为多态的 LaunchItem 接口".
// We will rename AppEntity to LaunchItem across the codebase.
export type SettingType = 'switch' | 'input' | 'select';

export interface SettingOption {
  label: string;
  value: string;
}

export interface SettingSchema {
  id: string;
  category: string;
  label: string;
  description?: string;
  type: SettingType;
  options?: SettingOption[];
  defaultValue: any;
}
