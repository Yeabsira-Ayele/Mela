import AxeBuilder from "@axe-core/playwright";
import { expect, test } from "@playwright/test";
import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const profileKey = "mela.profile.v1";
const auditResults = [];
const WCAG_CRITERIA = [
  ["1.1.1", "Non-text Content", "A"],
  ["1.2.1", "Audio-only and Video-only (Prerecorded)", "A"],
  ["1.2.2", "Captions (Prerecorded)", "A"],
  ["1.2.3", "Audio Description or Media Alternative (Prerecorded)", "A"],
  ["1.2.4", "Captions (Live)", "AA"],
  ["1.2.5", "Audio Description (Prerecorded)", "AA"],
  ["1.3.1", "Info and Relationships", "A"],
  ["1.3.2", "Meaningful Sequence", "A"],
  ["1.3.3", "Sensory Characteristics", "A"],
  ["1.3.4", "Orientation", "AA"],
  ["1.3.5", "Identify Input Purpose", "AA"],
  ["1.4.1", "Use of Color", "A"],
  ["1.4.2", "Audio Control", "A"],
  ["1.4.3", "Contrast (Minimum)", "AA"],
  ["1.4.4", "Resize Text", "AA"],
  ["1.4.5", "Images of Text", "AA"],
  ["1.4.10", "Reflow", "AA"],
  ["1.4.11", "Non-text Contrast", "AA"],
  ["1.4.12", "Text Spacing", "AA"],
  ["1.4.13", "Content on Hover or Focus", "AA"],
  ["2.1.1", "Keyboard", "A"],
  ["2.1.2", "No Keyboard Trap", "A"],
  ["2.1.4", "Character Key Shortcuts", "A"],
  ["2.2.1", "Timing Adjustable", "A"],
  ["2.2.2", "Pause, Stop, Hide", "A"],
  ["2.3.1", "Three Flashes or Below Threshold", "A"],
  ["2.4.1", "Bypass Blocks", "A"],
  ["2.4.2", "Page Titled", "A"],
  ["2.4.3", "Focus Order", "A"],
  ["2.4.4", "Link Purpose (In Context)", "A"],
  ["2.4.5", "Multiple Ways", "AA"],
  ["2.4.6", "Headings and Labels", "AA"],
  ["2.4.7", "Focus Visible", "AA"],
  ["2.4.11", "Focus Not Obscured (Minimum)", "AA"],
  ["2.5.1", "Pointer Gestures", "A"],
  ["2.5.2", "Pointer Cancellation", "A"],
  ["2.5.3", "Label in Name", "A"],
  ["2.5.4", "Motion Actuation", "A"],
  ["2.5.7", "Dragging Movements", "AA"],
  ["2.5.8", "Target Size (Minimum)", "AA"],
  ["3.1.1", "Language of Page", "A"],
  ["3.1.2", "Language of Parts", "AA"],
  ["3.2.1", "On Focus", "A"],
  ["3.2.2", "On Input", "A"],
  ["3.2.3", "Consistent Navigation", "AA"],
  ["3.2.4", "Consistent Identification", "AA"],
  ["3.2.6", "Consistent Help", "A"],
  ["3.3.1", "Error Identification", "A"],
  ["3.3.2", "Labels or Instructions", "A"],
  ["3.3.3", "Error Suggestion", "AA"],
  ["3.3.4", "Error Prevention (Legal, Financial, Data)", "AA"],
  ["3.3.7", "Redundant Entry", "A"],
  ["3.3.8", "Accessible Authentication (Minimum)", "AA"],
  ["4.1.2", "Name, Role, Value", "A"],
  ["4.1.3", "Status Messages", "AA"]
];

function completeProfile(overrides = {}) {
  return {
    skills: ["typing", "communication"],
    otherSkill: "",
    location: "addis-ababa",
    education: { level: "secondary", field: "General studies" },
    workHistory: { role: "", organization: "", years: "" },
    workHistorySkipped: true,
    ...overrides
  };
}

async function loadProfileAtFirstUnanswered(page, profile) {
  await page.goto("/");
  await page.evaluate(({ key, value }) => {
    localStorage.setItem(key, JSON.stringify(value));
  }, { key: profileKey, value: profile });
  await page.reload();
}

function printFinding(surface, type, finding) {
  const heading = `[axe ${type}] ${surface}: ${finding.id} (${finding.impact || "impact unknown"})`;
  console.error(`${heading}\n  ${finding.help}\n  ${finding.helpUrl}`);
  for (const node of finding.nodes || []) {
    console.error(`  Target: ${node.target.join(", ")}`);
    if (node.failureSummary) {
      console.error(`  ${node.failureSummary.replace(/\n/g, "\n  ")}`);
    }
  }
}

async function scanSurface(page, surface) {
  const results = await new AxeBuilder({ page }).analyze();
  auditResults.push({ surface, results });

  for (const violation of results.violations) {
    printFinding(surface, "violation", violation);
  }
  for (const incomplete of results.incomplete) {
    printFinding(surface, "manual review", incomplete);
  }
  console.log(
    `axe scan "${surface}": ${results.violations.length} violations, `
    + `${results.incomplete.length} items requiring manual review`
  );
  return results;
}

function criterionReportRow([criterion, title, level]) {
  const tag = `wcag${criterion.replace(/\./g, "")}`;
  const automatedChecks = auditResults.flatMap(({ results }) => [
    ...results.passes,
    ...results.violations
  ]).filter((rule) => rule.tags.includes(tag));
  const findings = auditResults.flatMap(({ surface, results }) => (
    results.violations
      .filter((violation) => violation.tags.includes(tag))
      .map((violation) => ({ surface, violation }))
  ));
  const manualChecks = auditResults.flatMap(({ surface, results }) => (
    results.incomplete
      .filter((item) => item.tags.includes(tag))
      .map((item) => ({ surface, item }))
  ));

  let result = "Not tested";
  let howTested = "Not tested";
  let notes = "No axe rule for this criterion was exercised by these scans.";
  if (findings.length) {
    result = `Finding: ${findings.map(({ violation }) => violation.id).join(", ")}`;
    howTested = [...new Set(findings.map(({ surface }) => surface))].join("; ");
    notes = "Automated axe finding; this is not a complete conformance assessment.";
  } else if (automatedChecks.length) {
    result = "No axe violations";
    const surfaces = new Set();
    for (const { surface, results } of auditResults) {
      if ([...results.passes, ...results.violations].some((rule) => rule.tags.includes(tag))) {
        surfaces.add(surface);
      }
    }
    howTested = [...surfaces].join("; ");
    notes = "Automated axe checks only; no full WCAG conformance claim.";
    if (manualChecks.length) {
      result += " (manual review needed)";
      notes += ` Axe requires manual review for ${[...new Set(manualChecks.map(({ item }) => item.id))].join(", ")}.`;
    }
  } else if (manualChecks.length) {
    howTested = `Axe flagged manual review on ${[...new Set(manualChecks.map(({ surface }) => surface))].join("; ")}`;
    notes = `Not tested automatically; manual review is required for ${[...new Set(manualChecks.map(({ item }) => item.id))].join(", ")}.`;
  }

  return `| ${criterion} ${title} (${level}) | ${result} | ${howTested} | ${notes} |`;
}

function writeConformanceReport() {
  const auditDirectory = path.dirname(fileURLToPath(import.meta.url));
  const projectRoot = path.resolve(auditDirectory, "../..");
  const packageInfo = JSON.parse(readFileSync(path.join(auditDirectory, "package.json"), "utf8"));
  const axeInfo = JSON.parse(readFileSync(
    path.join(auditDirectory, "node_modules", "axe-core", "package.json"),
    "utf8"
  ));
  const browser = process.env.A11Y_BROWSER_CHANNEL
    ? `${process.env.A11Y_BROWSER_CHANNEL} channel (Chromium engine)`
    : "Playwright bundled Chromium";
  const execution = process.env.A11Y_EXECUTION_ENV === "docker"
    ? "Docker container"
    : "local Playwright server";
  const scannedSurfaces = auditResults.map(({ surface }) => surface);
  const severe = auditResults.flatMap(({ surface, results }) => (
    results.violations
      .filter(({ impact }) => impact === "critical" || impact === "serious")
      .map(({ id, impact }) => `${surface}: ${id} (${impact})`)
  ));
  const report = [
    "# WCAG 2.2 AA automated conformance scan",
    "",
    `- Run date: ${new Date().toISOString()}`,
    `- Runner: Playwright ${packageInfo.devDependencies["@playwright/test"]}, ${browser}, axe-core ${axeInfo.version}`,
    `- Execution: ${execution}.`,
    `- Scanned surfaces: ${scannedSurfaces.join("; ")}.`,
    `- Critical/serious axe violations: ${severe.length}.`,
    `- Open shadow DOM: axe-core default traversal, verified with a calibration check that detects a deliberately unnamed button inside an open shadow root.`,
    "- This report records automated scan outcomes only. “No axe violations” is not a declaration of WCAG conformance; keyboard, visual, assistive-technology, and other manual checks are not inferred.",
    "- The access-needs screen is a test-only fixture. The production form does not currently have an access-needs screen.",
    "",
    "| Criterion | Result | How tested | Notes |",
    "| --- | --- | --- | --- |",
    ...WCAG_CRITERIA.map(criterionReportRow),
    ""
  ].join("\n");
  const docsDirectory = path.join(projectRoot, "docs");
  mkdirSync(docsDirectory, { recursive: true });
  writeFileSync(path.join(docsDirectory, "conformance-report.md"), report, "utf8");
}

test("axe scans every form screen, access-needs fixture, jobs list, and CV", async ({ page }) => {
  test.setTimeout(180_000);

  const formScreens = [
    ["skills checklist", {}],
    ["location", { skills: ["typing"], location: "" }],
    ["education", { skills: ["typing"], location: "addis-ababa", education: { level: "", field: "" } }],
    ["work history", completeProfile({ workHistorySkipped: false, workHistory: {} })]
  ];

  for (const [label, profile] of formScreens) {
    await loadProfileAtFirstUnanswered(page, profile);
    await expect(page.locator(".job-profile-screen h1")).toBeVisible();
    await scanSurface(page, `form: ${label}`);
  }

  await page.setViewportSize({ width: 320, height: 800 });
  await loadProfileAtFirstUnanswered(page, {});
  await expect(page.locator(".job-profile-screen h1")).toBeVisible();
  await scanSurface(page, "form: skills checklist at 320px");
  await page.setViewportSize({ width: 1280, height: 900 });

  await page.goto("/access-needs");
  await scanSurface(page, "access-needs screen (test-only fixture)");

  await loadProfileAtFirstUnanswered(page, completeProfile());
  await expect(page.locator(".job-profile-screen ol li").first()).toBeVisible();
  await scanSurface(page, "jobs list");

  const profile = completeProfile({
    name: "Alem Tesfaye",
    accessNeeds: ["screen-reader-friendly"]
  });
  const html = await page.evaluate(async (value) => {
    const { generateCV } = await import("/web/cv.js");
    return generateCV(value, { includeAccess: true });
  }, profile);
  const cvPage = await page.context().newPage();
  await cvPage.setContent(html);
  await expect(cvPage.locator("main.cv-page h1")).toHaveText("Alem Tesfaye");
  await scanSurface(cvPage, "generated CV");
  await cvPage.close();

  await page.goto("/");
  await page.evaluate(() => {
    const host = document.createElement("div");
    host.id = "axe-shadow-probe";
    const shadow = host.attachShadow({ mode: "open" });
    const unnamedButton = document.createElement("button");
    shadow.append(unnamedButton);
    document.body.append(host);
  });
  const shadowResults = await new AxeBuilder({ page }).withRules(["button-name"]).analyze();
  const shadowRule = shadowResults.violations.find(({ id }) => id === "button-name");
  expect(shadowRule, "axe must detect the unnamed button within an open shadow root").toBeTruthy();
  expect(
    shadowRule.nodes.some((node) => node.target.some((target) => target.includes("#axe-shadow-probe"))),
    "the detected button-name finding must point to the shadow-root calibration fixture"
  ).toBe(true);
  const shadowTarget = shadowRule.nodes.find((node) => node.target.some((target) => target.includes("#axe-shadow-probe")));
  console.log(`axe open-shadow-root calibration: detected button-name at ${shadowTarget.target.join(", ")}`);

  writeConformanceReport();

  const severe = auditResults.flatMap(({ surface, results }) => (
    results.violations
      .filter(({ impact }) => impact === "critical" || impact === "serious")
      .map(({ id, impact }) => `${surface}: ${id} (${impact})`)
  ));
  expect(severe, `Critical or serious axe violations:\n${severe.join("\n")}`).toEqual([]);
});
