import { describe, it, expect, beforeEach } from "vitest";
import { useHistoryStore, upsertEntry, getEntries, type HistoryMap } from "../useHistoryStore";

describe("useHistoryStore LRU 纯逻辑", () => {
  it("插入新值置顶", () => {
    const r = upsertEntry([], "a", undefined, 100, 10);
    expect(r).toHaveLength(1);
    expect(r[0].value).toBe("a");
  });

  it("复用同值去重并置顶（更新时间戳）", () => {
    let list = upsertEntry([], "a", undefined, 100, 10);
    list = upsertEntry(list, "b", undefined, 200, 10);
    list = upsertEntry(list, "a", undefined, 300, 10); // 复用 a
    expect(list).toHaveLength(2);
    expect(list[0].value).toBe("a"); // 置顶
    expect(list[0].lastUsedAt).toBe(300);
    expect(list[1].value).toBe("b");
  });

  it("超上限淘汰最旧", () => {
    let list: ReturnType<typeof upsertEntry> = [];
    for (let i = 0; i < 5; i++) {
      list = upsertEntry(list, `v${i}`, undefined, 100 + i, 3);
    }
    expect(list).toHaveLength(3);
    expect(list.map((e) => e.value)).toEqual(["v4", "v3", "v2"]); // 最近 3 条
  });

  it("最近优先排序", () => {
    let list = upsertEntry([], "old", undefined, 1, 10);
    list = upsertEntry(list, "new", undefined, 999, 10);
    expect(list[0].value).toBe("new");
  });

  it("getEntries 作用域为 item+collectorType", () => {
    const map: HistoryMap = {
      item1: { file: [{ value: "f", lastUsedAt: 1 }], process: [{ value: "p", lastUsedAt: 1 }] },
      item2: { file: [{ value: "g", lastUsedAt: 1 }] },
    };
    expect(getEntries(map, "item1", "file")[0].value).toBe("f");
    expect(getEntries(map, "item1", "process")[0].value).toBe("p");
    expect(getEntries(map, "item2", "file")[0].value).toBe("g");
    expect(getEntries(map, "item1", "text")).toEqual([]);
    expect(getEntries(map, "missing", "file")).toEqual([]);
  });
});

describe("useHistoryStore store 行为", () => {
  beforeEach(() => {
    useHistoryStore.setState({ history: {}, limit: 10, isLoaded: false });
  });

  it("add/get 按 item+采集器类型隔离", () => {
    const s = useHistoryStore.getState();
    s.add("itemA", "file", "/a", undefined, 1);
    s.add("itemB", "file", "/b", undefined, 2);
    expect(useHistoryStore.getState().get("itemA", "file").map((e) => e.value)).toEqual(["/a"]);
    expect(useHistoryStore.getState().get("itemB", "file").map((e) => e.value)).toEqual(["/b"]);
  });

  it("上限按 store.limit 生效", () => {
    useHistoryStore.setState({ limit: 2 });
    const s = useHistoryStore.getState();
    s.add("i", "file", "1", undefined, 1);
    s.add("i", "file", "2", undefined, 2);
    s.add("i", "file", "3", undefined, 3);
    expect(useHistoryStore.getState().get("i", "file").map((e) => e.value)).toEqual(["3", "2"]);
  });

  it("clear 清空全部", () => {
    const s = useHistoryStore.getState();
    s.add("i", "file", "1", undefined, 1);
    s.clear();
    expect(useHistoryStore.getState().history).toEqual({});
  });

  it("clearFor 清单一 item / 单一类型", () => {
    const s = useHistoryStore.getState();
    s.add("i", "file", "1", undefined, 1);
    s.add("i", "process", "p", undefined, 2);
    s.clearFor("i", "file");
    expect(useHistoryStore.getState().get("i", "file")).toEqual([]);
    expect(useHistoryStore.getState().get("i", "process").map((e) => e.value)).toEqual(["p"]);
  });

  it("空值不写入", () => {
    const s = useHistoryStore.getState();
    s.add("i", "file", "", undefined, 1);
    expect(useHistoryStore.getState().get("i", "file")).toEqual([]);
  });
});
