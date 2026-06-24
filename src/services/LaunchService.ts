import { LaunchItem } from "../types";
import { platform } from "../api/platform";
import { useToastStore } from "../store/useToastStore";

// 进程创建标志（与后端 windows.rs 约定一致）
const CREATE_NEW_CONSOLE = 0x00000010; // inTerminal：分配独立控制台窗口
const DETACHED_PROCESS = 0x00000008;   // 静默：无控制台运行

// 将字符串编码为 UTF-16LE 后 Base64，供 PowerShell -EncodedCommand 使用（FR-003）
function toBase64Utf16LE(str: string): string {
    const bytes: number[] = [];
    for (let i = 0; i < str.length; i++) {
        const code = str.charCodeAt(i);
        bytes.push(code & 0xFF);
        bytes.push((code >> 8) & 0xFF);
    }
    const binary = String.fromCharCode(...bytes);
    return btoa(binary);
}

export interface ShellInvocation {
  exe: string;
  shellArgs: string[];
  creationFlag: number;
}

/**
 * 纯函数：由 app + 已 render 的 argsArray 推导出 (可执行程序, shell 参数, 创建标志)。
 * 抽离以便单测（FR-027）。各 shell 分支均做防注入：
 * - pwsh/powershell：-EncodedCommand(base64/UTF-16LE)，元字符不参与解析。
 * - cmd：/K|/C + 命令串，后端用 raw_arg 原样下发，单次解析（不再 cmd /C start 二次解析）。
 * - bash：-c 单参传递。
 * - 其它 exe：直起，无 shell 拼接。
 * inTerminal=true → CREATE_NEW_CONSOLE（可见终端）；否则 DETACHED_PROCESS（静默）。
 */
export function buildShellInvocation(app: LaunchItem, argsArray: string[]): ShellInvocation {
  const exe = app.executablePath || 'pwsh';
  const keepOpen = !!app.inTerminal;
  const creationFlag = app.inTerminal ? CREATE_NEW_CONSOLE : DETACHED_PROCESS;
  const cmdStr = argsArray.join(' ');
  let shellArgs: string[];

  if (exe === 'pwsh' || exe === 'powershell') {
    const utf16le = toBase64Utf16LE(cmdStr);
    shellArgs = keepOpen
      ? ['-NoProfile', '-NoExit', '-EncodedCommand', utf16le]
      : ['-NoProfile', '-EncodedCommand', utf16le];
  } else if (exe === 'cmd') {
    // /K 执行后保留窗口；/C 执行后关闭
    shellArgs = [keepOpen ? '/K' : '/C', cmdStr];
  } else if (exe === 'bash') {
    shellArgs = keepOpen ? ['-c', `${cmdStr}; exec bash`] : ['-c', cmdStr];
  } else {
    shellArgs = argsArray;
  }

  return { exe, shellArgs, creationFlag };
}

export class LaunchService {
  /**
   * 以已确定（可能经占位符替换后）的参数/命令模板启动，供采集协调者调用。
   * effectiveArgs 为完整 render 后的参数字符串；当传入时覆盖 app.args。
   * dropPaths 仍用于兼容既有 {target_*} 在 buildLaunchContext 内的替换路径。
   * @param app 应用实体
   * @param effectiveArgs 已 render 的参数/命令模板（覆盖 app.args）
   * @param forceAdmin 是否强制管理员
   * @param dropPaths 拖入路径（用于兼容既有宏）
   */
  public static async executeWithTemplate(
    app: LaunchItem,
    effectiveArgs: string | null,
    forceAdmin: boolean = false,
    dropPaths?: string[],
  ): Promise<void> {
    const effectiveApp: LaunchItem = effectiveArgs !== null ? { ...app, args: effectiveArgs } : app;
    return this.executeLaunch(effectiveApp, forceAdmin, dropPaths);
  }

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

    // 参数下发契约（FR-022/007）：前端把宏替换后的整串作为【单元素数组】下发；
    // 后端检测到 len==1 时用 shell-words 拆分。所有路径类宏在替换时必须已加引号
    // （见上方 {target_path}/{target_file} 替换），以避免裸反斜杠被 POSIX 拆分吞掉。
    // 注意：command 类型不走此路径（改由 buildShellInvocation 产出多元素 shellArgs，
    // 不触发后端二次拆分）；此处仅服务于 link/exe 直起。
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
        // 直起 shell（不再用 cmd /C start 二次解析）；inTerminal 由创建标志决定可见控制台
        const { exe, shellArgs, creationFlag } = buildShellInvocation(app, argsArray);
        await platform.launchApp(exe, shellArgs, runAsAdmin, cwd, envs, creationFlag);
      } else if (app.executablePath) {
        const { argsArray, cwd, envs } = this.buildLaunchContext(app, dropPaths);
        await platform.launchApp(app.executablePath, argsArray, runAsAdmin, cwd, envs);
      }
    } catch (error) {
      // 启动失败必须可观测：提示用户并上抛，使交互式流程不把失败记为成功（FR-001）
      console.error("Failed to launch app:", error);
      useToastStore.getState().addToast(`启动失败：${app.name || '目标'}`, "error");
      throw error;
    }
  }
}
