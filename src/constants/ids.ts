// 统一的标识符生成，替代散落的 Math.random() 实现（FR-018）

export function generateId(): string {
    return crypto.randomUUID();
}
