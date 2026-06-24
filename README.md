# ezLauncher

ezLauncher 是一款基于 Rust 和 TypeScript (Tauri) 开发的轻量级、高性能 Windows 平台程序启动器。它专注于提供极简的 UI 体验与强大的底层执行控制能力。

## 🛠️ 技术栈与架构

本项目采用前后端分离架构，兼顾了现代 Web 的灵活 UI 与 Rust 的极致性能和系统级控制力。

- **前端 (Frontend)**: React, TypeScript, Tailwind CSS, Zustand, Vite
- **后端 (Backend)**: Rust, Tauri 2.0, Windows API (Win32)
- **运行环境**: 本项目深度集成了 Windows 底层 API（如 DPAPI、ShellExecuteW、命名管道等），因此**仅支持 Windows 平台**编译与运行。

## ✨ 核心功能

- **🚀 多类型启动支持**：应用程序 (`.exe`)、脚本 (`.py`/`.ps1`/`.sh` 等)、网页链接 (`http/https`)、Shell 命令 (`pwsh`/`cmd`/`bash`)，以及视觉分隔符。
- **📁 拖放与宏变量**：拖放文件到图标即可带参启动。支持 `{target_path}`、`{target_file}` 宏替换，详见 [用户指南](docs/user-guide.md#拖放与宏变量)。
- **🎛️ 交互式启动输入**：进程/文件/文本/列表四类采集器 + 历史记录；item 级“多参数附加”预设（如 UPX 加壳/脱壳单击即选即跑）；可组合的多步输入流程（DLL 注入器、在所选目录打开工具等）。详见 [交互式启动输入系统](docs/interactive-launch-inputs.md)。
- **🔐 管理员权限**：支持单个应用提权启动、右键以管理员运行、Shift+点击临时提权。通过命名管道 IPC 代理，无需反复 UAC 弹窗。
- **📦 便携模式**：数据跟随程序目录，整文件夹拷走即用。也可切换到系统用户目录模式。
- **⌨️ 全局快捷键**：自定义键盘/鼠标呼出快捷键（默认 `Alt+Space` / `Mouse4`），键盘网格导航，滚轮切换标签页。
- **🎨 图标系统**：内置 Lucide 图标库（可搜索）、系统预设 SVG、本地文件导入、URL/Base64、System32 系统程序浏览。
- **💾 数据安全**：DPAPI 加密存储、原子写入 + 备份（`.bak`）、配置文件损坏自动恢复。

📖 **完整使用指南**：[docs/user-guide.md](docs/user-guide.md)

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
pnpm install

# 启动开发服务器（带热更新）
pnpm tauri dev
```

### 3. 编译打包

构建用于生产环境的可执行文件：

- **构建便携版 (Portable 推荐)**：
  该命令会编译程序并自动将提取出的单文件 `ezLauncher.exe` 放置到项目根目录的 `output/` 文件夹中。
  ```bash
  pnpm build:portable
  ```
- **构建标准安装包**：
  使用 Tauri 默认的构建流程，会在 `src-tauri/target/release/bundle/` 目录下生成完整的 `.msi` 或 `.exe` 安装程序。
  ```bash
  pnpm tauri build
  ```

## 📄 开源协议

[MIT License](LICENSE)
