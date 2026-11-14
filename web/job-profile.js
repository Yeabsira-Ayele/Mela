import { matchJobs } from "./matching.js";
import { getLanguage, t } from "./i18n.js";
import { questions } from "./questions.js";
import { loadProfile, saveProfile } from "./storage.js";

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
  let questionIndex = firstUnansweredQuestion(profile);

  function renderField(question, field, parent) {
    const label = createElement(document, "label", t(field.labelKey));
    let control;
    if (field.type === "select") {
      control = document.createElement("select");
      control.name = `${question.id}.${field.name}`;
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
      control.name = `${question.id}.${field.name}`;
      control.value = profile.workHistory[field.name];
      if (field.type === "number") {
        control.min = "0";
        control.step = "1";
      }
    }
    label.append(control);
    parent.append(label);
  }

  function renderQuestion(messageKey) {
    const question = questions[questionIndex];
    root.replaceChildren();

    const progress = createElement(
      document,
      "p",
      t("progress", { n: questionIndex + 1, total: questions.length }),
      "job-profile-progress"
    );
    root.append(progress);
    root.append(createElement(document, "h1", t(question.titleKey)));
    root.append(createElement(document, "p", t(question.helpKey)));

    const form = document.createElement("form");
    form.noValidate = true;
    if (question.type === "checklist") {
      const fieldset = document.createElement("fieldset");
      fieldset.append(createElement(document, "legend", t(question.titleKey)));
      for (const id of question.options) {
        const label = createElement(document, "label");
        const input = document.createElement("input");
        input.type = "checkbox";
        input.name = "skill";
        input.value = id;
        input.checked = profile.skills.includes(id);
        label.append(input, document.createTextNode(optionLabel(question.optionsKey, id)));
        fieldset.append(label);
      }
      form.append(fieldset);
      const other = document.createElement("input");
      other.type = "text";
      other.name = question.freeText.name;
      other.value = profile[question.freeText.name];
      const otherLabel = createElement(document, "label", t(question.freeText.labelKey));
      otherLabel.append(other);
      form.append(otherLabel);
    } else if (question.type === "select") {
      renderField(
        question,
        { name: question.field, type: "select", labelKey: question.titleKey, optionsKey: question.optionsKey, options: question.options },
        form
      );
    } else {
      for (const field of question.fields) {
        renderField(question, field, form);
      }
    }

    const message = createElement(document, "p", messageKey ? t(messageKey) : "", "job-profile-message");
    message.setAttribute("role", messageKey === "errors.required" ? "alert" : "status");
    form.append(message);
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
    root.append(form);
  }

  function readQuestionInputs(question) {
    if (question.id === "skills") {
      profile.skills = Array.from(root.querySelectorAll('input[name="skill"]:checked'), (input) => input.value);
      profile.otherSkill = text(root.querySelector('input[name="otherSkill"]').value).trim();
    } else if (question.id === "location") {
      profile.location = root.querySelector('select[name="location.location"]').value;
    } else if (question.id === "education") {
      profile.education = {
        level: root.querySelector('select[name="education.level"]').value,
        field: root.querySelector('input[name="education.field"]').value.trim()
      };
    } else if (question.id === "workHistory") {
      profile.workHistory = {
        role: root.querySelector('input[name="workHistory.role"]').value.trim(),
        organization: root.querySelector('input[name="workHistory.organization"]').value.trim(),
        years: root.querySelector('input[name="workHistory.years"]').value
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
    root.replaceChildren();
    root.append(createElement(document, "h1", t("results.title")));
    if (saveFailed) {
      const saveMessage = createElement(document, "p", t("errors.save"), "job-profile-message");
      saveMessage.setAttribute("role", "alert");
      root.append(saveMessage);
    }
    const message = createElement(document, "p", t("status.loading"), "job-profile-message");
    message.setAttribute("role", "status");
    root.append(message);

    const back = document.createElement("button");
    back.type = "button";
    back.textContent = t("buttons.edit");
    back.addEventListener("click", () => {
      questionIndex = questions.length - 1;
      renderQuestion();
    });
    root.append(back);

    try {
      const jobs = await loadJobs(root);
      const matches = matchJobs(profile, jobs);
      message.remove();
      if (matches.length === 0) {
        root.append(createElement(document, "p", t("results.empty")));
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
      root.append(list);
    } catch (error) {
      console.error("Unable to load or display matching jobs.", error);
      message.textContent = t("errors.jobs");
      const retry = document.createElement("button");
      retry.type = "button";
      retry.textContent = t("buttons.retry");
      retry.addEventListener("click", () => renderResults());
      root.append(retry);
    }
  }

  function advance() {
    const question = questions[questionIndex];
    readQuestionInputs(question);
    if (!question.skippable && !isQuestionAnswered(question, profile)) {
      renderQuestion("errors.required");
      return;
    }

    const saved = saveProfile(profile);
    questionIndex += 1;
    if (questionIndex < questions.length) {
      renderQuestion(saved ? undefined : "errors.save");
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
