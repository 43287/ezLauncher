import { describe, it, expect, vi } from "vitest";
import { runPipeline, type CollectorDriver, type RunPipelineDeps } from "../CollectionCoordinator";
import type { LaunchItem } from "../../types";

const app: LaunchItem = {
    id: "i1", name: "tool", type: "command",
    url: null, executablePath: "tool.exe", args: null, cwd: null, envVariables: null,
    runAsAdmin: null, inTerminal: null, isDir: null, iconUrl: null, shortcut: null,
    inputPipeline: null, paramPresets: null, multiParamEnabled: null,
    categoryId: "1", columnId: "1",
};

function driver(): CollectorDriver & { closeAllCalls: number } {
    const d = {
        closeAllCalls: 0,
        async collect() { return { cancelled: true }; },
        async closeAll() { d.closeAllCalls++; },
    };
    return d;
}

describe("collectionRunner / runPipeline 失败语义（FR-001/002）", () => {
    it("launch 抛错 → 上抛而非返回 completed，且清理采集窗口", async () => {
        const d = driver();
        const deps: RunPipelineDeps = {
            driver: d,
            launch: vi.fn(async () => { throw new Error("启动失败：目标不存在"); }),
        };
        await expect(
            runPipeline({ sessionId: "s", app, effectiveTemplate: "run", steps: [] }, deps),
        ).rejects.toThrow("启动失败");
        expect(d.closeAllCalls).toBeGreaterThanOrEqual(1); // 失败时清理采集窗口
    });

    it("无步骤且 launch 成功 → completed 且 launch 调用一次", async () => {
        const d = driver();
        const launch = vi.fn(async () => {});
        const res = await runPipeline(
            { sessionId: "s", app, effectiveTemplate: "run", steps: [] },
            { driver: d, launch },
        );
        expect(res.status).toBe("completed");
        expect(launch).toHaveBeenCalledTimes(1);
    });

    it("launch rejection 被 await 捕获，无 unhandled rejection", async () => {
        const d = driver();
        const rejection = Promise.reject(new Error("boom"));
        const deps: RunPipelineDeps = {
            driver: d,
            launch: () => rejection,
        };
        let caught: unknown = null;
        try {
            await runPipeline({ sessionId: "s", app, effectiveTemplate: "x", steps: [] }, deps);
        } catch (e) {
            caught = e;
        }
        expect(caught).toBeInstanceOf(Error);
    });
});
