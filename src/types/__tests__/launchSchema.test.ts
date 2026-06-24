import { describe, it, expect } from "vitest";
import {
    LaunchItemSchema,
    InputPipelineSchema,
    ParamPresetSchema,
    CollectionStepSchema,
} from "../index";

const base = {
    id: "i1",
    name: "tool",
    type: "command",
    categoryId: "1",
    columnId: "1",
};

describe("zod schema（FR-022）：inputPipeline / paramPresets", () => {
    it("CollectionStep：必填 + 可空字段", () => {
        expect(CollectionStepSchema.safeParse({
            id: "s1", collectorType: "text", targetPlaceholder: "x",
            label: null, options: null, initialValue: null,
        }).success).toBe(true);
        // 缺 collectorType → 失败
        expect(CollectionStepSchema.safeParse({ id: "s1", targetPlaceholder: "x" }).success).toBe(false);
    });

    it("InputPipeline：steps 必须为数组且元素合法", () => {
        expect(InputPipelineSchema.safeParse({ steps: [] }).success).toBe(true);
        expect(InputPipelineSchema.safeParse({ steps: [{ id: "s", collectorType: "text", targetPlaceholder: "p" }] }).success).toBe(true);
        // steps 非数组 → 失败
        expect(InputPipelineSchema.safeParse({ steps: "oops" }).success).toBe(false);
    });

    it("ParamPreset：三字段必填", () => {
        expect(ParamPresetSchema.safeParse({ id: "p", displayName: "d", template: "t" }).success).toBe(true);
        expect(ParamPresetSchema.safeParse({ id: "p", displayName: "d" }).success).toBe(false);
    });

    it("LaunchItem：合法 inputPipeline/paramPresets 通过", () => {
        const r = LaunchItemSchema.safeParse({
            ...base,
            inputPipeline: { steps: [{ id: "s", collectorType: "text", targetPlaceholder: "p" }] },
            paramPresets: [{ id: "p", displayName: "d", template: "t" }],
        });
        expect(r.success).toBe(true);
    });

    it("LaunchItem：缺省 / null 的 inputPipeline 均被接受（向后兼容）", () => {
        expect(LaunchItemSchema.safeParse({ ...base }).success).toBe(true);
        expect(LaunchItemSchema.safeParse({ ...base, inputPipeline: null, paramPresets: null }).success).toBe(true);
    });

    it("LaunchItem：非法 inputPipeline 形状被拒（不再 z.any() 放行）", () => {
        const r = LaunchItemSchema.safeParse({ ...base, inputPipeline: { steps: [{ id: 1 }] } });
        expect(r.success).toBe(false);
    });

    it("LaunchItem：paramPresets 元素缺 template 被拒", () => {
        const r = LaunchItemSchema.safeParse({ ...base, paramPresets: [{ id: "p", displayName: "d" }] });
        expect(r.success).toBe(false);
    });
});
