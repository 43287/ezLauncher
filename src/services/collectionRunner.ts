// 009: 生产环境采集驱动（真实 Tauri 子窗口）+ 协调者入口。
// 把抽象的 CollectorDriver 落地为：创建置顶子窗口、经事件收结果、用完关闭。
// contracts/collector-windows.md

import { WebviewWindow } from "@tauri-apps/api/webviewWindow";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type { CollectionStep, LaunchItem } from "../types";
import type {
  CollectorDriver,
  StepOutcome,
} from "./CollectionCoordinator";
import { runPipeline } from "./CollectionCoordinator";
import { LaunchService } from "./LaunchService";
import { useHistoryStore } from "../store/useHistoryStore";
import { useToastStore } from "../store/useToastStore";
import { platform } from "../api/platform";
import {
  COLLECTOR_RESULT,
  COLLECTOR_CANCEL,
} from "../constants/events";
import type { CollectorResultPayload, CollectorCancelPayload } from "../types/collector";
import { generateId } from "../constants/ids";
import { deriveParentDir } from "../utils/pathDerive";

// 采集窗口尺寸（按类型）
function windowSizeFor(type: string): { width: number; height: number } {
  switch (type) {
    case "process":
      return { width: 520, height: 560 };
    case "list":
      return { width: 420, height: 420 };
    case "text":
      return { width: 440, height: 220 };
    default:
      return { width: 460, height: 360 };
  }
}

// 真实子窗口驱动：同一时刻仅一个可见（SC-008），用完销毁（FR-007/020）
class WebviewCollectorDriver implements CollectorDriver {
  private labels: string[] = [];
  private itemId: string;

  constructor(itemId: string) {
    this.itemId = itemId;
  }

  async collect(step: CollectionStep, sessionId: string): Promise<StepOutcome> {
    // file/directory 走系统对话框，不另开 webview（research R4），但仍要带历史复用 → 用轻量子窗口承载。
    const label = `collector-${step.collectorType}-${generateId().slice(0, 8)}`;
    const { width, height } = windowSizeFor(step.collectorType);

    // 步骤配置（label/options/initialValue）经 URL 传给子窗口
    const cfg = encodeURIComponent(
      JSON.stringify({
        label: step.label ?? undefined,
        options: step.options ?? undefined,
        initialValue: step.initialValue ?? undefined,
      }),
    );
    const url = `index.html#/collector/${encodeURIComponent(step.collectorType)}?session=${encodeURIComponent(
      sessionId,
    )}&step=${encodeURIComponent(step.id)}&ph=${encodeURIComponent(step.targetPlaceholder)}&item=${encodeURIComponent(
      this.itemId,
    )}&cfg=${cfg}`;

    return new Promise<StepOutcome>((resolve) => {
      let settled = false;
      let unlistenResult: UnlistenFn | null = null;
      let unlistenCancel: UnlistenFn | null = null;
      let unlistenDestroyed: UnlistenFn | null = null;
      let unlistenError: UnlistenFn | null = null;
      let win: WebviewWindow | null = null;

      const cleanup = async () => {
        if (unlistenResult) unlistenResult();
        if (unlistenCancel) unlistenCancel();
        // 窗口生命周期监听器同样解绑，避免协调者外部销毁时累积闭包（FR-014）
        if (unlistenDestroyed) unlistenDestroyed();
        if (unlistenError) unlistenError();
      };

      const finish = async (outcome: StepOutcome) => {
        if (settled) return;
        settled = true;
        await cleanup();
        resolve(outcome);
      };

      const setup = async () => {
        unlistenResult = await listen<CollectorResultPayload>(COLLECTOR_RESULT, (e) => {
          if (e.payload.sessionId === sessionId && e.payload.stepId === step.id) {
            void finish({ cancelled: false, value: e.payload.value, display: e.payload.display });
          }
        });
        unlistenCancel = await listen<CollectorCancelPayload>(COLLECTOR_CANCEL, (e) => {
          if (e.payload.sessionId === sessionId && e.payload.stepId === step.id) {
            void finish({ cancelled: true });
          }
        });

        win = new WebviewWindow(label, {
          url,
          width,
          height,
          center: true,
          alwaysOnTop: true,
          decorations: false,
          transparent: true,
          skipTaskbar: true,
          resizable: false,
          // 无装饰窗口在 Windows 上若 shadow=true（默认）会被系统画出 1px 白色边框，
          // 该边框在 show() 瞬间出现、而内容 opacity-0 淡入 → "先边框后内容"。
          // 关闭系统阴影/边框，圆角由内容 rounded-xl 提供（与主窗口一致）。
          shadow: false,
          // 隐藏创建，待子窗口内容首帧绘制后由 CollectorShell 调 show()，
          // 消除 WebView2 创建时的白屏与"加载后刷新"闪烁
          visible: false,
          focus: true,
          title: step.label ?? "ezLauncher",
        });
        this.labels.push(label);

        // 窗口被销毁（用户点叉/系统关闭）等价于取消（FR-007/018）。
        // 保存 UnlistenFn 以便 cleanup 解绑（FR-014）。
        unlistenDestroyed = await win.once("tauri://destroyed", () => {
          void finish({ cancelled: true });
        });
        unlistenError = await win.once("tauri://error", () => {
          void finish({ cancelled: true });
        });
      };

      void setup();
    }).then(async (outcome) => {
      // 当前步骤结束即关闭其窗口，保证唯一可见
      await this.closeWindow(label);
      return outcome;
    });
  }

  // 协调者唯一关闭者：强制销毁 + 轮询确认窗口确已消失（根因2/4，FR-002/005）。
  // 用 destroy()（强制拆除，不走可被拦截的 CloseRequested）取代 close()；
  // 销毁后 getByLabel 轮询，残留则重试 destroy 并以 hide 兜底，保证零残留、不拦截。
  private async closeWindow(label: string) {
    await this.ensureGone(label);
    this.labels = this.labels.filter((l) => l !== label);
  }

  private async ensureGone(label: string): Promise<void> {
    for (let attempt = 0; attempt < 5; attempt++) {
      let w: WebviewWindow | null = null;
      try {
        w = await WebviewWindow.getByLabel(label);
      } catch {
        w = null;
      }
      if (!w) return; // 已确认销毁
      try {
        await w.destroy();
      } catch {
        /* ignore，下轮重试 */
      }
      // 立即复核：destroy 成功（绝大多数路径）即返回，避免无谓的 hide + 50ms 轮询（FR-019）
      let still: WebviewWindow | null = null;
      try {
        still = await WebviewWindow.getByLabel(label);
      } catch {
        still = null;
      }
      if (!still) return;
      // 仅当销毁顽固失败时才 hide 兜底（确保不可见、不拦截）并退避重试
      try {
        await still.hide();
      } catch {
        /* ignore */
      }
      await new Promise((resolve) => setTimeout(resolve, 50));
    }
  }

  async closeAll(): Promise<void> {
    const labels = [...this.labels];
    for (const label of labels) {
      await this.closeWindow(label);
    }
  }
}

// 进程存活校验：按 PID 或进程名在当前枚举结果中查找（FR-019a）
async function isProcessAlive(pidOrName: string): Promise<boolean> {
  try {
    const procs = await platform.enumerateProcesses();
    const asPid = Number(pidOrName);
    if (!Number.isNaN(asPid) && asPid > 0) {
      return procs.some((p) => p.pid === asPid);
    }
    return procs.some((p) => p.name.toLowerCase() === pidOrName.toLowerCase());
  } catch {
    // 无法校验时不阻断（保守放行，避免误杀）
    return true;
  }
}

// 预设选择：弹出 list 采集器让用户选命令变体（US2，FR-012/013）。
// 返回选中的 template；取消返回 null；无需选择（未启用/空）返回 undefined。
async function selectPreset(app: LaunchItem, sessionId: string): Promise<string | null | undefined> {
  if (!app.multiParamEnabled) return undefined;
  const presets = app.paramPresets ?? [];
  if (presets.length === 0) return undefined; // 空列表回退默认（FR-014）

  const driver = new WebviewCollectorDriver(app.id);
  const step: CollectionStep = {
    id: "preset",
    collectorType: "list",
    targetPlaceholder: "__preset__",
    label: "选择操作",
    options: presets.map((p) => p.displayName),
    initialValue: null,
  };
  const outcome = await driver.collect(step, sessionId);
  await driver.closeAll();
  if (outcome.cancelled || outcome.value === undefined) return null;
  const chosen = presets.find((p) => p.displayName === outcome.value);
  return chosen ? chosen.template : undefined;
}

export interface StartCollectionInput {
  app: LaunchItem;
  effectiveTemplate: string;
  steps: CollectionStep[];
  initialCollected?: Record<string, string>;
  dropPaths?: string[];
}

// 协调者入口：组装真实依赖并运行流水线
export async function startCollection(input: StartCollectionInput): Promise<void> {
  const driver = new WebviewCollectorDriver(input.app.id);
  const sessionId = generateId();
  const toast = useToastStore.getState();

  try {
    const result = await runPipeline(
      {
        sessionId,
        app: input.app,
        effectiveTemplate: input.effectiveTemplate,
        steps: input.steps,
        initialCollected: input.initialCollected,
        dropPaths: input.dropPaths,
      },
      {
        driver,
        // 占位符替换已由 PlaceholderEngine 完成，不再向 executeLaunch 传 dropPaths，
        // 避免 buildLaunchContext 二次追加拖入文件（双重处理）
        launch: (app, effectiveArgs) =>
          LaunchService.executeWithTemplate(app, effectiveArgs, false),
        onValueCollected: (step, value, display) => {
          // 进程类历史存名而非 PID（research R8）：display 优先作为名
          const histValue =
            step.collectorType === "process" && display ? display : value;
          useHistoryStore.getState().add(input.app.id, step.collectorType, histValue, display);
        },
        isProcessAlive,
        onMissing: (missing) => {
          toast.addToast(`缺少必要的输入：${missing.join(", ")}，已取消启动`, "error");
        },
        onProcessGone: () => {
          toast.addToast("目标进程已退出或不存在，已取消启动", "error");
        },
      },
    );

    if (result.status === "cancelled") {
      // 静默取消，无需提示
      return;
    }
  } catch (err) {
    // 流程异常（含启动失败 rethrow）：保证窗口清理 + 不产生未处理拒绝（FR-002）。
    // 启动失败本身已由 executeLaunch toast，此处仅兜底日志，避免重复提示。
    await driver.closeAll();
    console.error("Collection pipeline failed:", err);
  }
}

// 判断 item 是否需要交互式启动（有预设或输入流程）
export function needsInteractiveLaunch(app: LaunchItem): boolean {
  const hasPresets = !!app.multiParamEnabled && (app.paramPresets?.length ?? 0) > 0;
  const hasPipeline = (app.inputPipeline?.steps?.length ?? 0) > 0;
  return hasPresets || hasPipeline;
}

/**
 * 交互式启动统一入口（US1–US4）。被 ShortcutItem 双击与拖入命中时调用。
 * 顺序：预设选择（可选）→ 多步采集（可选）→ 占位符替换 → 启动。
 * 任一环节取消则整体不执行。dropPaths 注入 drop 首步。
 */
export async function launchItemInteractive(app: LaunchItem, dropPaths?: string[]): Promise<void> {
  const sessionId = generateId();
  const toast = useToastStore.getState();

  // 1) 预设选择（US2）
  let effectiveTemplate = app.args ?? "";
  const presetTemplate = await selectPreset(app, sessionId);
  if (presetTemplate === null) {
    // 用户在预设选择处取消
    return;
  }
  if (presetTemplate !== undefined) {
    effectiveTemplate = presetTemplate;
  }

  // 2) 组装步骤与预置采集值
  const steps = app.inputPipeline?.steps ?? [];
  const initialCollected: Record<string, string> = {};
  if (dropPaths && dropPaths.length > 0) {
    // 拖入路径作为 drop 首步 / 兼容既有 {target_file}
    const quoted = dropPaths.map((p) => `"${p}"`).join(" ");
    initialCollected["target_file"] = quoted;
    const firstDir = deriveParentDir(dropPaths[0]);
    if (firstDir) initialCollected["target_path"] = `"${firstDir}"`;
  }

  // 无步骤但有预设：直接替换并启动（UPX 加壳/脱壳即此路径）
  if (steps.length === 0) {
    const driver = new WebviewCollectorDriver(app.id);
    try {
      const result = await runPipeline(
        { sessionId, app, effectiveTemplate, steps: [], initialCollected, dropPaths },
        {
          driver,
          launch: (a, args) => LaunchService.executeWithTemplate(a, args, false),
          isProcessAlive,
          onMissing: (m) => toast.addToast(`缺少必要的输入：${m.join(", ")}，已取消启动`, "error"),
          onProcessGone: () => toast.addToast("目标进程已退出或不存在，已取消启动", "error"),
        },
      );
      if (result.status === "blocked") return;
    } catch (err) {
      // 启动失败已由 executeLaunch toast；此处兜底清理 + 防未处理拒绝（FR-002）
      await driver.closeAll();
      console.error("Collection pipeline failed:", err);
    }
    return;
  }

  // 3) 多步采集 + 启动
  await startCollection({ app, effectiveTemplate, steps, initialCollected, dropPaths });
}
