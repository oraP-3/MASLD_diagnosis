# MASLD Clinical Support — Implementation Plan v0.1

Status: historical implementation plan; implementation completed through Phase E  
Base: specification v0.3  
Original date: 2026-09-28  
Status reviewed: 2026-10-01

This file preserves the original implementation plan and starting-repository audit. Statements describing the initial repository state are historical and should not be read as the current architecture. Current architecture is summarized in the repository README; current execution state is tracked in Issue #2.

## 1. Scope lock

### Owner decisions

- Reuse `oraP-3/MASLD_diagnosis` rather than starting a new repository.
- Redesign the old diagnosis prototype into a single-session, stateless MASLD clinical-support tool.
- Keep input burden low.
- Prefer conditional questions over broad history intake.
- Show missing information only when it changes a decision.
- Keep fibrosis interpretation separate from medication eligibility.
- Do not persist patient information.

### Non-goals

- no backend
- no authentication
- no patient database
- no longitudinal data model
- no unrelated framework migration
- no automatic drug-selection engine
- no semaglutide eligibility engine
- no broad clinical questionnaire

## 2. Current repository audit

Current `main` contains one implementation artifact:
- `index.html` — actually a React component source file despite the filename

No project-local `AGENTS.md`, README, package manifest, test configuration, or formal build setup is present.

This means the existing code is best treated as a prototype asset source rather than a stable architecture.

## 3. Legacy asset disposition

### Reuse concept / logic

#### Alcohol calculator
Reuse:
- beverage categories
- alcohol-content values
- weekly-alcohol calculation concept

Change:
- direct g/week entry becomes the default
- beverage calculator becomes an optional helper

#### SLD classification
Reuse:
- sex-specific alcohol threshold concept
- MASLD / MetALD / ALD routing structure

Change:
- CMRF must be derived from real numeric inputs rather than manual CMRF checkboxes
- specific-cause handling should be simplified and reviewed against the final UI

#### FIB-4
Reuse:
- formula
- automatic calculation concept
- age-sensitive lower threshold concept

Change:
- output wording should become fibrosis-risk support rather than referral / treatment automation

### Remove / replace

#### Manual CMRF checkboxes
Remove.
Numeric data should drive CMRF automatically.

#### Wegovy eligibility block
Remove entirely.
Replace with generic fibrosis-test interpretation.

#### Mandatory long alcohol workflow
Replace with direct g/week entry plus optional calculator.

#### Current long vertical step flow
Replace with compact input + result-oriented single-session layout.

### Do not preserve blindly

The existing NIT cutoffs and all medication-eligibility statements must not be copied forward without revalidation against specification v0.3.

## 4. Proposed internal modules

The implementation does not need a heavy architecture, but the clinical logic should be separated from rendering.

Suggested logical modules:

1. `sldClassification`
2. `fibrosisAssessment`
3. `bloodPressureAssessment`
4. `lipidAssessment`
5. `glycemicAssessment`
6. `uricAcidAssessment`
7. `missingDataSuggestions`

The exact file split is an implementation decision. The important constraint is that clinical rules must not be scattered across JSX conditionals.

## 5. State model

Single-session state only.

Core state groups:

### Basic
- age
- sex
- bmi
- sbp
- dbp
- smoking

### SLD
- steatosis
- alcohol_g_week
- optional alcohol-helper state

### Labs
- ast
- alt
- platelets
- hba1c
- optional glucose confirmation
- ldl
- hdl
- tg
- uric_acid

### Existing diagnosis / treatment
- antihypertensive_treatment
- diagnosed_diabetes
- diagnosed_ckd
- lipid_treatment
- urate_treatment

### CKD scope note

- CKD is treated as pre-existing clinician knowledge via `diagnosed_ckd`.
- Do not collect numeric eGFR solely to reconstruct CKD diagnosis.
- De-novo CKD diagnosis is outside this application's scope.

### Conditional background
Only instantiate / display when a branch requires it:
- cardiovascular_history
- relevant_secondary_prevention_subtype
- pad
- atrial_fibrillation
- proteinuria
- diabetic_microvascular_disease
- gout
- urinary_stone
- bp_persistence_confirmation
- fasting_status
- waist_circumference
- second_line_nit

## 6. Implementation sequence

### Phase A — Establish application shell

- preserve old `main`
- convert repository into a minimally runnable app structure if needed
- add README with purpose and local run instructions
- add a clinical-source / update note
- do not yet implement all logic

Acceptance:
- app runs locally
- no patient persistence
- no legacy Wegovy eligibility output remains in the active UI

### Phase B — Core shared inputs + SLD + FIB-4

Implement:
- basic inputs
- BMI helper
- direct alcohol g/week + optional old alcohol calculator
- numeric CMRF derivation
- SLD classification
- FIB-4
- conditional NIT area

Acceptance:
- old manual CMRF checkboxes are gone
- classification derives from actual entered values
- FIB-4 matches hand-calculated fixtures
- NIT output never declares drug eligibility

### Phase C — Glycemia + uric acid

Implement the simpler metabolic branches first:
- HbA1c interpretation
- conditional glucose confirmation
- hyperuricemia
- conditional gout / stone questions
- missing-data suggestions

Acceptance:
- UA <=7 does not trigger gout / stone questions
- HbA1c <6.5 without known diabetes does not trigger glucose-confirmation UI
- HbA1c >=6.5 does

### Phase D — Blood pressure

Implement:
- office BP category
- conditional persistence confirmation
- background risk calculation
- readable action summary
- proteinuria question only when relevant

Acceptance:
- JSH category complexity remains internal
- user-facing result explains why risk is elevated
- one elevated reading can remain `needs confirmation`

### Phase E — Lipids

Implement:
- lipid-specific secondary-prevention routing
- DM / CKD / PAD high-risk routing
- modified Hisayama calculation
- known-FH / LDL-C >=180 guard
- conditional diabetic microvascular question
- LDL target
- TG fasting / casual interpretation without a routine fasting-status prompt

Acceptance:
- diagnosed / established diabetes bypasses Hisayama
- unresolved diabetic-range glycemia does not get downgraded to a 1-point glucose-abnormality state
- non-diabetic HbA1c 5.7–6.4% / FPG 100–125 may contribute the glucose-abnormality point
- broad BP CVD history is not reused as lipid secondary prevention
- risk score is calculated internally, not manually entered
- TG 150–174 mg/dL does not trigger a lipid fasting-status question solely for target classification

### Phase F — Unified result view

Build the six result cards and one combined `additional information to confirm` section.

Acceptance:
- irrelevant missing data are not displayed
- all required missing-data suggestions are deduplicated
- the user can understand current conclusions without reading raw logic

## 7. Validation strategy

Because this is clinical rule software, validation should focus on rule fixtures rather than visual inspection alone.

Create small deterministic fixtures for each module.

Examples:

### Fibrosis
- age <66, FIB-4 below 1.3
- age <66, FIB-4 1.3–2.67
- age >=66 with FIB-4 between 1.3 and 2.0
- FIB-4 >2.67

### Blood pressure
- 148/92 without high-risk background
- 148/92 with diabetes
- 135/85 with diabetes
- untreated high BP without persistence confirmation

### Lipids
- secondary prevention
- diabetes primary prevention
- CKD primary prevention
- PAD primary prevention
- eligible modified-Hisayama case
- age outside 40–79

### Glycemia
- HbA1c 5.6
- HbA1c 6.1
- HbA1c 6.6 without glucose
- HbA1c 6.6 + diagnostic glucose
- diagnosed diabetes with HbA1c above / below 7

### Uric acid
- UA 6.5
- UA 7.5 no gout
- UA 8.4 + relevant complication
- UA 8.4 without complication
- UA 9.2 without complication
- gout present

## 8. Safety / maintenance constraints

- Clinical thresholds must be centralized, not duplicated across rendering code.
- Each threshold group should include a source/version comment or adjacent documentation.
- Guideline updates should require changing one rule source, not hunting through UI text.
- The UI must distinguish:
  - measured fact
  - derived classification
  - suggested next evaluation
  - treatment consideration
- Avoid wording that falsely implies a definitive diagnosis from incomplete data.

## 9. First implementation batch recommendation

The first code PR should cover only:

- app shell cleanup
- basic inputs
- BMI helper
- direct alcohol input + optional alcohol helper
- derived CMRF
- SLD classification
- FIB-4
- removal of Wegovy eligibility output

Do not include BP, lipid, glycemia, and uric-acid treatment logic in the first implementation PR.

Reason:
this creates a small, testable baseline and prevents five independent clinical rule engines from being debugged simultaneously.

## 10. Stop condition before implementation

Implementation should begin only after:
- specification v0.3 is accepted as the current owner contract;
- this implementation plan is reviewed for scope;
- the first implementation batch is explicitly selected.

If implementation discovers a clinical rule ambiguity that changes output behavior, return to specification rather than silently deciding inside code.
