import en from "./i18n/en.json" with { type: "json" };
import am from "./i18n/am.json" with { type: "json" };

const translations = { en, am };
let currentLanguage = "en";

function getValue(catalog, key) {
  return key.split(".").reduce((value, part) => {
    if (value && typeof value === "object" && Object.prototype.hasOwnProperty.call(value, part)) {
      return value[part];
    }
    return undefined;
  }, catalog);
}

function setLanguage(language) {
  if (Object.prototype.hasOwnProperty.call(translations, language)) {
    currentLanguage = language;
    return true;
  }
  return false;
}

function getLanguage() {
  return currentLanguage;
}

function t(key, params = {}) {
  const localized = getValue(translations[currentLanguage], key);
  const english = getValue(translations.en, key);
  const template = typeof localized === "string"
    ? localized
    : typeof english === "string" ? english : key;

  return template.replace(/\{([^{}]+)\}/g, (placeholder, name) => (
    params && Object.prototype.hasOwnProperty.call(params, name)
      ? String(params[name])
      : placeholder
  ));
}

export { getLanguage, setLanguage, t };
