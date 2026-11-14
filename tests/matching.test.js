import assert from "node:assert/strict";
import { test } from "node:test";
import { matchJobs } from "../web/matching.js";

function makeJob(overrides = {}) {
  return {
    "@type": "JobPosting",
    identifier: "job-001",
    title: { en: "Customer Support Agent", am: "የደንበኞች ድጋፍ ሰራተኛ" },
    description: { en: "Answer customer calls.", am: "የደንበኞችን ጥሪ ይመልሱ።" },
    jobLocation: {
      address: {
        addressLocality: "addis-ababa",
        addressCountry: "ET"
      }
    },
    jobLocationType: null,
    skills: ["customer-service", "communication", "phone-support", "typing"],
    datePosted: "2026-11-01",
    validThrough: "2026-12-31",
    accommodations: ["screen-reader-friendly", "remote"],
    ...overrides
  };
}

function assertNoNonFiniteNumbers(value) {
  if (typeof value === "number") {
    assert.ok(Number.isFinite(value));
  } else if (Array.isArray(value)) {
    for (const item of value) {
      assertNoNonFiniteNumbers(item);
    }
  } else if (value && typeof value === "object") {
    for (const item of Object.values(value)) {
      assert.notEqual(item, undefined);
      assertNoNonFiniteNumbers(item);
    }
  }
}

test("empty profile scores a local job zero and a remote job 25", () => {
  const localJob = makeJob();
  const remoteJob = makeJob({ identifier: "job-remote", jobLocationType: "TELECOMMUTE" });

  assert.equal(matchJobs({}, [localJob])[0].score, 0);
  assert.equal(matchJobs({}, [remoteJob])[0].score, 25);
});

test("a job with no skills scores zero", () => {
  const result = matchJobs({ skills: ["typing"] }, [makeJob({ skills: [] })])[0];

  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons[0], { code: "skills_none", params: { total: 0 } });
});

test("unknown profile skill ids do not match known job skills", () => {
  const result = matchJobs({ skills: ["not-a-contract-skill"] }, [makeJob()])[0];

  assert.equal(result.score, 0);
  assert.deepEqual(result.reasons[0], { code: "skills_none", params: { total: 4 } });
});

test("remote work contributes the location score and reason", () => {
  const result = matchJobs(
    {},
    [makeJob({ jobLocationType: "TELECOMMUTE" })]
  )[0];

  assert.equal(result.score, 25);
  assert.deepEqual(result.reasons[1], { code: "location_remote", params: {} });
});

test("accommodation needs affect scores only when the person shares them", () => {
  const profile = {
    skills: ["customer-service", "communication"],
    location: "addis-ababa",
    accessNeeds: ["screen-reader-friendly", "flexible-hours"],
    shareDisability: false
  };
  const job = makeJob();
  const privateResult = matchJobs(profile, [job])[0];
  const sharedResult = matchJobs({ ...profile, shareDisability: true }, [job])[0];

  assert.equal(privateResult.score, 63);
  assert.equal(sharedResult.score, 60);
  assert.equal(privateResult.reasons.some((reason) => reason.code.startsWith("accommodation_")), false);
  assert.deepEqual(sharedResult.reasons[2], {
    code: "accommodation_match",
    params: { matched: ["screen-reader-friendly"], total: 2 }
  });
});

test("empty shared needs use the same rescaled score as not sharing", () => {
  const job = makeJob();
  const profile = { skills: ["customer-service"], location: "addis-ababa" };

  assert.equal(
    matchJobs({ ...profile, shareDisability: true, accessNeeds: [] }, [job])[0].score,
    matchJobs({ ...profile, shareDisability: false }, [job])[0].score
  );
});

test("unoffered shared needs add no accommodation score", () => {
  const result = matchJobs({
    skills: ["customer-service", "communication"],
    location: "addis-ababa",
    shareDisability: true,
    accessNeeds: ["flexible-hours"]
  }, [makeJob({ accommodations: [] })])[0];

  assert.equal(result.score, 50);
  assert.deepEqual(result.reasons[2], {
    code: "accommodation_none",
    params: { total: 1 }
  });
});

test("results sort by score, posting date, and job id without mutating inputs", () => {
  const profile = { skills: ["typing"], location: "hawassa" };
  const originalSkills = [...profile.skills];
  const jobs = [
    makeJob({ identifier: "z-job", skills: ["typing"], datePosted: "2026-11-03" }),
    makeJob({ identifier: "old-job", skills: ["typing"], datePosted: "2026-11-01" }),
    makeJob({ identifier: "lower-score", skills: ["typing", "data-entry"], datePosted: "2026-11-04" }),
    makeJob({ identifier: "b-job", skills: ["typing"], datePosted: "2026-11-03" }),
    makeJob({ identifier: "a-job", skills: ["typing"], datePosted: "2026-11-03" })
  ];
  const originalIds = jobs.map((job) => job.identifier);
  const result = matchJobs(profile, jobs);

  assert.deepEqual(result.map((match) => match.jobId), ["a-job", "b-job", "z-job", "old-job", "lower-score"]);
  assert.deepEqual(jobs.map((job) => job.identifier), originalIds);
  assert.deepEqual(profile.skills, originalSkills);
});

test("reason codes include city and shared accommodation parameters", () => {
  const result = matchJobs({
    skills: ["customer-service"],
    location: "addis-ababa",
    shareDisability: true,
    accessNeeds: ["flexible-hours", "quiet-workspace"]
  }, [makeJob({ accommodations: ["flexible-hours"] })])[0];

  assert.deepEqual(result.reasons, [
    { code: "skills_match", params: { matched: ["customer-service"], total: 4 } },
    { code: "location_match", params: { city: "addis-ababa" } },
    { code: "accommodation_match", params: { matched: ["flexible-hours"], total: 2 } }
  ]);
});

test("expired jobs are filtered only when an options date is supplied", () => {
  const expiredJob = makeJob({ validThrough: "2026-11-13" });

  assert.equal(matchJobs({}, [expiredJob]).length, 1);
  assert.equal(matchJobs({}, [expiredJob], { now: "2026-11-14" }).length, 0);
});

test("malformed profiles, jobs, and options do not produce non-finite output", () => {
  const profiles = [
    null,
    undefined,
    7,
    "profile",
    { skills: "typing", location: {}, shareDisability: true, accessNeeds: [null, 5] }
  ];
  const jobs = [
    null,
    {},
    {
      identifier: "malformed-job",
      title: 3,
      jobLocation: "unknown",
      skills: [null, 2],
      accommodations: "not-an-array"
    }
  ];

  for (const profile of profiles) {
    const result = matchJobs(profile, jobs, null);
    assertNoNonFiniteNumbers(result);
    assert.ok(result.every((match) => Number.isInteger(match.score) && match.score >= 0 && match.score <= 100));
  }

  assert.deepEqual(matchJobs(null, null), []);
  assert.deepEqual(matchJobs(null, []), []);
});
