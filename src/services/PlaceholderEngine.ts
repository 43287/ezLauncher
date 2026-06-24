// 009: 占位符引擎（纯逻辑，可单测）
// 解析/替换/转义/缺值校验，复用并升级既有 LaunchService 宏替换。
// 详见 specs/009-interactive-launch-inputs/contracts/placeholder-grammar.md

import {
  KNOWN_PLACEHOLDERS,
  PLACEHOLDER_LEGACY_DROP_FILE,
} from "../constants/placeholders";

export interface ValidateResult {
  ok: boolean;
  missing: string[]; // 缺值的占位符名（不含花括号）
}

// 历史别名整体（带花括号）：{{drop_file}} 等价于 {target_file}
const LEGACY_DROP_TOKEN = `{{${PLACEHOLDER_LEGACY_DROP_FILE}}}`;

// 扫描模板中出现的已知占位符名（排除转义后的字面量），返回去重列表。
// 优先级（research R5）：先识别已知占位符名（含 {{drop_file}} 整体别名），
// 其余 {{x}} 视为转义字面量，不计入。
export function scanPlaceholders(template: string): string[] {
  const found = new Set<string>();
  if (!template) return [];

  // 1) 历史别名 {{drop_file}} 整体命中（映射到 target_file）
  if (template.includes(LEGACY_DROP_TOKEN)) {
    found.add(PLACEHOLDER_LEGACY_DROP_FILE);
  }

  // 2) 单花括号已知占位符 {name}
  //    用正则匹配 {name}，name ∈ 已知集合。避免匹配 {{name}}（转义）。
  for (const name of KNOWN_PLACEHOLDERS) {
    // 匹配未被双花括号包裹的 {name}
    const re = new RegExp(`(^|[^{])\\{${escapeRegExp(name)}\\}([^}]|$)`);
    if (re.test(template)) {
      found.add(name);
    }
  }

  return Array.from(found);
}

// 校验：模板中的已知占位符是否都有对应采集值。
// collected 的键为占位符名（不含花括号）。drop_file 别名以 target_file 的值满足。
export function validate(template: string, collected: Record<string, string>): ValidateResult {
  const used = scanPlaceholders(template);
  const missing: string[] = [];
  for (const name of used) {
    const key = name === PLACEHOLDER_LEGACY_DROP_FILE ? "target_file" : name;
    if (collected[key] === undefined || collected[key] === "") {
      // 报告时用模板里实际出现的名（别名仍报 drop_file 以便用户定位）
      missing.push(name);
    }
  }
  return { ok: missing.length === 0, missing };
}

// 渲染：先替换已知占位符（含 drop_file 别名），再把剩余的 {{x}}/}} 转义为字面花括号。
// 不对缺值占位符做空替换——调用方应先 validate。
export function render(template: string, collected: Record<string, string>): string {
  if (!template) return template ?? "";
  let out = template;

  // 1) 历史别名 {{drop_file}} → target_file 值（整体替换，先于通用转义）
  if (out.includes(LEGACY_DROP_TOKEN)) {
    const v = collected["target_file"];
    if (v !== undefined) {
      out = out.split(LEGACY_DROP_TOKEN).join(v);
    }
  }

  // 2) 单花括号已知占位符替换
  for (const name of KNOWN_PLACEHOLDERS) {
    const v = collected[name];
    if (v === undefined) continue;
    // 仅替换未被双花括号包裹的 {name}
    const re = new RegExp(`(^|[^{])\\{${escapeRegExp(name)}\\}(?!})`, "g");
    out = out.replace(re, (_m, pre) => `${pre}${v}`);
  }

  // 3) 转义：剩余的 {{ → {，}} → }（目标工具字面量直传）
  out = out.replace(/\{\{/g, "{").replace(/\}\}/g, "}");

  return out;
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}
