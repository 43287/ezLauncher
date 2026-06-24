// 009: 采集协调者（CollectionCoordinator）
// 按 inputPipeline 顺序驱动采集子窗口，累积采集值，全部完成后替换占位符并启动；
// 任一取消/窗口销毁 → 中止整流程并关闭所有采集窗口（research R6，contracts/collector-windows.md）。
//
// 设计：把"纯流程编排"与"窗口/IPC 副作用"分离。runPipeline 接收一个 CollectorDriver，
// 便于单测注入假驱动（T021）。生产环境用 WebviewCollectorDriver（真实子窗口）。

import type { CollectionStep, LaunchItem } from "../types";
import { validate, render } from "./PlaceholderEngine";
import {
  PLACEHOLDER_TARGET_FILE,
  PLACEHOLDER_TARGET_PATH,
} from "../constants/placeholders";
import { deriveParentDir } from "../utils/pathDerive";

// 单步采集的结果
export interface StepOutcome {
  cancelled: boolean;
  value?: string;       // 采集到的原始值（用于历史与替换）
  display?: string;
}

// 驱动器：负责把"展示一个采集步骤并等待用户结果"这件事落地（真实=开子窗口）
export interface CollectorDriver {
  // 展示一步采集，resolve 为结果；用户取消/窗口销毁 → { cancelled: true }
  collect(step: CollectionStep, sessionId: string): Promise<StepOutcome>;
  // 关闭所有采集窗口（中止/完成时清理，保证无残留）
  closeAll(): Promise<void>;
}

// 启动执行器（生产=LaunchService.executeWithTemplate；测试可注入 spy）
export type LaunchExecutor = (
  app: LaunchItem,
  effectiveArgs: string | null,
  dropPaths?: string[],
) => Promise<void>;

// 进程存活校验器（生产=查询 enumerate_processes；测试可注入）
export type ProcessAliveChecker = (pidOrName: string) => Promise<boolean>;

export interface RunPipelineDeps {
  driver: CollectorDriver;
  launch: LaunchExecutor;
  onValueCollected?: (step: CollectionStep, value: string, display?: string) => void; // 历史写入钩子
  isProcessAlive?: ProcessAliveChecker; // 进程占位符存活校验（FR-019a）
  onMissing?: (missing: string[]) => void; // 缺值提示（FR-010）
  onProcessGone?: (value: string) => void; // 进程已退出提示（FR-019a）
}

export interface RunPipelineInput {
  sessionId: string;
  app: LaunchItem;
  effectiveTemplate: string;         // 预设选择后的有效模板（默认 = app.args ?? ""）
  steps: CollectionStep[];
  // 预置采集值（如 drop 首步已注入的拖入路径）
  initialCollected?: Record<string, string>;
  dropPaths?: string[];
}

export interface RunPipelineResult {
  status: "completed" | "cancelled" | "blocked";
  collected: Record<string, string>;
  missing?: string[];
}


/**
 * 纯流程编排：顺序采集 → 校验 → 替换 → 启动。
 * 任一步取消 → 立即中止（关闭窗口、不启动）。
 */
export async function runPipeline(
  input: RunPipelineInput,
  deps: RunPipelineDeps,
): Promise<RunPipelineResult> {
  const { sessionId, app, effectiveTemplate, steps, dropPaths } = input;
  const collected: Record<string, string> = { ...(input.initialCollected ?? {}) };

  try {
    for (const step of steps) {
      // drop 首步若已在 initialCollected 提供则跳过实际采集
      if (step.collectorType === "drop" && collected[step.targetPlaceholder] !== undefined) {
        continue;
      }

      const outcome = await deps.driver.collect(step, sessionId);
      if (outcome.cancelled || outcome.value === undefined) {
        await deps.driver.closeAll();
        return { status: "cancelled", collected };
      }

      collected[step.targetPlaceholder] = outcome.value;
      deps.onValueCollected?.(step, outcome.value, outcome.display);

      // 路径类采集自动补 {target_path}
      if (
        (step.targetPlaceholder === PLACEHOLDER_TARGET_FILE ||
          step.collectorType === "file" ||
          step.collectorType === "drop") &&
        collected[PLACEHOLDER_TARGET_PATH] === undefined
      ) {
        const dir = deriveParentDir(outcome.value.replace(/^"|"$/g, ""));
        if (dir) collected[PLACEHOLDER_TARGET_PATH] = `"${dir}"`;
      }
    }

    // 全部采集完成 → 关闭采集窗口
    await deps.driver.closeAll();

    // 缺值校验（FR-010）
    const v = validate(effectiveTemplate, collected);
    if (!v.ok) {
      deps.onMissing?.(v.missing);
      return { status: "blocked", collected, missing: v.missing };
    }

    // 进程存活校验（FR-019a）：模板含进程占位符时，执行前确认目标仍存活
    if (deps.isProcessAlive) {
      const procValue = collected["target_process"] ?? collected["process_name"];
      if (procValue !== undefined) {
        const alive = await deps.isProcessAlive(procValue);
        if (!alive) {
          deps.onProcessGone?.(procValue);
          return { status: "blocked", collected };
        }
      }
    }

    // 替换并启动（仅一次）
    const rendered = render(effectiveTemplate, collected);
    await deps.launch(app, rendered, dropPaths);
    return { status: "completed", collected };
  } catch (err) {
    // 异常时清理窗口，视为中止
    await deps.driver.closeAll();
    throw err;
  }
}
