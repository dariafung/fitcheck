import { describe, expect, it } from "vitest";
import { isVoicePath, newVoicePath } from "./path";

const USER = "f97fc346-9acc-4404-bc52-9a6ba86a9bce";
const ITEM = "852c8e3d-abf7-4955-ab65-9d83194a02ae";
const OTHER = "c81b2b56-1f62-4284-83b6-7307a6355ac5";

describe("voice paths", () => {
  it("puts each new recording under the user and item", () => {
    const path = newVoicePath(USER, ITEM);
    expect(path).toMatch(new RegExp(`^${USER}/${ITEM}/[0-9a-f-]{36}\\.wav$`));
    expect(isVoicePath(path, USER, ITEM)).toBe(true);
    expect(newVoicePath(USER, ITEM)).not.toBe(path);
  });

  it("refuses another user's or item's path, traversal and other names", () => {
    const name = "3f1c7a52-6a7e-4c11-9a52-0d1e2f3a4b5c.wav";
    expect(isVoicePath(`${OTHER}/${ITEM}/${name}`, USER, ITEM)).toBe(false);
    expect(isVoicePath(`${USER}/${OTHER}/${name}`, USER, ITEM)).toBe(false);
    expect(isVoicePath(`${USER}/${ITEM}/../${OTHER}/${name}`, USER, ITEM)).toBe(false);
    expect(isVoicePath(`${USER}/${ITEM}/${name.replace(".wav", ".mp3")}`, USER, ITEM)).toBe(false);
    expect(isVoicePath(`${USER}/${ITEM}/sub/${name}`, USER, ITEM)).toBe(false);
    expect(isVoicePath(undefined, USER, ITEM)).toBe(false);
  });
});
