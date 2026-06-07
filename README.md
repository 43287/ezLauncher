# ezLauncher

ezLauncher 是一款基于 Rust 和 TypeScript (Tauri) 开发的轻量级、高性能 Windows 平台程序启动器。它专注于提供极简的 UI 体验与强大的底层执行控制能力。

## 🛠️ 技术栈与架构

本项目采用前后端分离架构，兼顾了现代 Web 的灵活 UI 与 Rust 的极致性能和系统级控制力。

- **前端 (Frontend)**: React, TypeScript, Tailwind CSS, Zustand, Vite
- **后端 (Backend)**: Rust, Tauri 2.0, Windows API (Win32)
- **运行环境**: 本项目深度集成了 Windows 底层 API（如 DPAPI、ShellExecuteW、命名管道等），因此**仅支持 Windows 平台**编译与运行。

## ✨ 核心功能

- **🚀 多类型启动支持**：支持添加应用程序 (`.exe`)、脚本、网页链接 (`http/https`) 以及直接执行系统命令。
- **📁 拖拽执行与宏替换**：支持将文件/文件夹直接拖拽至快捷方式图标上并带参执行。支持命令行参数的动态宏替换（如 `{target_path}`, `{target_file}`, `{{drop_file}}`）。

## 💻 编译与运行方式

### 1. 环境要求

- **Windows 操作系统** (Windows 10/11)
- **Node.js** (推荐 v18+)
- **Rust 工具链** (通过 rustup 安装)
- **C++ 构建工具** (安装 Visual Studio Build Tools，并勾选“使用 C++ 的桌面开发”)

### 2. 开发环境运行

克隆或下载本仓库代码后，在项目根目录打开终端，执行以下命令：

```bash
# 安装前端依赖
npm install

# 启动开发服务器（带热更新）
npm run tauri dev
```

### 3. 编译打包

构建用于生产环境的可执行文件：

- **构建便携版 (Portable 推荐)**：
  该命令会编译程序并自动将提取出的单文件 `ezLauncher.exe` 放置到项目根目录的 `output/` 文件夹中。
  ```bash
  npm run build:portable
  ```
- **构建标准安装包**：
  使用 Tauri 默认的构建流程，会在 `src-tauri/target/release/bundle/` 目录下生成完整的 `.msi` 或 `.exe` 安装程序。
  ```bash
  npm run tauri build
  ```

## 📄 开源协议

[MIT License](LICENSE)
