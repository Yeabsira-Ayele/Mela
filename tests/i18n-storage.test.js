import assert from "node:assert/strict";
import { test } from "node:test";
import { getLanguage, setLanguage, t } from "../web/i18n.js";
import { clearAll, loadPrefs, loadProfile, savePrefs, saveProfile } from "../web/storage.js";

test("translations switch languages and interpolate parameters", () => {
  assert.equal(setLanguage("am"), true);
  assert.equal(t("progress", { n: 2, total: 4 }), "ጥያቄ 2 ከ 4");
  assert.equal(setLanguage("en"), true);
  assert.equal(t("progress", { n: 2, total: 4 }), "Question 2 of 4");
  assert.equal(t("missing.translation"), "missing.translation");
  assert.equal(getLanguage(), "en");
});

test("profile and preferences persist under separate storage keys", async () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  const values = new Map();
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    value: {
      getItem: (key) => values.has(key) ? values.get(key) : null,
      setItem: (key, value) => values.set(key, value),
      removeItem: (key) => values.delete(key)
    }
  });

  try {
    const profile = { skills: ["typing"] };
    const prefs = { language: "am" };
    assert.equal(saveProfile(profile), true);
    assert.equal(savePrefs(prefs), true);
    assert.equal(values.size, 2);

    const reloadedStorage = await import(`../web/storage.js?reload=${Date.now()}`);
    assert.deepEqual(reloadedStorage.loadProfile(), profile);
    assert.deepEqual(reloadedStorage.loadPrefs(), prefs);
    assert.equal(clearAll(), true);
    assert.equal(loadProfile(), null);
    assert.equal(loadPrefs(), null);
  } finally {
    if (previousStorage) {
      Object.defineProperty(globalThis, "localStorage", previousStorage);
    } else {
      delete globalThis.localStorage;
    }
  }
});

test("storage failures are reported without throwing", () => {
  const previousStorage = Object.getOwnPropertyDescriptor(globalThis, "localStorage");
  Object.defineProperty(globalThis, "localStorage", {
    configurable: true,
    get() {
      throw new Error("storage blocked");
    }
  });

  try {
    assert.equal(saveProfile({}), false);
    assert.equal(savePrefs({}), false);
    assert.equal(loadProfile(), null);
    assert.equal(loadPrefs(), null);
    assert.equal(clearAll(), false);
  } finally {
    if (previousStorage) {
      Object.defineProperty(globalThis, "localStorage", previousStorage);
    } else {
      delete globalThis.localStorage;
    }
  }
});
