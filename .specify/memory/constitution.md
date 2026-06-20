<!--
Sync Impact Report
- Version: 1.0.0 (Initial Draft)
- Modified Principles: N/A (New Constitution)
- Added Sections: Core Principles, Development Standards, Workflow & Quality Gates, Governance
- Removed Sections: N/A
- Templates updated: N/A
-->
# ezLauncher Constitution

## Core Principles

### I. 专注于 Windows 平台与 Tauri 技术栈
本项目是一个基于 Rust + TypeScript (React) 的桌面应用。所有代码只需要在 Windows 下编译和运行，不考虑跨平台兼容性。必须充分利用 Windows 底层 API (Win32) 并结合 Tauri 架构优势。

### II. 严格的代码规范与风格
缩进保持为一个 Tab，长度为 4 个空格。
普通变量使用小驼峰命名 (camelCase)，常量使用全大写 (UPPER_SNAKE_CASE)，类名使用大驼峰命名 (PascalCase)。
避免在不必要的地方使用注释，注释要求简洁明了。

### III. 安全性与可靠性优先
每个函数和模块的实现必须考虑安全性和可靠性，避免潜在的安全漏洞和运行时错误。
涉及系统级控制（如 DPAPI 提权、命名管道）的代码需进行严格的边界和权限检查。

### IV. 高质量测试与文档要求
如若说明需要单元测试，则必须包含单元测试代码，且测试覆盖率必须超过 80%。
所有生成的代码与函数需提供复杂度估算，每个模块均要提供性能优化建议。
若要求输出报告或生成说明，对应报告/说明内容必须作为文件新建在 `docs` 文件夹下。

### V. 非破坏性修改与严谨交互
在修改或重构代码时，若无明确要求，严禁随意删除原始代码和相关注释。
生成代码时需先输出简要结论，再直接生成代码并给出注意事项；解答问题需详细解释并提供具体例子和替代方案。
对话与输出始终保持中文。

## Development Standards

### 技术栈要求
- 前端：React 19, TypeScript, Tailwind CSS, Zustand, Vite
- 后端：Rust, Tauri 2.0, Windows API (Win32)
- 构建：Node.js (v18+) 与 Rust 工具链

### 性能与安全底线
- 不允许任何未捕获的 Panic 或可能导致提权漏洞的安全缺陷。
- 复杂数据结构与任务调度必须考虑性能瓶颈，必要时引入异步非阻塞机制。

## Workflow & Quality Gates

### 提交流程与代码审查
- 所有新增功能必须进行自我检查，确保符合本宪章中的代码规范与安全性要求。
- 文档和设计报告应在 `docs/` 目录中集中管理。

## Governance
- 本宪章凌驾于其他所有实践之上；如与具体项目规则 (`project_rules.md`) 冲突，以项目规则为准。
- 对本宪章的修改需要进行文档记录和版本更新。

**Version**: 1.0.0 | **Ratified**: 2026-06-20 | **Last Amended**: 2026-06-20
