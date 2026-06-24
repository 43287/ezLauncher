import { describe, it, expect } from "vitest";
import { buildShellInvocation } from "../LaunchService";
import type { LaunchItem } from "../../types";

const CREATE_NEW_CONSOLE = 0x00000010;
const DETACHED_PROCESS = 0x00000008;

function app(over: Partial<LaunchItem>): LaunchItem {
    return {
        id: "i1", name: "t", type: "command",
        url: null, executablePath: over.executablePath ?? null, args: null, cwd: null, envVariables: null,
        runAsAdmin: null, inTerminal: over.inTerminal ?? null, isDir: null, iconUrl: null, shortcut: null,
        inputPipeline: null, paramPresets: null, multiParamEnabled: null,
        categoryId: "1", columnId: "1",
        ...over,
    };
}

describe("buildShellInvocation", () => {
    it("默认无 executablePath → pwsh + EncodedCommand（多元素，不触发后端二次拆分）", () => {
        const { exe, shellArgs, creationFlag } = buildShellInvocation(app({}), ["echo", "hi"]);
        expect(exe).toBe("pwsh");
        expect(shellArgs[0]).toBe("-NoProfile");
        expect(shellArgs).toContain("-EncodedCommand");
        expect(shellArgs.length).toBeGreaterThan(1);
        expect(creationFlag).toBe(DETACHED_PROCESS);
    });

    it("pwsh：元字符整串 base64(UTF-16LE)，不以明文参与解析", () => {
        const malicious = ['echo', '1', '&&', 'calc', '|', 'whoami', '"x"', '%PATH%'];
        const { shellArgs } = buildShellInvocation(app({ executablePath: "pwsh" }), malicious);
        const encoded = shellArgs[shellArgs.indexOf("-EncodedCommand") + 1];
        // 编码段不得包含任何原始 shell 元字符
        expect(encoded).not.toMatch(/[&|"%]/);
        // 解码还原为 UTF-16LE 原串，证明元字符被字面保留
        const bin = atob(encoded);
        let decoded = "";
        for (let i = 0; i < bin.length; i += 2) {
            decoded += String.fromCharCode(bin.charCodeAt(i) | (bin.charCodeAt(i + 1) << 8));
        }
        expect(decoded).toBe(malicious.join(" "));
    });

    it("inTerminal=true → CREATE_NEW_CONSOLE 且 pwsh 带 -NoExit", () => {
        const { shellArgs, creationFlag } = buildShellInvocation(app({ executablePath: "pwsh", inTerminal: true }), ["ls"]);
        expect(creationFlag).toBe(CREATE_NEW_CONSOLE);
        expect(shellArgs).toContain("-NoExit");
    });

    it("cmd：/C + 原命令串（单元素命令，后端 raw_arg 原样下发），不再 cmd /C start 包装", () => {
        const { exe, shellArgs } = buildShellInvocation(app({ executablePath: "cmd" }), ["dir", "&&", "calc"]);
        expect(exe).toBe("cmd");
        expect(shellArgs[0]).toBe("/C");
        expect(shellArgs[1]).toBe("dir && calc");
        // 不得出现 start 二次解析包装
        expect(shellArgs).not.toContain("start");
        expect(shellArgs.length).toBeGreaterThan(1);
    });

    it("cmd + inTerminal → /K 保留窗口", () => {
        const { shellArgs } = buildShellInvocation(app({ executablePath: "cmd", inTerminal: true }), ["dir"]);
        expect(shellArgs[0]).toBe("/K");
    });

    it("bash：-c 单参传递；inTerminal 追加 exec bash", () => {
        const a = buildShellInvocation(app({ executablePath: "bash" }), ["echo", "x"]);
        expect(a.shellArgs).toEqual(["-c", "echo x"]);
        const b = buildShellInvocation(app({ executablePath: "bash", inTerminal: true }), ["echo", "x"]);
        expect(b.shellArgs[1]).toBe("echo x; exec bash");
    });

    it("其它 exe：直起，shellArgs 原样为 argsArray（无 shell 拼接）", () => {
        const argv = ["--flag", "C:\\a b\\x.txt"];
        const { exe, shellArgs } = buildShellInvocation(app({ executablePath: "C:\\tools\\app.exe" }), argv);
        expect(exe).toBe("C:\\tools\\app.exe");
        expect(shellArgs).toEqual(argv);
    });
});
