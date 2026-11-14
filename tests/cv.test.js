import assert from "node:assert/strict";
import { test } from "node:test";
import { generateCV } from "../web/cv.js";
import { setLanguage } from "../web/i18n.js";

test("CV output is a localized HTML document with escaped values and semantic lists", () => {
  setLanguage("en");
  const profile = {
    name: `<img src=x onerror="alert('name')"> &`,
    location: "addis-ababa",
    skills: ["typing", "<script>alert('skill')</script>"],
    otherSkill: "<svg onload=alert(1)>",
    education: { level: "secondary", field: `"Science" & art` },
    workHistory: { role: "<script>alert('role')</script>", organization: "A & B", years: 3 }
  };
  const html = generateCV(profile);

  assert.match(html, /<html lang="en">/);
  assert.match(html, /<h1>&lt;img src=x onerror=&quot;alert\(&#39;name&#39;\)&quot;&gt; &amp;<\/h1>/);
  assert.match(html, /<h2>Location<\/h2>/);
  assert.match(html, /<h2>Skills<\/h2>/);
  assert.match(html, /<h2>Education<\/h2>/);
  assert.match(html, /<h2>Work experience<\/h2>/);
  assert.match(html, /<ul>[\s\S]*<li class="cv-list-item">Typing<\/li>/);
  assert.match(html, /&lt;script&gt;alert\(&#39;skill&#39;\)&lt;\/script&gt;/);
  assert.match(html, /&lt;script&gt;alert\(&#39;role&#39;\)&lt;\/script&gt;/);
  assert.doesNotMatch(html, /<table\b/i);
});

test("access needs are included only after explicit CV opt-in", () => {
  const profile = {
    shareDisability: true,
    accessNeeds: ["screen-reader-friendly", "flexible-hours"]
  };
  const privateCV = generateCV(profile);
  const sharedCV = generateCV(profile, { includeAccess: true });

  assert.doesNotMatch(privateCV, /<h2>Access needs<\/h2>/);
  assert.doesNotMatch(privateCV, /Screen-reader-friendly tools/);
  assert.match(sharedCV, /<h2>Access needs<\/h2>/);
  assert.match(sharedCV, /Screen-reader-friendly tools/);
  assert.match(sharedCV, /Flexible hours/);
});

test("CV print styles keep pages readable and suppress print controls", () => {
  const html = generateCV({});

  assert.match(html, /Noto Sans Ethiopic/);
  assert.match(html, /@media print/);
  assert.match(html, /color: #000 !important/);
  assert.match(html, /background: #fff !important/);
  assert.match(html, /\.cv-print-actions \{ display: none !important; \}/);
  assert.match(html, /break-inside: avoid-page/);
  assert.match(html, /Print or save as PDF/);
});

test("CV language follows the active language", () => {
  setLanguage("am");
  const html = generateCV({ name: "ሚሚ" });

  assert.match(html, /<html lang="am">/);
  assert.match(html, /<h2>ችሎታዎች<\/h2>/);
  assert.match(html, /አትም ወይም እንደ PDF አስቀምጥ/);
  setLanguage("en");
});
