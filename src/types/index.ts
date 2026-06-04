export interface AppEntity {
  id: string;
  name: string;
  executable_path: string;
  shortcut: string | null;
  icon_base64?: string;
}
