import { describe, it, expect, vi } from "vitest";
import { runPipeline, type CollectorDriver, type StepOutcome } from "../CollectionCoordinator";
import type { CollectionStep, LaunchItem } from "../../types";

function step(over: Partial<CollectionStep>): CollectionStep {
  return {
    id: over.id ?? "s1",
    collectorType: over.collectorType ?? "text",
    targetPlaceholder: over.targetPlaceholder ?? "text",
    label: over.label ?? null,
    options: over.options ?? null,
    initialValue: over.initialValue ?? null,
  };
}

const app: LaunchItem = {
  id: "i1", name: "tool", type: "app",
  url: null, executablePath: "tool.exe", args: null, cwd: null, envVariables: null,
  runAsAdmin: null, inTerminal: null, isDir: null, iconUrl: null, shortcut: null,
  inputPipeline: null, paramPresets: null, multiParamEnabled: null,
  categoryId: "1", columnId: "1",
};

// 可编程假驱动：按队列返回结果
function makeDriver(outcomes: StepOutcome[]): CollectorDriver & { closeAllCalls: number } {
  let i = 0;
  const d = {
    closeAllCalls: 0,
    async collect(): Promise<StepOutcome> {
      return outcomes[i++] ?? { cancelled: true };
    },
    async closeAll() {
      d.closeAllCalls++;
    },
  };
  return d;
}

describe("CollectionCoordinator.runPipeline", () => {
  it("顺序推进并最终启动一次", async () => {
    const driver = makeDriver([
      { cancelled: false, value: "1234" },
      { cancelled: false, value: '"C:\\h.dll"' },
    ]);
    const launch = vi.fn().mockResolvedValue(undefined);
    const res = await runPipeline(
      {
        sessionId: "S",
        app,
        effectiveTemplate: "--pid {target_process} --dll {target_file}",
        steps: [
          step({ id: "a", collectorType: "process", targetPlaceholder: "target_process" }),
          step({ id: "b", collectorType: "file", targetPlaceholder: "target_file" }),
        ],
      },
      { driver, launch },
    );
    expect(res.status).toBe("completed");
    expect(launch).toHaveBeenCalledTimes(1);
    expect(launch).toHaveBeenCalledWith(app, '--pid 1234 --dll "C:\\h.dll"', undefined);
  });

  it("取消中止：不启动，关闭所有窗口", async () => {
    const driver = makeDriver([{ cancelled: false, value: "x" }, { cancelled: true }]);
    const launch = vi.fn();
    const res = await runPipeline(
      {
        sessionId: "S",
        app,
        effectiveTemplate: "{text} {target_process}",
        steps: [
          step({ id: "a", targetPlaceholder: "text" }),
          step({ id: "b", collectorType: "process", targetPlaceholder: "target_process" }),
        ],
      },
      { driver, launch },
    );
    expect(res.status).toBe("cancelled");
    expect(launch).not.toHaveBeenCalled();
    expect(driver.closeAllCalls).toBeGreaterThanOrEqual(1);
  });

  it("缺值阻断：不启动并报告 missing（FR-010）", async () => {
    // 模板需要 target_process，但没有对应步骤
    const driver = makeDriver([{ cancelled: false, value: "hi" }]);
    const launch = vi.fn();
    const onMissing = vi.fn();
    const res = await runPipeline(
      {
        sessionId: "S",
        app,
        effectiveTemplate: "{text} {target_process}",
        steps: [step({ id: "a", targetPlaceholder: "text" })],
      },
      { driver, launch, onMissing },
    );
    expect(res.status).toBe("blocked");
    expect(res.missing).toContain("target_process");
    expect(launch).not.toHaveBeenCalled();
    expect(onMissing).toHaveBeenCalled();
  });

  it("完成仅启动一次（多步全部完成）", async () => {
    const driver = makeDriver([
      { cancelled: false, value: "a" },
      { cancelled: false, value: "b" },
      { cancelled: false, value: "c" },
    ]);
    const launch = vi.fn().mockResolvedValue(undefined);
    await runPipeline(
      {
        sessionId: "S",
        app,
        effectiveTemplate: "{text}",
        steps: [
          step({ id: "1", targetPlaceholder: "text" }),
          step({ id: "2", targetPlaceholder: "selected_path" }),
          step({ id: "3", targetPlaceholder: "process_name" }),
        ],
      },
      { driver, launch },
    );
    expect(launch).toHaveBeenCalledTimes(1);
  });

  it("drop 首步使用预置值，不重复采集", async () => {
    const driver = makeDriver([]); // 不应调用 collect
    const collectSpy = vi.spyOn(driver, "collect");
    const launch = vi.fn().mockResolvedValue(undefined);
    const res = await runPipeline(
      {
        sessionId: "S",
        app,
        effectiveTemplate: "open {target_file}",
        steps: [step({ id: "d", collectorType: "drop", targetPlaceholder: "target_file" })],
        initialCollected: { target_file: '"C:\\x.dll"' },
      },
      { driver, launch },
    );
    expect(res.status).toBe("completed");
    expect(collectSpy).not.toHaveBeenCalled();
    expect(launch).toHaveBeenCalledWith(app, 'open "C:\\x.dll"', undefined);
  });

  it("进程已退出则阻断（FR-019a）", async () => {
    const driver = makeDriver([{ cancelled: false, value: "9999" }]);
    const launch = vi.fn();
    const onProcessGone = vi.fn();
    const res = await runPipeline(
      {
        sessionId: "S",
        app,
        effectiveTemplate: "--pid {target_process}",
        steps: [step({ id: "p", collectorType: "process", targetPlaceholder: "target_process" })],
      },
      { driver, launch, isProcessAlive: async () => false, onProcessGone },
    );
    expect(res.status).toBe("blocked");
    expect(launch).not.toHaveBeenCalled();
    expect(onProcessGone).toHaveBeenCalledWith("9999");
  });
});
