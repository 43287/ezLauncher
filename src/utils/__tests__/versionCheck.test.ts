import { describe, it, expect } from "vitest";
import { isNewerVersion } from "../versionCheck";

describe("isNewerVersion", () => {
    it("高主版本号判定为新", () => {
        expect(isNewerVersion("v1.0.0", "0.9.9")).toBe(true);
    });

    it("高次版本号判定为新", () => {
        expect(isNewerVersion("0.2.0", "0.1.9")).toBe(true);
    });

    it("高修订号判定为新", () => {
        expect(isNewerVersion("0.1.10", "0.1.9")).toBe(true);
    });

    it("相等版本判定为非新", () => {
        expect(isNewerVersion("0.1.9", "0.1.9")).toBe(false);
    });

    it("更低版本判定为非新", () => {
        expect(isNewerVersion("0.1.8", "0.1.9")).toBe(false);
    });

    it("带 v 前缀与预发布后缀正确比对", () => {
        expect(isNewerVersion("v0.2.0-beta", "0.1.0")).toBe(true);
    });

    it("两侧均带 v 前缀正确比对", () => {
        expect(isNewerVersion("v0.1.9", "v0.1.9")).toBe(false);
    });

    it("缺省字段按 0 处理", () => {
        expect(isNewerVersion("1", "0.9.9")).toBe(true);
        expect(isNewerVersion("1.2", "1.1.0")).toBe(true);
    });
});
