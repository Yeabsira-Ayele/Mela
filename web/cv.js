import { getLanguage, t } from "./i18n.js";

const CV_STYLES = `
  :root { color-scheme: light; }
  * { box-sizing: border-box; }
  html, body { margin: 0; color: #111; background: #fff; }
  body {
    font-family: "Noto Sans Ethiopic", "Abyssinica SIL", "Nyala", "Noto Sans", Arial, sans-serif;
    font-size: 12pt;
    line-height: 1.5;
  }
  .cv-page { max-width: 54rem; margin: 2rem auto; padding: 2rem; background: #fff; }
  h1, h2, h3 { line-height: 1.25; break-after: avoid-page; page-break-after: avoid; }
  h1 { margin-top: 0; font-size: 2rem; }
  h2 { margin-top: 1.5rem; border-bottom: 1px solid #555; padding-bottom: .25rem; }
  h3 { margin-bottom: .25rem; font-size: 1.1rem; }
  ul { padding-inline-start: 1.5rem; }
  li { margin-block: .25rem; }
  .cv-entry, .cv-section, .cv-list-item { break-inside: avoid-page; page-break-inside: avoid; }
  .cv-print-actions { max-width: 54rem; margin: 0 auto 2rem; padding: 0 2rem; }
  .cv-print-actions button {
    min-width: 44px;
    min-height: 44px;
    padding: .6rem 1rem;
    border: 2px solid #111;
    border-radius: .25rem;
    color: #fff;
    background: #111;
    font: inherit;
    cursor: pointer;
  }
  .cv-print-actions button:focus {
    outline: 3px solid #005fcc;
    outline-offset: 3px;
  }
  @media (max-width: 36rem) {
    .cv-page { margin: 0; padding: 1rem; }
    .cv-print-actions { margin: 0; padding: 1rem; }
  }
  @media print {
    @page { margin: 1.5cm; }
    html, body, .cv-page { color: #000 !important; background: #fff !important; }
    body { font-size: 11pt; }
    .cv-page { max-width: none; margin: 0; padding: 0; }
    .cv-print-actions { display: none !important; }
    h1, h2, h3 { break-after: avoid-page; page-break-after: avoid; }
    section, li, .cv-entry, .cv-list-item { break-inside: avoid-page; page-break-inside: avoid; }
    a { color: #000; text-decoration: none; }
  }
`;

let nextControlId = 0;

function safeText(value) {
  if (typeof value === "string") {
    return value.trim();
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return "";
}

function escapeHTML(value) {
  return String(value).replace(/[&<>"']/g, (character) => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "\"": "&quot;",
    "'": "&#39;"
  })[character]);
}

function translatedListValue(listName, value) {
  const key = `lists.${listName}.${value}`;
  const translation = t(key);
  return translation === key ? value : translation;
}

function listMarkup(items, emptyMessage) {
  const values = items.length ? items : [emptyMessage];
  return `<ul>${values.map((item) => `<li class="cv-list-item">${escapeHTML(item)}</li>`).join("")}</ul>`;
}

function generateCV(profile, options = {}) {
  const safeProfile = profile && typeof profile === "object" && !Array.isArray(profile) ? profile : {};
  const includeAccess = options && options.includeAccess === true;
  const language = getLanguage();
  const education = safeProfile.education && typeof safeProfile.education === "object"
    ? safeProfile.education
    : {};
  const workHistory = safeProfile.workHistory && typeof safeProfile.workHistory === "object"
    ? safeProfile.workHistory
    : {};
  const skills = Array.isArray(safeProfile.skills)
    ? safeProfile.skills.filter((skill) => typeof skill === "string").map((skill) => translatedListValue("skills", skill))
    : [];
  const otherSkill = safeText(safeProfile.otherSkill);
  if (otherSkill) {
    skills.push(otherSkill);
  }

  const educationItems = [];
  const educationLevel = safeText(education.level);
  const fieldOfStudy = safeText(education.field);
  if (educationLevel) {
    educationItems.push(`${t("cv.educationLevel")}: ${translatedListValue("educationLevels", educationLevel)}`);
  }
  if (fieldOfStudy) {
    educationItems.push(`${t("cv.fieldOfStudy")}: ${fieldOfStudy}`);
  }

  const role = safeText(workHistory.role);
  const organization = safeText(workHistory.organization);
  const years = safeText(workHistory.years);
  const hasWorkHistory = Boolean(role || organization || years);
  const workMarkup = hasWorkHistory
    ? `<ul><li class="cv-entry"><h3>${escapeHTML(role || t("cv.workEntry"))}</h3>${organization
      ? `<p><strong>${escapeHTML(t("cv.organization"))}:</strong> ${escapeHTML(organization)}</p>`
      : ""}${years
      ? `<p>${escapeHTML(t("cv.years", { years }))}</p>`
      : ""}</li></ul>`
    : listMarkup([], t("cv.notProvided"));

  const accessNeeds = includeAccess && Array.isArray(safeProfile.accessNeeds)
    ? safeProfile.accessNeeds.filter((need) => typeof need === "string")
    : [];
  const accessMarkup = includeAccess
    ? `<section class="cv-section"><h2>${escapeHTML(t("cv.accessNeeds"))}</h2>${listMarkup(
      accessNeeds.map((need) => translatedListValue("accommodations", need)),
      t("cv.noAccessNeeds")
    )}</section>`
    : "";
  const title = t("cv.documentTitle");
  const name = safeText(safeProfile.name) || t("cv.untitled");
  const location = safeText(safeProfile.location);

  return `<!doctype html>
<html lang="${escapeHTML(language)}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>${escapeHTML(title)}</title>
  <style>${CV_STYLES}</style>
</head>
<body>
  <main class="cv-page">
    <header><h1>${escapeHTML(name)}</h1></header>
    <section class="cv-section">
      <h2>${escapeHTML(t("cv.location"))}</h2>
      <p>${escapeHTML(location ? translatedListValue("locations", location) : t("cv.notProvided"))}</p>
    </section>
    <section class="cv-section">
      <h2>${escapeHTML(t("cv.skills"))}</h2>
      ${listMarkup(skills, t("cv.noSkills"))}
    </section>
    <section class="cv-section">
      <h2>${escapeHTML(t("cv.education"))}</h2>
      ${listMarkup(educationItems, t("cv.notProvided"))}
    </section>
    <section class="cv-section">
      <h2>${escapeHTML(t("cv.workExperience"))}</h2>
      ${workMarkup}
    </section>
    ${accessMarkup}
  </main>
  <div class="cv-print-actions">
    <button id="cv-print-button" type="button">${escapeHTML(t("cv.print"))}</button>
  </div>
  <script>
    document.getElementById("cv-print-button").addEventListener("click", function () {
      window.print();
    });
  </script>
</body>
</html>`;
}

function downloadHTML(document, html) {
  const view = document.defaultView;
  if (!view || !view.URL || typeof view.URL.createObjectURL !== "function" || typeof view.Blob !== "function") {
    throw new Error("HTML downloads are unavailable in this browser.");
  }
  const blob = new view.Blob([html], { type: "text/html;charset=utf-8" });
  const url = view.URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = "cv.html";
  link.style.position = "fixed";
  link.style.left = "-10000px";
  document.body.append(link);
  link.click();
  link.remove();
  view.setTimeout(() => view.URL.revokeObjectURL(url), 1000);
}

function dispatchCVReady(target, includeAccess, delivery) {
  const document = target.ownerDocument || target;
  const EventConstructor = document.defaultView && document.defaultView.CustomEvent;
  if (!EventConstructor || typeof target.dispatchEvent !== "function") {
    throw new Error("Custom events are unavailable in this document.");
  }
  target.dispatchEvent(new EventConstructor("cv-ready", {
    bubbles: true,
    detail: { includeAccess, delivery }
  }));
}

function openCV(profile, { includeAccess = false, eventTarget = globalThis.document } = {}) {
  if (!eventTarget) {
    throw new TypeError("A document or event target is required to open a CV.");
  }
  const document = eventTarget.ownerDocument || eventTarget;
  const view = document.defaultView;
  if (!view) {
    throw new Error("A browser window is required to open a CV.");
  }

  const html = generateCV(profile, { includeAccess });
  let popup = null;
  if (typeof view.open === "function") {
    try {
      popup = view.open("", "_blank");
    } catch (error) {
      console.error("Unable to open the CV window; downloading instead.", error);
    }
  }

  let delivery = "download";
  if (popup) {
    try {
      popup.opener = null;
      popup.document.open();
      popup.document.write(html);
      popup.document.close();
      delivery = "window";
    } catch (error) {
      console.error("Unable to write the CV window; downloading instead.", error);
    }
  }

  if (delivery === "download") {
    downloadHTML(document, html);
  }
  dispatchCVReady(eventTarget, includeAccess === true, delivery);
  return { delivery };
}

function mountCVExport(container, profile, options = {}) {
  if (!container || !container.ownerDocument) {
    throw new TypeError("A DOM element is required to mount CV export controls.");
  }

  const document = container.ownerDocument;
  const controlId = `cv-include-access-${++nextControlId}`;
  const panel = document.createElement("section");
  panel.className = "cv-export-controls";

  const label = document.createElement("label");
  label.htmlFor = controlId;
  const checkbox = document.createElement("input");
  checkbox.type = "checkbox";
  checkbox.id = controlId;
  label.append(checkbox, document.createTextNode(t("cv.includeAccess")));
  panel.append(label);

  const button = document.createElement("button");
  button.type = "button";
  button.textContent = t("cv.create");
  panel.append(button);

  const statusRegion = options.statusRegion || null;
  const errorRegion = options.errorRegion || null;
  const message = statusRegion || errorRegion ? null : document.createElement("p");
  if (message) {
    message.className = "cv-export-message";
    panel.append(message);
  }

  button.addEventListener("click", () => {
    try {
      const { delivery } = openCV(profile, {
        includeAccess: checkbox.checked,
        eventTarget: container
      });
      const status = t(delivery === "window" ? "cv.opened" : "cv.downloaded");
      if (statusRegion) {
        statusRegion.textContent = status;
      }
      if (errorRegion) {
        errorRegion.textContent = "";
      }
      if (message) {
        message.textContent = status;
      }
    } catch (error) {
      console.error("Unable to create or download CV.", error);
      if (statusRegion) {
        statusRegion.textContent = "";
      }
      if (errorRegion) {
        errorRegion.textContent = t("cv.error");
      }
      if (message) {
        message.textContent = t("cv.error");
      }
    }
  });

  container.append(panel);
  return panel;
}

export { generateCV, mountCVExport, openCV };
