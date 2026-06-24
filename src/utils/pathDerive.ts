// 路径父目录派生：统一实现，供采集流程复用（FR-023）。
// 支持 Windows `\` 与 `/` 混合分隔符；去除首尾引号；处理尾随分隔符与盘符根。

/**
 * 取路径的父目录。
 * - 先剥去可能存在的首尾双引号；
 * - 去掉尾随的分隔符再取最后一段之前的部分；
 * - 盘符根（如 `C:\`）或无父目录时返回空串。
 */
export function deriveParentDir(rawPath: string): string {
    const p = rawPath.replace(/^"|"$/g, "").replace(/[\\/]+$/, "");
    const idx = Math.max(p.lastIndexOf("\\"), p.lastIndexOf("/"));
    if (idx <= 0) return "";
    const parent = p.substring(0, idx);
    // 盘符根 `C:` → 补回 `\`，避免返回裸盘符
    if (/^[A-Za-z]:$/.test(parent)) return parent + "\\";
    return parent;
}
