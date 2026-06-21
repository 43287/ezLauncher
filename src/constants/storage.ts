// 持久化与存储相关的集中常量，避免魔法值散落（FR-017）

// 数据保存防抖时长（毫秒）
export const PERSIST_DEBOUNCE_MS = 500;

// 默认呼出快捷键
export const DEFAULT_SUMMON_SHORTCUT = "Alt+Space";
export const DEFAULT_SUMMON_MOUSE_SHORTCUT = "Mouse4";

// 旧版便携标志的 localStorage 键（已迁移至注册表，仅用于过渡期清理）
export const LEGACY_PORTABLE_MODE_KEY = "portable_mode";
