import { describe, it, expect } from "vitest";
import { render, validate, scanPlaceholders } from "../PlaceholderEngine";

describe("PlaceholderEngine", () => {
  describe("既有占位符替换回归基线", () => {
    it("替换 {target_file}", () => {
      expect(render("upx {target_file}", { target_file: '"C:\\a.exe"' })).toBe('upx "C:\\a.exe"');
    });

    it("替换 {target_path}", () => {
      expect(render("cd {target_path}", { target_path: '"C:\\dir"' })).toBe('cd "C:\\dir"');
    });

    it("历史别名 {{drop_file}} 等价 target_file", () => {
      expect(render("open {{drop_file}}", { target_file: '"C:\\x.txt"' })).toBe('open "C:\\x.txt"');
    });
  });

  describe("多占位符不串位", () => {
    it("不同占位符各自映射", () => {
      const out = render("--pid {target_process} --dll {target_file}", {
        target_process: "1234",
        target_file: '"C:\\h.dll"',
      });
      expect(out).toBe('--pid 1234 --dll "C:\\h.dll"');
    });

    it("text 与 selected_path 不互相污染", () => {
      const out = render("{text} @ {selected_path}", {
        text: "hello",
        selected_path: '"C:\\proj"',
      });
      expect(out).toBe('hello @ "C:\\proj"');
    });
  });

  describe("转义为字面量", () => {
    it("{{target_file}} 渲染为字面 {target_file}", () => {
      // 目标工具自身需要字面字符串，不参与采集替换
      expect(render("tool {{target_file}}", { target_file: "SHOULD_NOT_APPEAR" })).toBe("tool {target_file}");
    });

    it("不误伤 {{drop_file}} 历史别名（仍替换）", () => {
      expect(render("{{drop_file}}", { target_file: "X" })).toBe("X");
    });
  });

  describe("缺值校验", () => {
    it("缺失占位符返回 missing 列表", () => {
      const r = validate("--pid {target_process} --dll {target_file}", { target_file: "x" });
      expect(r.ok).toBe(false);
      expect(r.missing).toContain("target_process");
      expect(r.missing).not.toContain("target_file");
    });

    it("全部满足时 ok=true", () => {
      const r = validate("{text}", { text: "hi" });
      expect(r.ok).toBe(true);
      expect(r.missing).toEqual([]);
    });

    it("转义占位符不计入缺值", () => {
      const r = validate("tool {{target_file}}", {});
      expect(r.ok).toBe(true);
    });

    it("drop_file 别名以 target_file 满足", () => {
      expect(validate("{{drop_file}}", { target_file: "x" }).ok).toBe(true);
      expect(validate("{{drop_file}}", {}).ok).toBe(false);
    });
  });

  describe("含空格路径引号处理", () => {
    it("引号由采集值携带，引擎原样注入", () => {
      const out = render("run {selected_path}", { selected_path: '"C:\\Program Files\\a.exe"' });
      expect(out).toBe('run "C:\\Program Files\\a.exe"');
    });
  });

  describe("scanPlaceholders", () => {
    it("识别已知占位符，忽略转义", () => {
      const used = scanPlaceholders("{target_file} {{text}} {target_process}");
      expect(used).toContain("target_file");
      expect(used).toContain("target_process");
      expect(used).not.toContain("text");
    });
  });
});
