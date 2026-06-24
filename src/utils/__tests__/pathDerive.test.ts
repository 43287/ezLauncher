import { describe, it, expect } from "vitest";
import { deriveParentDir } from "../pathDerive";

describe("deriveParentDir（FR-023）", () => {
    it("常规 Windows 路径取父目录", () => {
        expect(deriveParentDir("C:\\a\\b\\x.txt")).toBe("C:\\a\\b");
    });

    it("尾随分隔符不影响结果", () => {
        expect(deriveParentDir("C:\\a\\b\\")).toBe("C:\\a");
        expect(deriveParentDir("C:/a/b/")).toBe("C:/a");
    });

    it("剥去首尾引号", () => {
        expect(deriveParentDir('"C:\\a\\b\\x.txt"')).toBe("C:\\a\\b");
    });

    it("混合分隔符", () => {
        expect(deriveParentDir("C:\\a/b\\x.txt")).toBe("C:\\a/b");
    });

    it("正斜杠路径", () => {
        expect(deriveParentDir("C:/a/b/x.txt")).toBe("C:/a/b");
    });

    it("盘符根回补反斜杠，不返回裸盘符", () => {
        expect(deriveParentDir("C:\\x.txt")).toBe("C:\\");
        expect(deriveParentDir("C:/x.txt")).toBe("C:\\");
    });

    it("无父目录返回空串", () => {
        expect(deriveParentDir("x.txt")).toBe("");
        expect(deriveParentDir("")).toBe("");
    });
});
