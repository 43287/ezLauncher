import { describe, it, expect } from "vitest";
import { containsChinese, getTruncatedTabName } from "../tabDisplay";

describe("containsChinese", () => {
    it("纯中文返回 true", () => {
        expect(containsChinese("工作")).toBe(true);
    });

    it("中英混合返回 true", () => {
        expect(containsChinese("Work工作")).toBe(true);
    });

    it("纯英文返回 false", () => {
        expect(containsChinese("Workspace")).toBe(false);
    });

    it("数字与符号返回 false", () => {
        expect(containsChinese("123-ABC")).toBe(false);
    });

    it("空字符串返回 false", () => {
        expect(containsChinese("")).toBe(false);
    });
});

describe("getTruncatedTabName", () => {
    it("中文截断为 2 个字符", () => {
        expect(getTruncatedTabName("工作空间")).toBe("工作");
    });

    it("英文截断为 4 个字符", () => {
        expect(getTruncatedTabName("Workspace")).toBe("Work");
    });

    it("短于上限的中文不截断", () => {
        expect(getTruncatedTabName("工")).toBe("工");
    });

    it("短于上限的英文不截断", () => {
        expect(getTruncatedTabName("AB")).toBe("AB");
    });

    it("中英混合按中文规则截断为 2 个字符", () => {
        expect(getTruncatedTabName("Work工作ABC")).toBe("Wo");
    });
});
