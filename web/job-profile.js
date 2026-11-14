import { matchJobs } from "./matching.js";
import { getLanguage, t } from "./i18n.js";
import { questions } from "./questions.js";
import { loadPrefs, loadProfile, savePrefs, saveProfile } from "./storage.js";

let nextInstanceId = 0;

function text(value) {
  return typeof value === "string" ? value : "";
}

function createElement(document, tag, content, className) {
  const element = document.createElement(tag);
  if (content !== undefined) {
    element.textContent = content;
  }
  if (className) {
    element.className = className;
  }
  return element;
}

function normalizeProfile(value) {
  const saved = value && typeof value === "object" && !Array.isArray(value) ? value : {};
  const education = saved.education && typeof saved.education === "object" ? saved.education : {};
  const workHistory = saved.workHistory && typeof saved.workHistory === "object" ? saved.workHistory : {};
  return {
    ...saved,
    skills: Array.isArray(saved.skills) ? saved.skills.filter((skill) => typeof skill === "string") : [],
    otherSkill: text(saved.otherSkill),
    location: text(saved.location),
    education: {
      ...education,
      level: text(education.level),
      field: text(education.field)
    },
    workHistory: {
      ...workHistory,
      role: text(workHistory.role),
      organization: text(workHistory.organization),
      years: text(workHistory.years)
    }
  };
}

function isQuestionAnswered(question, profile) {
  if (question.id === "skills") {
    return profile.skills.length > 0 || Boolean(profile.otherSkill.trim());
  }
  if (question.id === "location") {
    return Boolean(profile.location);
  }
  if (question.id === "education") {
    return Boolean(profile.education.level);
  }
  if (question.id === "workHistory") {
    return profile.workHistorySkipped === true
      || Boolean(profile.workHistory.role || profile.workHistory.organization || profile.workHistory.years);
  }
  return false;
}

function firstUnansweredQuestion(profile) {
  const safeProfile = normalizeProfile(profile);
  const index = questions.findIndex((question) => !isQuestionAnswered(question, safeProfile));
  return index < 0 ? questions.length : index;
}

function optionLabel(key, id) {
  return t(`${key}.${id}`);
}

function translateReason(reason) {
  const params = { ...reason.params };
  if (Array.isArray(params.matched)) {
    const listKey = reason.code.startsWith("skills_") ? "lists.skills" : "lists.accommodations";
    params.matched = params.matched.map((id) => optionLabel(listKey, id)).join(", ");
  }
  if (typeof params.city === "string") {
    params.city = optionLabel("lists.locations", params.city);
  }
  return t(`matching.${reason.code}`, params);
}

async function loadJobs(root) {
  const override = root.getAttribute("jobs-url");
  const url = override
    ? new URL(override, root.ownerDocument.baseURI)
    : new URL("./data/jobs.json", import.meta.url);
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Jobs request failed with status ${response.status}`);
  }
  const jobs = await response.json();
  if (!Array.isArray(jobs)) {
    throw new TypeError("Jobs data must be an array");
  }
  return jobs;
}

function mountJobProfile(root) {
  if (!root || !root.ownerDocument) {
    throw new TypeError("A DOM element is required to mount the job profile form.");
  }

  const document = root.ownerDocument;
  const savedProfile = loadProfile();
  const profile = normalizeProfile(savedProfile);
  const loadedPrefs = loadPrefs();
  const savedPrefs = loadedPrefs && typeof loadedPrefs === "object" && !Array.isArray(loadedPrefs)
    ? loadedPrefs
    : {};
  const preferences = {
    ...savedPrefs,
    textSize: ["small", "medium", "large"].includes(savedPrefs.textSize) ? savedPrefs.textSize : "medium",
    highContrast: savedPrefs.highContrast === true
  };
  const instanceId = `job-profile-${++nextInstanceId}`;
  const screen = createElement(document, "div", undefined, "job-profile-screen");
  const statusRegion = createElement(document, "p", "", "job-profile-live job-profile-status");
  statusRegion.setAttribute("role", "status");
  statusRegion.setAttribute("aria-live", "polite");
  statusRegion.setAttribute("aria-atomic", "true");
  const errorRegion = createElement(document, "p", "", "job-profile-live job-profile-error");
  errorRegion.setAttribute("role", "alert");
  errorRegion.setAttribute("aria-live", "assertive");
  errorRegion.setAttribute("aria-atomic", "true");
  root.classList.add("job-profile");
  root.replaceChildren();
  root.append(statusRegion, errorRegion, screen, createPreferencesPanel());
  let questionIndex = firstUnansweredQuestion(profile);

  function setStatus(key, params) {
    statusRegion.textContent = key ? t(key, params) : "";
  }

  function setError(key) {
    errorRegion.textContent = key ? t(key) : "";
  }

  function applyPreferences() {
    root.dataset.textSize = preferences.textSize;
    root.dataset.highContrast = String(preferences.highContrast);
  }

  function persistPreferences() {
    applyPreferences();
    if (savePrefs(preferences)) {
      setError(null);
    } else {
      setError("errors.preferencesSave");
    }
  }

  function createPreferencesPanel() {
    const panel = createElement(document, "section", undefined, "job-profile-preferences");
    const heading = createElement(document, "h2", t("preferences.title"));
    panel.append(heading);

    const sizeGroup = document.createElement("fieldset");
    sizeGroup.append(createElement(document, "legend", t("preferences.textSize")));
    for (const size of ["small", "medium", "large"]) {
      const id = `${instanceId}-text-size-${size}`;
      const input = document.createElement("input");
      input.type = "radio";
      input.name = `${instanceId}-text-size`;
      input.id = id;
      input.value = size;
      input.checked = preferences.textSize === size;
      input.addEventListener("change", () => {
        preferences.textSize = size;
        persistPreferences();
      });
      const label = createElement(document, "label");
      label.htmlFor = id;
      label.append(input, document.createTextNode(t(`preferences.textSizeOptions.${size}`)));
      sizeGroup.append(label);
    }
    panel.append(sizeGroup);

    const contrastLabel = createElement(document, "label");
    const contrast = document.createElement("input");
    contrast.type = "checkbox";
    contrast.id = `${instanceId}-high-contrast`;
    contrast.checked = preferences.highContrast;
    contrast.addEventListener("change", () => {
      preferences.highContrast = contrast.checked;
      persistPreferences();
    });
    contrastLabel.htmlFor = contrast.id;
    contrastLabel.append(contrast, document.createTextNode(t("preferences.highContrast")));
    panel.append(contrastLabel);
    applyPreferences();
    return panel;
  }

  function renderField(question, field, parent) {
    const id = `${instanceId}-${question.id}-${field.name}`;
    const label = createElement(document, "label", t(field.labelKey));
    label.htmlFor = id;
    let control;
    if (field.type === "select") {
      control = document.createElement("select");
      control.id = id;
      control.name = `${question.id}.${field.name}`;
      control.required = field.required === true;
      control.setAttribute("aria-describedby", `${instanceId}-${question.id}-hint`);
      const emptyOption = document.createElement("option");
      emptyOption.value = "";
      emptyOption.textContent = t("fields.selectOption");
      control.append(emptyOption);
      for (const id of field.options) {
        const option = document.createElement("option");
        option.value = id;
        option.textContent = optionLabel(field.optionsKey, id);
        control.append(option);
      }
      control.value = question.id === "education"
        ? profile.education[field.name]
        : profile[field.name];
    } else {
      control = document.createElement("input");
      control.type = field.type;
      control.id = id;
      control.name = `${question.id}.${field.name}`;
      control.setAttribute("aria-describedby", `${instanceId}-${question.id}-hint`);
      control.value = question.id === "education"
        ? profile.education[field.name]
        : profile.workHistory[field.name];
      if (field.type === "number") {
        control.min = "0";
        control.step = "1";
      }
    }
    label.append(control);
    parent.append(label);
  }

  function renderQuestion({ errorKey = null, statusKey = null } = {}) {
    const question = questions[questionIndex];
    screen.replaceChildren();

    const progress = createElement(
      document,
      "p",
      t("progress", { n: questionIndex + 1, total: questions.length }),
      "job-profile-progress"
    );
    screen.append(progress);
    const heading = createElement(document, "h1", t(question.titleKey));
    heading.tabIndex = -1;
    screen.append(heading);
    const hint = createElement(document, "p", t(question.helpKey));
    hint.id = `${instanceId}-${question.id}-hint`;
    screen.append(hint);

    const form = document.createElement("form");
    form.noValidate = true;
    if (question.type === "checklist") {
      const fieldset = document.createElement("fieldset");
      fieldset.className = "job-profile-skills";
      fieldset.setAttribute("aria-describedby", hint.id);
      fieldset.append(createElement(document, "legend", t(question.titleKey)));
      for (const id of question.options) {
        const inputId = `${instanceId}-skill-${id}`;
        const label = createElement(document, "label");
        label.htmlFor = inputId;
        const input = document.createElement("input");
        input.type = "checkbox";
        input.id = inputId;
        input.name = "skill";
        input.value = id;
        input.checked = profile.skills.includes(id);
        input.setAttribute("aria-describedby", hint.id);
        label.append(input, document.createTextNode(optionLabel(question.optionsKey, id)));
        fieldset.append(label);
      }
      form.append(fieldset);
      const other = document.createElement("input");
      other.type = "text";
      other.id = `${instanceId}-${question.freeText.name}`;
      other.name = question.freeText.name;
      other.setAttribute("aria-describedby", hint.id);
      other.value = profile[question.freeText.name];
      const otherLabel = createElement(document, "label", t(question.freeText.labelKey));
      otherLabel.htmlFor = other.id;
      otherLabel.append(other);
      form.append(otherLabel);
    } else if (question.type === "select") {
      renderField(
        question,
        {
          name: question.field,
          type: "select",
          labelKey: question.titleKey,
          optionsKey: question.optionsKey,
          options: question.options,
          required: true
        },
        form
      );
    } else {
      for (const field of question.fields) {
        renderField(question, field, form);
      }
    }

    form.addEventListener("submit", (event) => {
      event.preventDefault();
      advance();
    });

    const back = document.createElement("button");
    back.type = "button";
    back.textContent = t("buttons.back");
    back.disabled = questionIndex === 0;
    back.addEventListener("click", () => {
      readQuestionInputs(question);
      questionIndex -= 1;
      renderQuestion();
    });

    const next = document.createElement("button");
    next.type = "submit";
    next.textContent = t("buttons.next");
    form.append(back, next);
    screen.append(form);
    setStatus(statusKey);
    setError(errorKey);
    heading.focus();
  }

  function readQuestionInputs(question) {
    if (question.id === "skills") {
      profile.skills = Array.from(screen.querySelectorAll('input[name="skill"]:checked'), (input) => input.value);
      profile.otherSkill = text(screen.querySelector('input[name="otherSkill"]').value).trim();
    } else if (question.id === "location") {
      profile.location = screen.querySelector('select[name="location.location"]').value;
    } else if (question.id === "education") {
      profile.education = {
        level: screen.querySelector('select[name="education.level"]').value,
        field: screen.querySelector('input[name="education.field"]').value.trim()
      };
    } else if (question.id === "workHistory") {
      profile.workHistory = {
        role: screen.querySelector('input[name="workHistory.role"]').value.trim(),
        organization: screen.querySelector('input[name="workHistory.organization"]').value.trim(),
        years: screen.querySelector('input[name="workHistory.years"]').value
      };
      profile.workHistorySkipped = !Object.values(profile.workHistory).some(Boolean);
    }
  }

  function dispatchProfileComplete() {
    const EventConstructor = document.defaultView && document.defaultView.CustomEvent;
    if (!EventConstructor) {
      throw new Error("CustomEvent is unavailable in this document.");
    }
    root.dispatchEvent(new EventConstructor("profile-complete", {
      detail: profile,
      bubbles: true
    }));
  }

  async function renderResults(saveFailed = false) {
    screen.replaceChildren();
    const heading = createElement(document, "h1", t("results.title"));
    heading.tabIndex = -1;
    screen.append(heading);
    setStatus("status.loadingJobs");
    setError(saveFailed ? "errors.save" : null);

    const back = document.createElement("button");
    back.type = "button";
    back.textContent = t("buttons.edit");
    back.addEventListener("click", () => {
      questionIndex = questions.length - 1;
      renderQuestion();
    });
    screen.append(back);
    heading.focus();

    try {
      const jobs = await loadJobs(root);
      const matches = matchJobs(profile, jobs);
      setStatus("status.jobsFound", { total: matches.length });
      if (matches.length === 0) {
        screen.append(createElement(document, "p", t("results.empty")));
        return;
      }

      const list = document.createElement("ol");
      for (const match of matches) {
        const item = document.createElement("li");
        const title = match.title[getLanguage()] || match.title.en || match.jobId;
        item.append(createElement(document, "h2", title));
        item.append(createElement(document, "p", t("results.score", { score: match.score })));
        const reasons = document.createElement("ul");
        for (const reason of match.reasons) {
          reasons.append(createElement(document, "li", translateReason(reason)));
        }
        item.append(reasons);
        list.append(item);
      }
      screen.append(list);
    } catch (error) {
      console.error("Unable to load or display matching jobs.", error);
      setStatus(null);
      setError("errors.jobs");
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = t("buttons.retry");
      retry.addEventListener("click", () => renderResults());
      screen.append(retry);
    }
  }

  function advance() {
    const question = questions[questionIndex];
    readQuestionInputs(question);
    if (!question.skippable && !isQuestionAnswered(question, profile)) {
      const errorKey = {
        skills: "errors.skillsRequired",
        location: "errors.locationRequired",
        education: "errors.educationRequired"
      }[question.id] || "errors.required";
      renderQuestion({ errorKey });
      return;
    }

    const saved = saveProfile(profile);
    questionIndex += 1;
    if (questionIndex < questions.length) {
      renderQuestion({
        statusKey: saved ? "status.saved" : null,
        errorKey: saved ? null : "errors.save"
      });
      return;
    }

    dispatchProfileComplete();
    void renderResults(!saved);
  }

  if (questionIndex === questions.length) {
    dispatchProfileComplete();
    void renderResults();
  } else {
    renderQuestion();
  }

  return {
    getProfile() {
      return normalizeProfile(profile);
    }
  };
}

export { firstUnansweredQuestion, isQuestionAnswered, mountJobProfile };
