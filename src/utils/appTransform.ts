// 从 PropertiesModal 抽离的纯逻辑：解释器推断、名称派生、保存前格式转换。
// 纯函数，便于单元测试与单一来源复用（FR-014/FR-015/FR-016）。

import { LaunchItem } from "../types";
import { getInterpreterForExtension } from "./icons";

// 根据脚本路径后缀推断解释器（单一来源：getInterpreterForExtension）
export function inferInterpreter(path: string): string | null {
    const match = path.match(/\.([^.\\/]+)$/);
    if (!match) return null;
    return getInterpreterForExtension(match[1]);
}

// 从路径派生不含扩展名的文件名
export function deriveNameFromPath(path: string): string | null {
    const match = path.match(/[^\\/]+$/);
    if (!match) return null;
    return match[0].replace(/\.[^/.]+$/, "");
}

export interface PropertiesFormData {
    name: string;
    shortcut: string;
    iconUrl: string;
    cwd: string;
    envVariables: string;
    runAsAdmin: boolean;
    executablePath: string;
    url: string;
    args: string;
    scriptPath: string;
    executorPath: string;
    commandText: string;
    shell: string;
    inTerminal: boolean;
}

// 按条目类型将表单数据规范化为待保存的 LaunchItem（行为与原 PropertiesModal.handleSave 等价）
export function normalizeAppForSave(app: LaunchItem, form: PropertiesFormData): LaunchItem {
    const finalApp: LaunchItem = {
        ...app,
        name: form.name,
        shortcut: form.shortcut || null,
        iconUrl: form.iconUrl,
        cwd: form.cwd,
        envVariables: form.envVariables,
        runAsAdmin: form.runAsAdmin,
    };

    if (app.type === "script") {
        finalApp.executablePath = form.executorPath;
        finalApp.args = form.scriptPath;
        if (!finalApp.cwd) {
            finalApp.cwd = "{target_path}"; // 默认起始位置为目标路径
        }
    } else if (app.type === "command") {
        finalApp.executablePath = form.shell;
        finalApp.args = form.commandText;
        finalApp.inTerminal = form.inTerminal;
    } else {
        finalApp.executablePath = form.executablePath;
        finalApp.url = form.url;
        finalApp.args = form.args;
    }

    return finalApp;
}
