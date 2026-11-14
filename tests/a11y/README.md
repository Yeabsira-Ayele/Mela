# Accessibility scans

The Playwright runner serves the demo over HTTP inside the runner container, then scans the job-profile screens, the access-needs fixture, the jobs list, and generated CV with axe-core.

From the repository root:

```powershell
docker build -f tests/a11y/Dockerfile -t mela-a11y .
New-Item -ItemType Directory -Force docs | Out-Null
docker run --rm -v "${PWD}/docs:/workspace/docs" mela-a11y
```

For local execution, run these commands from `tests/a11y`:

```powershell
npm ci
npx playwright install chromium
npm test
```

Dependencies are isolated to this folder. If Google Chrome is already installed, you can skip the browser install and run `$env:A11Y_BROWSER_CHANNEL="chrome"; npm test` in PowerShell instead. The test writes `docs/conformance-report.md` from the actual scan results.

Open shadow roots are scanned by axe-core automatically. The suite also runs a calibration check with a deliberately unnamed button placed only in an open shadow root; it requires axe to report `button-name` before it scans the app surfaces.
