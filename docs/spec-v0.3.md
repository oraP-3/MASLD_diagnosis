# MASLD Clinical Support — Specification v0.3

Status: owner-reviewed draft, ready for implementation planning  
Date: 2026-09-28

## 1. Product responsibility

This tool is a single-session, stateless outpatient support tool for MASLD-related assessment.

It accepts the best currently available health-check / work-up data once and organizes:

- SLD classification
- hepatic fibrosis risk
- blood-pressure assessment
- lipid-risk assessment
- glycemic assessment
- hyperuricemia assessment

It also suggests **only those missing data that can materially change classification, further testing, or treatment consideration**.

The tool does not store patient names, IDs, dates, prior visits, or longitudinal records.

## 2. Input principles

1. Minimize mandatory inputs.
2. Do not ask for information merely because it is generally clinically useful.
3. Ask conditional questions only when the answer can change a downstream branch.
4. Treat `missing and decision-relevant` differently from `not currently needed`.
5. Compress medically similar items when their downstream decision is identical.
6. Keep items separate when downstream management differs.

Examples:
- gout attack / gouty tophus -> one `gout present` item.
- urinary stone history remains separate from gout.
- BMI is the standard input; height + weight is only an optional BMI calculator.

## 3. Initial inputs

### Basic
- age
- sex
- BMI
- office SBP
- office DBP
- current smoking

### SLD
- hepatic steatosis present / absent
- pure alcohol intake in g/week

If alcohol intake is unknown, the existing beverage / quantity calculator may be expanded as an optional helper.

### Laboratory
- AST
- ALT
- platelet count
- HbA1c
- fasting glucose (if available)
- LDL-C
- HDL-C
- triglycerides
- eGFR
- uric acid

Conditional helpers:
- height + weight -> BMI
- creatinine -> eGFR
- random glucose only when diabetes confirmation requires it

### Existing diagnosis / treatment
Compact initial flags:
- taking antihypertensive medication
- diagnosed diabetes
- taking lipid-lowering medication
- taking urate-lowering medication

## 4. Conditional background data

Ask only when a relevant branch requires it:

- cardiovascular / cerebrovascular disease history
- CKD
- PAD
- atrial fibrillation
- proteinuria
- diabetic microvascular disease
- gout (attack or tophus)
- urinary stone history

## 5. Logic 0 — SLD / MASLD classification

If hepatic steatosis is absent, do not continue SLD subtype classification.

If steatosis is present, classify using:
- cardiometabolic risk factors
- alcohol intake
- specific competing causes when clinically necessary

CMRF should be calculated from entered values where possible rather than entered as manual checkboxes.

If BMI is <23 and no other CMRF is present, request waist circumference only when waist circumference could change MASLD classification.

Do not require waist circumference routinely.

## 6. Logic 1 — Hepatic fibrosis

### First-line

Calculate FIB-4 from:
- age
- AST
- ALT
- platelet count

Internal interpretation:
- <1.3: low risk
- 1.3–2.67: intermediate risk
- >2.67: high risk
- for age >=66 years, use 2.0 as the lower threshold for the intermediate zone

Platelet count should also be shown as supportive context:
- >200,000/µL: lower-risk direction
- 150,000–200,000/µL: intermediate direction
- <150,000/µL: higher-risk direction

### Second-line NIT

Show NIT inputs only when second-line fibrosis assessment is clinically meaningful.

Supported optional inputs:
- VCTE / FibroScan LSM
- SWE
- MRE
- ELF
- type IV collagen 7S
- M2BPGi

Interpret only tests that are entered.

Output must describe fibrosis as:
- `suggestive of >=F2`
- `within a reported range suggestive of >=F3`
- etc.

Do **not** output a definitive histologic fibrosis stage from NIT alone.

Do **not** output Wegovy / semaglutide eligibility.

Treatment decisions remain with the clinician.

## 7. Logic 2 — Blood pressure

Evidence lock: see `docs/bp-evidence-lock-v0.1.md`.

### Office-BP classification

Use the higher SBP / DBP category.

- normal: SBP <120 and DBP <80
- elevated-normal: SBP 120–129 and DBP <80
- high-normal / elevated BP: SBP 130–139 and/or DBP 80–89
- grade I hypertension: SBP 140–159 and/or DBP 90–99
- grade II hypertension: SBP 160–179 and/or DBP 100–109
- grade III hypertension: SBP >=180 and/or DBP >=110

Diagnostic thresholds remain:
- office hypertension: >=140/90 mmHg
- home hypertension: >=135/85 mmHg

A single office measurement is a classification input, not by itself proof of persistent hypertension.

### Persistence / out-of-office confirmation

For untreated office BP >=130/80, use a minimal confirmation state when current persistence is not already established:

- elevated at another health check / office visit
- elevated at home
- not yet confirmed

If not confirmed:
- recommend home BP or another-day office measurement
- keep the result as `needs confirmation` where persistence can change management

Do not make a persistence question block urgent clinical assessment for markedly elevated BP or symptomatic patients.

For patients already receiving antihypertensive treatment, do not ask whether hypertension is persistent; interpret the current BP in treatment context.

### JSH2025 cardiovascular-risk strata

Internal layer-2 risk factors:
- age >=65
- male sex
- dyslipidemia
- current smoking

Internal layer-3 / high-risk triggers:
- prior cerebrovascular / cardiovascular disease
- atrial fibrillation
- diabetes
- CKD with proteinuria
- three or more layer-2 risk factors

Risk matrix:

| Office-BP category | no layer-2/3 factor | layer-2 factor(s), fewer than 3 | layer-3 trigger / >=3 layer-2 factors |
| --- | --- | --- | --- |
| high-normal / elevated BP | low | moderate | high |
| grade I hypertension | low | moderate | high |
| grade II hypertension | moderate | high | high |
| grade III hypertension | high | high | high |

Do not expose `risk layer 1/2/3` terminology in the routine user-facing UI. Explain the concrete reason for elevated risk instead.

### Treatment / reassessment timing

Lock the following operational wording for C2/C3:

- high-normal / elevated BP + low/moderate risk:
  - lifestyle modification
  - planned reassessment
  - no automatic immediate-drug message

- high-normal / elevated BP + high risk:
  - lifestyle modification
  - short-interval reassessment, approximately 1 month
  - if BP remains above target, pharmacologic treatment may be considered

- grade I hypertension + low/moderate risk:
  - lifestyle modification
  - reassess within approximately 1 month
  - if still above target, begin / consider pharmacologic treatment

- grade I hypertension + high risk:
  - lifestyle modification plus prompt pharmacologic treatment

- grade II / III hypertension:
  - lifestyle modification plus prompt pharmacologic treatment regardless of lower risk strata
  - prompt confirmation / clinical assessment still matters, but do not present this as a prolonged watch-and-wait branch

Do not convert these into autonomous prescribing instructions. The tool should describe timing and treatment consideration.

### BP targets

Default treatment targets:
- office BP <130/80 mmHg
- home BP <125/75 mmHg

These targets apply broadly in JSH2025, including older adults, but treatment should be individualized when symptoms, orthostatic hypotension, AKI, hyperkalemia, frailty, or other intolerance limits further reduction.

For CKD:
- the 2026 Japanese Society of Nephrology statement aligns with an overall target of office <130/80 and home <125/75
- in non-diabetic proteinuria-negative CKD, a cautious intermediate target of office <140/90 / home <135/85 may be used while titrating according to tolerance

### Shared CKD input contract

CKD is a cross-domain input in this application, not a BP-only field.

Shared baseline inputs:
- eGFR: numeric current renal-function value
- CKD diagnosed / established: yes / no

Do not infer established CKD from one isolated eGFR value alone.

CKD diagnosis requires chronicity: kidney damage and/or GFR <60 mL/min/1.73m² persisting for more than 3 months. eGFR >=60 does not exclude CKD when persistent kidney-damage markers are present.

Why this is shared:
- BP: proteinuric CKD can alter JSH cardiovascular-risk stratification
- lipids: CKD is a high-risk condition and will bypass the modified-Hisayama branch in Phase D
- uric acid: CKD / renal impairment is a relevant complication in the UA 8.0–8.9 mg/dL treatment-consideration branch

Do not make proteinuria a routine baseline input. Keep it conditional within the BP workflow when it can change the current JSH risk/timing branch.

### Proteinuria — when it is decision-relevant

Proteinuria is **not** needed merely to choose the default BP target.

For this BP engine, ask proteinuria only when all of the following are true:
- CKD is known / otherwise established
- high-risk status has not already been established by CVD, AF, diabetes, or >=3 layer-2 factors
- the current BP category is one in which high-risk status changes treatment timing, especially high-normal / elevated BP or grade I hypertension

Proteinuria-positive CKD is a JSH2025 high-risk trigger.

Operational positive threshold:
- spot urine protein / creatinine ratio >=0.15 g/gCr

If grade II / III hypertension already places the patient in a prompt-treatment branch, do not ask proteinuria solely to decide treatment timing.

Proteinuria can still matter for drug selection / renal management, but drug-class selection is outside the Phase C scope.

### C2 implementation contract

C2 should implement pure rules for:
- office-BP category using the higher SBP / DBP category
- internal risk level
- high-risk trigger reason(s)
- whether persistence confirmation is needed
- whether proteinuria is decision-relevant
- treatment-timing class:
  - lifestyle / planned reassessment
  - short-interval reassessment
  - prompt pharmacologic-treatment consideration
- office/home target context

## 8. Logic 3 — Lipids

Decision order:

1. secondary prevention?
2. if primary prevention: diabetes / CKD / PAD?
3. otherwise: modified Hisayama risk score when applicable

### Modified Hisayama

Use only when:
- age 40–79
- not secondary prevention
- no diabetes
- no CKD
- no PAD

Inputs are derived from existing data:
- sex
- age
- SBP
- glucose abnormality
- LDL-C
- HDL-C
- current smoking

For this private tool, define non-diabetic glucose abnormality pragmatically as:
- HbA1c 5.7–6.4%, or
- FPG 100–125 mg/dL

Diagnosed diabetes bypasses the score and enters the diabetes / high-risk branch.

### LDL-C targets

Primary prevention:
- low risk: <160 mg/dL
- intermediate risk: <140 mg/dL
- high risk: <120 mg/dL

Diabetes:
- generally <120 mg/dL
- consider <100 mg/dL when PAD, diabetic microvascular disease, or current smoking is present

Secondary prevention:
- generally <100 mg/dL
- stricter targets may apply in higher-risk secondary-prevention settings

Do not force all secondary-prevention subtyping during initial entry. Ask only if a stricter target would change the displayed conclusion.

### Triglycerides

Do not ask fasting status routinely.

If TG is in a range where fasting vs nonfasting status changes classification, then ask fasting status conditionally.

## 9. Logic 4 — Glycemia

### Diagnosed diabetes

Use HbA1c for current control assessment.

Default general control reference:
- HbA1c <7.0%

Do not label values above this as absolute treatment failure; individual targets may differ.

Display:
- within general target
- above general target -> consider treatment initiation / intensification as clinically appropriate

### No known diabetes

Official Japanese 2026 MASLD glucose CMRF criteria include any of:
- fasting plasma glucose >=100 mg/dL
- 2-hour glucose >=140 mg/dL
- HbA1c >=5.7%
- type 2 diabetes or its treatment

Operational tool scope:
- collect HbA1c and fasting glucose as routine available inputs
- intentionally omit 2-hour OGTT input from this tool because it is not part of the intended workflow
- random glucose is **not** a MASLD CMRF criterion; use it only for diabetes diagnostic-range confirmation when relevant

Diabetic-type thresholds used for the no-known-diabetes branch:
- fasting glucose >=126 mg/dL
- random glucose >=200 mg/dL
- HbA1c >=6.5%

If HbA1c and a diabetic-type blood-glucose value are both present on the same assessment, indicate that the Japan Diabetes Society diagnostic criteria are met, while retaining final clinical judgment because the tool does not store dates/symptoms.

If HbA1c alone is diabetic-type, suggest blood-glucose confirmation.

If fasting glucose alone is diabetic-type while HbA1c is below the diabetic-type threshold or unavailable:
- show one conditional checkbox: `separate-day diabetic-type confirmed`
- do not request the date or repeat value
- if unchecked, display that one diabetic-type blood-glucose value requires confirmation
- if checked, indicate that the diagnostic criteria are met because diabetic-type findings have been confirmed on separate days

This checkbox is only shown in that fasting-glucose-alone branch.

## 10. Logic 5 — Uric acid

Evidence lock: see `docs/uric-acid-evidence-lock-v0.1.md`.

### Definition

- serum uric acid >7.0 mg/dL -> hyperuricemia
- 7.0 mg/dL exactly is not classified as hyperuricemia by this threshold

If UA <=7.0 mg/dL and the patient is not taking urate-lowering medication, do not ask gout or urinary-stone questions.

If UA >7.0 mg/dL, ask separately:
- gout present? (gout attack / gouty arthritis or tophus)
- urinary-stone history / current urinary stone?

If urate-lowering medication is already being taken, keep the urate-treatment context visible even when the current UA is <=7.0 mg/dL.

### Gout present

Treat gout / gouty tophus as a symptomatic urate-deposition branch.

Display:
- gout-associated hyperuricemia / gout context
- urate-lowering pharmacotherapy is a guideline-supported treatment branch
- reference serum-UA target: <=6.0 mg/dL

The tool still does not choose a specific drug.

### No gout — asymptomatic hyperuricemia

Use existing information to identify guideline-listed relevant complications:
- CKD / renal impairment
- urinary stones
- hypertension
- ischemic heart disease
- diabetes
- metabolic syndrome

Do **not** replace `metabolic syndrome` with generic cardiometabolic-risk clustering unless formal criteria are implemented.

Japanese guideline consideration thresholds:
- relevant complication present and UA >=8.0 mg/dL -> consider urate-lowering pharmacotherapy
- no relevant complication and UA >=9.0 mg/dL -> consider urate-lowering pharmacotherapy
- below the applicable threshold -> lifestyle intervention / management of associated disease is the default

These 8 / 9 mg/dL values are **consideration thresholds, not automatic treatment indications**.

If pharmacologic urate lowering is used, <=6.0 mg/dL is the guideline reference target.

### Evidence-strength caveats

Do not imply that all listed complications have equivalent evidence for event prevention by urate lowering.

- renal impairment / CKD: Japanese guideline conditionally recommends urate-lowering therapy for the purpose of suppressing renal-function decline
- hypertension: urate-lowering therapy is not actively recommended solely to improve life prognosis or reduce cardiovascular-disease risk
- heart failure: urate-lowering therapy is not actively recommended solely to improve life prognosis
- the 8 mg/dL branch therefore remains a treatment-consideration branch, with the reason for consideration made explicit where practical

Urinary-stone history remains separate because it can affect downstream drug selection / stone-management considerations. This tool may flag that context but does not select a urate-lowering drug class.

## 11. Missing-data engine

Only two types of suggestions are allowed.

### A. Required to complete the current decision

Examples:
- proteinuria status is needed to complete BP-risk classification in a CKD branch
- glucose confirmation is needed because HbA1c is in the diabetic range
- CKD status is needed because it could change lipid-risk classification

### B. Next clinically meaningful evaluation

Examples:
- intermediate FIB-4 -> consider elastography / second-line NIT
- untreated elevated BP without persistence confirmation -> obtain home or repeat office BP

Do not show irrelevant `missing` warnings.

Examples:
- UA 6.2 -> do not ask gout / stone history
- low-risk FIB-4 -> do not flag missing SWE / MRE / M2BPGi

## 12. Result view

The result view should prioritize conclusions, not raw inputs.

Cards:
1. SLD classification
2. hepatic fibrosis
3. blood pressure
4. lipids
5. glycemia
6. uric acid

Each card may show:
- current classification
- target / threshold if relevant
- action consideration
- missing decision-relevant data

At the bottom:

## Additional information to confirm

If none:
`The major information needed for the current assessment is available.`

## 13. Explicit non-goals

Do not implement:
- patient names or IDs
- data persistence
- longitudinal charts
- date management
- routine waist circumference
- detailed diet questionnaire
- detailed exercise questionnaire
- sleep questionnaire
- routine urine-protein input for every patient
- exhaustive past-history intake
- drug-selection recommendations
- Wegovy eligibility
- definitive histologic fibrosis staging from NIT alone
- final autonomous treatment decisions

## 14. Authority

Current authoritative Japanese guidelines and regulatory documents outrank this specification if recommendations change.

The application should make clinical reasoning easier to apply, not replace clinician judgment.
