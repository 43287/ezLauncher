export type LaunchItemType = 'app' | 'link' | 'script' | 'command' | 'separator';

export interface LaunchItem {
  id: string;
  name: string;
  type: LaunchItemType;
  executablePath?: string; // for 'app', 'script', 'command' (as shell)
  url?: string;             // for 'link'
  shortcut: string | null;
  iconUrl?: string;
  args?: string;            // for 'app', 'script' (as path), 'command' (as the actual command)
  runAsAdmin?: boolean;
  cwd?: string;
  envVariables?: string;
  inTerminal?: boolean;     // for 'command'
  categoryId?: string;
  columnId?: string;
}

export type SettingType = 'switch' | 'input' | 'select' | 'shortcut' | 'readonly_shortcut';

export type Tab = {
  id: string;
  name: string;
};

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
