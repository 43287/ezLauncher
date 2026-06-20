import { LaunchItem } from "../types";
import { platform } from "../api/platform";

export class LaunchService {
  /**
   * 解析应用启动的上下文信息，包括参数、环境变量和工作目录的宏替换
   * @param app 应用实体信息
   * @param dropPaths 拖拽到应用上的文件路径列表
   * @returns 返回解析后的启动上下文部分信息
   */
  public static buildLaunchContext(app: LaunchItem, dropPaths?: string[]): { argsArray: string[], cwd?: string, envs?: Record<string, string>, dropHandledInArgs: boolean } {
    // 1. 处理环境变量
    let envs: Record<string, string> | undefined = undefined;
    if (app.envVariables) {
      envs = {};
      app.envVariables.split('\n').forEach((line: string) => {
        const parts = line.split('=');
        if (parts.length >= 2) {
          const key = parts[0].trim();
          const val = parts.slice(1).join('=').trim();
          if (key) envs![key] = val;
        }
      });
      if (Object.keys(envs).length === 0) envs = undefined;
    }

    // 2. 处理 args 宏替换
    let finalArgsStr = app.args || "";
    let dropHandledInArgs = false;
    if (dropPaths && dropPaths.length > 0) {
      const firstPath = dropPaths[0];
      const parentDir = firstPath.substring(0, Math.max(firstPath.lastIndexOf('\\'), firstPath.lastIndexOf('/')));

      if (finalArgsStr.includes("{target_path}") || finalArgsStr.includes("{target_file}") || finalArgsStr.includes("{{drop_file}}")) {
        // 替换 {target_path}
        if (parentDir) {
          finalArgsStr = finalArgsStr.replace(/\{target_path\}/g, `"${parentDir}"`);
        }
        
        // 替换 {target_file} 和旧版兼容的 {{drop_file}}
        const replacement = dropPaths.map(p => `"${p}"`).join(' ');
        finalArgsStr = finalArgsStr.replace(/\{target_file\}/g, replacement);
        finalArgsStr = finalArgsStr.replace(/\{\{drop_file\}\}/g, replacement);
        
        dropHandledInArgs = true;
      } else {
        // 默认追加行为
        finalArgsStr += " " + dropPaths.map(p => `"${p}"`).join(' ');
      }
    }

    // 由于后端已经引入了 shell-words 解析器，我们不再在前端使用容易出错的正则表达式拆分。
    // 直接将整个宏替换后的字符串作为单一元素数组传给后端，后端检测到长度为 1 时会自动解析。
    const argsArray: string[] = finalArgsStr.trim() ? [finalArgsStr.trim()] : [];

    // 3. 处理 cwd 宏替换
    let finalCwd = app.cwd || undefined;
    if (dropPaths && dropPaths.length > 0 && finalCwd) {
      const firstPath = dropPaths[0];
      const parentDir = firstPath.substring(0, Math.max(firstPath.lastIndexOf('\\'), firstPath.lastIndexOf('/')));
      if (parentDir) {
        finalCwd = finalCwd.replace(/\{target_path\}/g, parentDir);
        finalCwd = finalCwd.replace(/\{\{drop_dir\}\}/g, parentDir);
      }
    }

    return { argsArray, cwd: finalCwd, envs, dropHandledInArgs };
  }

  /**
   * 执行应用的启动逻辑
   * @param app 应用实体信息
   * @param forceAdmin 是否强制以管理员身份运行
   * @param dropPaths 拖拽到应用上的文件路径列表
   */
  public static async executeLaunch(app: LaunchItem, forceAdmin: boolean = false, dropPaths?: string[]): Promise<void> {
    if (app.type === 'separator') return;
    const runAsAdmin = forceAdmin || app.runAsAdmin || false;
    try {
      // 启动前先隐藏窗口，提升响应速度体验
      await platform.hideWindow();
      if (app.type === 'link' && app.url) {
        // 对于网页链接，交给 Rust 后端调用 open crate 处理
        await platform.launchApp(app.url, [], runAsAdmin);
      } else if (app.type === 'command') {
        const { argsArray, cwd, envs } = this.buildLaunchContext(app, dropPaths);
        
        let shellExe = app.executablePath || 'pwsh';
        let shellArgs: string[] = [];
        
        if (shellExe === 'pwsh' || shellExe === 'powershell') {
          shellArgs = ['-NoProfile', '-Command', argsArray.join(' ')];
        } else if (shellExe === 'cmd') {
          shellArgs = ['/C', argsArray.join(' ')];
        } else if (shellExe === 'bash') {
          shellArgs = ['-c', argsArray.join(' ')];
        } else {
          shellArgs = argsArray;
        }

        // 如果用户要求在终端中运行，我们通过 cmd /C start 来弹出一个新的终端窗口
        if (app.inTerminal) {
          const terminalArgs = ['/C', 'start', shellExe, ...shellArgs];
          await platform.launchApp('cmd.exe', terminalArgs, runAsAdmin, cwd, envs);
        } else {
          await platform.launchApp(shellExe, shellArgs, runAsAdmin, cwd, envs);
        }
      } else if (app.executablePath) {
        const { argsArray, cwd, envs } = this.buildLaunchContext(app, dropPaths);
        await platform.launchApp(app.executablePath, argsArray, runAsAdmin, cwd, envs);
      }
    } catch (error) {
      console.error("Failed to launch app:", error);
    }
  }
}
