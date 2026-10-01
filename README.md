# MASLD Clinical Support

Single-session, stateless clinical support tool for MASLD-related outpatient assessment.

The application is designed for clinician use in one encounter. It combines six domains into one result view while asking for additional information only when it can materially change the current classification, further evaluation, or treatment consideration.

## Current implementation

Implemented clinical domains:

- SLD / MASLD / MetALD / ALD classification with automatically derived cardiometabolic risk factors (CMRF)
- hepatic fibrosis support with FIB-4, platelet context, and conditional second-line NIT interpretation
- blood-pressure classification, JSH risk context, persistence confirmation, and treated / untreated action wording
- lipid routing with modified Hisayama risk classification, LDL-C targets, triglyceride handling, FH / secondary-prevention branches, and target-status display
- glycemic assessment with MASLD CMRF thresholds, diabetes-confirmation branches, and diagnosed-diabetes target context
- uric-acid assessment with gout / complication branches, 7 / 8 / 9 mg/dL logic, and urate-treatment target context

Integrated workflow:

- BMI-first input with optional height / weight calculator
- direct weekly alcohol input with optional beverage calculator
- conditional questions shown only when decision-relevant
- unified six-card clinician result view
- globally deduplicated missing information with:
  - class A: required for the current decision
  - class B: next clinically meaningful evaluation
- explicit input / result view switching for compact mobile use
- no patient-data persistence

## Architecture

The application intentionally remains small and framework-free:

- `clinical-rules.js` — domain clinical rules and deterministic decision engines
- `unified-results.js` — cross-domain normalization and missing-data deduplication
- `result-view.js` — escaped result rendering
- `app.js` — single-session DOM/controller logic and conditional prompts
- `index.html` / `styles.css` — static application shell and responsive presentation

There is no backend, database, authentication layer, build framework, or local-storage persistence.

F2 architecture reassessment (2026-10-01): this separation remains adequate for the current private, stateless tool. Splitting the clinical engine into additional files or introducing a framework would add migration and coordination cost without a clear maintenance benefit, so no architecture refactor is planned.

## Run locally

```bash
python3 -m http.server 8000
```

Then open `http://localhost:8000/`.

## Tests

Node.js 20+ recommended.

```bash
npm test
```

The test suite uses Node's built-in test runner; no package install is required.

## Clinical contract and source versions

The current clinical contract is [`docs/spec-v0.3.md`](docs/spec-v0.3.md).

Domain-specific evidence locks:

- MASLD / SLD / fibrosis: Japanese 2026 MASLD diagnostic criteria and the 2026 evidence-based MASLD clinical practice guideline, as reflected in the clinical specification
- glycemia: Japan Diabetes Society Clinical Practice Guideline for Diabetes 2024
- blood pressure: [JSH2025 evidence lock](docs/bp-evidence-lock-v0.1.md), including the Japanese Society of Nephrology 2026 CKD blood-pressure statement
- lipids: [JAS lipid evidence lock](docs/lipid-evidence-lock-v0.1.md), based on the JAS Guidelines for Prevention of Atherosclerotic Cardiovascular Diseases 2022, the Comprehensive Risk-Management Chart 2025, and the JAS Adult Familial Hypercholesterolemia Focus Update 2025
- uric acid: [uric-acid evidence lock](docs/uric-acid-evidence-lock-v0.1.md), based on the Japanese Society of Gout and Uric & Nucleic Acids third edition plus the 2022 supplement
- unified result / missing-data semantics: [`docs/unified-result-contract-v0.1.md`](docs/unified-result-contract-v0.1.md)

These repository locks document the rule set implemented by the application. If an authoritative guideline or regulatory source is revised, the current authoritative source takes precedence and the lock should be reviewed before clinical logic is changed.

## Non-goals

This tool does not:

- store patient identifiers or longitudinal records
- diagnose CKD de novo from a single eGFR value
- replace clinician diagnosis or make final autonomous treatment decisions
- select a specific antihypertensive, lipid-lowering, glucose-lowering, or urate-lowering drug
- determine semaglutide / Wegovy eligibility
- assign a definitive histologic fibrosis stage from NIT alone
- provide a broad general-purpose medical questionnaire

## Project state

The implementation and QA roadmap is tracked in Issue #2. Historical planning decisions are preserved in [`docs/implementation-plan-v0.1.md`](docs/implementation-plan-v0.1.md).
