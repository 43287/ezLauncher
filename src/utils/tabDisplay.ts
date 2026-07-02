// 侧边栏标签显示工具：中英文检测与智能截断

// 检测文本是否包含中文字符（CJK 统一表意文字常用区段）
export function containsChinese(text: string): boolean {
    return /[一-龥]/.test(text);
}

// 智能截断标签名称：中文显示 2 个字符，英文/数字显示 4 个字符，混合按中文规则
export function getTruncatedTabName(name: string): string {
    const maxLength = containsChinese(name) ? 2 : 4;
    return name.slice(0, maxLength);
}
