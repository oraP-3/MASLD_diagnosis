# MASLD Clinical Support

Single-session, stateless clinical support tool for MASLD-related outpatient assessment.

## Current implementation status

Implemented:

- BMI-first input with optional height/weight calculator
- direct alcohol intake input (g/week) with optional beverage calculator
- automatic cardiometabolic risk criteria (CMRF) derivation
- SLD / MASLD / MetALD / ALD classification support
- FIB-4 calculation with age-sensitive interpretation
- platelet-based supportive fibrosis context
- conditional optional second-line NIT interpretation
- B1 glycemia engine: HbA1c interpretation, conditional glucose confirmation, and general HbA1c target context for diagnosed diabetes
- B3 uric-acid engine: hyperuricemia classification, conditional gout/stone context, 8/9 mg/dL treatment-consideration branches, and urate-treatment target context

Not yet implemented:

- hypertension treatment logic
- lipid / modified Hisayama logic
- unified missing-data result dashboard

The tool stores no patient data and contains no backend or local-storage persistence.

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

## Clinical rule sources

The current clinical contract is `docs/spec-v0.3.md`.

Key Phase A rules are based on the Japanese 2026 MASLD diagnostic criteria and the 2026 evidence-based MASLD clinical practice guideline. B1 glycemia rules use the Japan Diabetes Society Clinical Practice Guideline for Diabetes 2024. B3 uric-acid rules follow the B2 evidence lock based on the Japanese Society of Gout and Uric & Nucleic Acids third edition plus 2022 supplement. Current authoritative guidelines and regulatory documents supersede repository interpretations if they change.

## Non-goals

This tool does not:

- store patient identifiers or longitudinal records
- make final autonomous treatment decisions
- determine semaglutide/Wegovy eligibility
- assign definitive histologic fibrosis stage from NIT alone
