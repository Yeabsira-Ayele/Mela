function stringIds(value) {
  return Array.isArray(value) ? value.filter((id) => typeof id === "string") : [];
}

function text(value) {
  return typeof value === "string" ? value : "";
}

function matchJobs(profile, jobs, options = {}) {
  const safeProfile = profile && typeof profile === "object" ? profile : {};
  const profileSkills = stringIds(safeProfile.skills);
  const sharedNeeds = safeProfile.shareDisability === true ? stringIds(safeProfile.accessNeeds) : [];
  const safeJobs = Array.isArray(jobs) ? jobs : [];
  const safeOptions = options && typeof options === "object" ? options : {};
  const rows = [];

  for (const job of safeJobs) {
    if (!job || typeof job !== "object" || typeof job.identifier !== "string" || !job.identifier) {
      continue;
    }
    if (typeof safeOptions.now === "string" && typeof job.validThrough === "string" && job.validThrough < safeOptions.now) {
      continue;
    }

    const jobSkills = stringIds(job.skills);
    const matchedSkills = jobSkills.filter((skill) => profileSkills.includes(skill));
    const skillsPart = jobSkills.length ? matchedSkills.length / jobSkills.length : 0;
    const accommodations = stringIds(job.accommodations);
    const offeredNeeds = sharedNeeds.filter((need) => accommodations.includes(need));
    const accommodationPart = sharedNeeds.length ? offeredNeeds.length / sharedNeeds.length : 0;
    const jobLocation = job.jobLocation && typeof job.jobLocation === "object" ? job.jobLocation : {};
    const address = jobLocation.address && typeof jobLocation.address === "object" ? jobLocation.address : {};
    const jobCity = text(address.addressLocality);
    const isRemote = job.jobLocationType === "TELECOMMUTE";
    const locationPart = isRemote || (text(safeProfile.location) && text(safeProfile.location) === jobCity) ? 1 : 0;
    const scoreTotal = sharedNeeds.length
      ? skillsPart * 0.6 + locationPart * 0.2 + accommodationPart * 0.2
      : (skillsPart * 0.6 + locationPart * 0.2) / 0.8;
    const title = job.title && typeof job.title === "object" ? job.title : {};
    const reasons = [];

    if (matchedSkills.length) {
      reasons.push({
        code: "skills_match",
        params: { matched: matchedSkills, total: jobSkills.length }
      });
    } else {
      reasons.push({ code: "skills_none", params: { total: jobSkills.length } });
    }

    if (isRemote) {
      reasons.push({ code: "location_remote", params: {} });
    } else if (text(safeProfile.location) && text(safeProfile.location) === jobCity) {
      reasons.push({ code: "location_match", params: { city: jobCity } });
    } else {
      reasons.push({ code: "location_other", params: { city: jobCity } });
    }

    if (sharedNeeds.length) {
      if (offeredNeeds.length) {
        reasons.push({
          code: "accommodation_match",
          params: { matched: offeredNeeds, total: sharedNeeds.length }
        });
      } else {
        reasons.push({ code: "accommodation_none", params: { total: sharedNeeds.length } });
      }
    }

    rows.push({
      match: {
        jobId: job.identifier,
        title: {
          en: text(title.en),
          am: text(title.am)
        },
        score: Math.max(0, Math.min(100, Math.round(scoreTotal * 100))),
        reasons,
        accommodations
      },
      datePosted: text(job.datePosted)
    });
  }

  rows.sort((a, b) => {
    if (a.match.score !== b.match.score) {
      return b.match.score - a.match.score;
    }
    if (a.datePosted !== b.datePosted) {
      return b.datePosted < a.datePosted ? -1 : 1;
    }
    if (a.match.jobId === b.match.jobId) {
      return 0;
    }
    return a.match.jobId < b.match.jobId ? -1 : 1;
  });

  return rows.map((row) => row.match);
}

export { matchJobs };
