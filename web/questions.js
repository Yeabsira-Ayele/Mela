import en from "./i18n/en.json" with { type: "json" };

const questions = [
  {
    id: "skills",
    type: "checklist",
    titleKey: "questions.skills",
    helpKey: "hints.skills",
    optionsKey: "lists.skills",
    options: Object.keys(en.lists.skills),
    freeText: {
      name: "otherSkill",
      type: "text",
      labelKey: "fields.otherSkill",
      optional: true
    }
  },
  {
    id: "location",
    type: "select",
    titleKey: "questions.location",
    helpKey: "hints.location",
    optionsKey: "lists.locations",
    options: Object.keys(en.lists.locations),
    field: "location"
  },
  {
    id: "education",
    type: "education",
    titleKey: "questions.education",
    helpKey: "hints.education",
    fields: [
      {
        name: "level",
        type: "select",
        labelKey: "fields.educationLevel",
        optionsKey: "lists.educationLevels",
        options: Object.keys(en.lists.educationLevels),
        required: true
      },
      {
        name: "field",
        type: "text",
        labelKey: "fields.fieldOfStudy"
      }
    ]
  },
  {
    id: "workHistory",
    type: "work-history",
    titleKey: "questions.workHistory",
    helpKey: "hints.workHistory",
    skippable: true,
    fields: [
      { name: "role", type: "text", labelKey: "fields.role" },
      { name: "organization", type: "text", labelKey: "fields.organization" },
      { name: "years", type: "number", labelKey: "fields.years" }
    ]
  }
];

export { questions };
export default questions;
