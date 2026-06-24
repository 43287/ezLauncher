// 占位符名集中定义（009 交互式启动输入系统）。
// 复用既有 {target_file}/{target_path} 约定，新增采集值占位符与转义约定。
// 详见 specs/009-interactive-launch-inputs/contracts/placeholder-grammar.md

// 已知占位符名（不含花括号）
export const PLACEHOLDER_TARGET_FILE = "target_file";   // 拖入目标 / 文件选择（带引号路径）
export const PLACEHOLDER_TARGET_PATH = "target_path";   // 拖入目标父目录
export const PLACEHOLDER_SELECTED_PATH = "selected_path"; // 文件/目录选择器结果
export const PLACEHOLDER_TARGET_PROCESS = "target_process"; // 进程选择器 → PID
export const PLACEHOLDER_PROCESS_NAME = "process_name";   // 进程选择器 → 映像名
export const PLACEHOLDER_TEXT = "text";                  // 文本输入器

// 旧版别名（历史兼容）：等价于 target_file
export const PLACEHOLDER_LEGACY_DROP_FILE = "drop_file";

// 全部已知占位符名集合（用于扫描/校验/转义优先级消解）
export const KNOWN_PLACEHOLDERS: readonly string[] = [
  PLACEHOLDER_TARGET_FILE,
  PLACEHOLDER_TARGET_PATH,
  PLACEHOLDER_SELECTED_PATH,
  PLACEHOLDER_TARGET_PROCESS,
  PLACEHOLDER_PROCESS_NAME,
  PLACEHOLDER_TEXT,
];

// 采集器类型 → 默认绑定占位符（配置 UI 的合理默认）
export const DEFAULT_PLACEHOLDER_BY_COLLECTOR: Record<string, string> = {
  process: PLACEHOLDER_TARGET_PROCESS,
  file: PLACEHOLDER_SELECTED_PATH,
  directory: PLACEHOLDER_SELECTED_PATH,
  text: PLACEHOLDER_TEXT,
  list: PLACEHOLDER_TEXT,
  drop: PLACEHOLDER_TARGET_FILE,
};

// 转义约定：模板中 {{name}} 表示字面量 {name}（不参与采集替换），
// 但 {{drop_file}} 作为历史别名整体优先命中为占位符（见 placeholder-grammar.md 优先级消解）。
