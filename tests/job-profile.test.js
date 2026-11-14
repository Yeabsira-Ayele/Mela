import assert from "node:assert/strict";
import { test } from "node:test";
import { firstUnansweredQuestion, isQuestionAnswered } from "../web/job-profile.js";
import { questions } from "../web/questions.js";

test("questions are ordered and their options use localized fixed-list IDs", () => {
  assert.deepEqual(questions.map(({ id }) => id), ["skills", "location", "education", "workHistory"]);
  assert.equal(questions[0].type, "checklist");
  assert.ok(questions[0].freeText);
  assert.equal(questions[1].type, "select");
  assert.equal(questions[2].fields[0].type, "select");
  assert.equal(questions[2].fields[1].type, "text");
  assert.equal(questions[3].skippable, true);
  assert.deepEqual(questions[0].options, [
    "customer-service", "communication", "phone-support", "typing", "data-entry",
    "computer-basics", "translation", "writing", "teaching", "administration",
    "bookkeeping", "sewing-crafts", "sales", "web-development", "graphic-design"
  ]);
});

test("resume starts at the first unanswered question and treats skipped history as complete", () => {
  const profile = {
    skills: ["typing"],
    location: "addis-ababa",
    education: { level: "secondary", field: "" },
    workHistory: { role: "", organization: "", years: "" },
    workHistorySkipped: true
  };

  assert.equal(firstUnansweredQuestion({}), 0);
  assert.equal(firstUnansweredQuestion(profile), questions.length);
  assert.equal(isQuestionAnswered(questions[0], { skills: [], otherSkill: "Gardening" }), true);
  assert.equal(isQuestionAnswered(questions[3], profile), true);
  assert.equal(firstUnansweredQuestion({ ...profile, education: { level: "", field: "" } }), 2);
});
