import { moveItem } from "../moveItem";

describe("moveItem", () => {
  it("moves an item down the list", () => {
    expect(moveItem(["a", "b", "c"], 0, 2)).toEqual(["b", "c", "a"]);
  });

  it("moves an item up the list", () => {
    expect(moveItem(["a", "b", "c"], 2, 0)).toEqual(["c", "a", "b"]);
  });

  it("leaves the original list untouched", () => {
    const items = ["a", "b", "c"];
    moveItem(items, 0, 1);
    expect(items).toEqual(["a", "b", "c"]);
  });
});
