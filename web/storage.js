const PROFILE_KEY = "mela.profile.v1";
const PREFS_KEY = "mela.preferences.v1";

function saveValue(key, value) {
  try {
    globalThis.localStorage.setItem(key, JSON.stringify(value));
    return true;
  } catch {
    return false;
  }
}

function loadValue(key) {
  try {
    const value = globalThis.localStorage.getItem(key);
    return value === null ? null : JSON.parse(value);
  } catch {
    return null;
  }
}

function saveProfile(profile) {
  return saveValue(PROFILE_KEY, profile);
}

function loadProfile() {
  return loadValue(PROFILE_KEY);
}

function savePrefs(prefs) {
  return saveValue(PREFS_KEY, prefs);
}

function loadPrefs() {
  return loadValue(PREFS_KEY);
}

function clearAll() {
  let cleared = true;
  for (const key of [PROFILE_KEY, PREFS_KEY]) {
    try {
      globalThis.localStorage.removeItem(key);
    } catch {
      cleared = false;
    }
  }
  return cleared;
}

export { clearAll, loadPrefs, loadProfile, savePrefs, saveProfile };
