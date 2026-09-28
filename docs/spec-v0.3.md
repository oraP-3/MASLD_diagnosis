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
- LDL-C
- HDL-C
- triglycerides
- eGFR
- uric acid

Conditional helpers:
- height + weight -> BMI
- creatinine -> eGFR
- glucose input only when diabetes confirmation requires it

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

Internal office-BP classification:
- <120 and <80: normal
- 120–129 and <80: elevated-normal
- 130–139 or 80–89: high-normal
- 140–159 or 90–99: grade I hypertension
- 160–179 or 100–109: grade II hypertension
- >=180 or >=110: grade III hypertension

Use the higher SBP/DBP category.

Risk classification may internally use:
- cerebrovascular / cardiovascular disease
- atrial fibrillation
- diabetes
- CKD with proteinuria
- age >=65
- male sex
- dyslipidemia
- current smoking

Do not display JSH Category I / II / III unless needed for transparency. Prefer a clinically readable explanation.

For untreated BP >=130/80, ask only if needed:

`Has elevated blood pressure been confirmed outside this single measurement?`

Options:
- elevated at health check / another office visit
- elevated at home
- not yet confirmed

If not confirmed, suggest:
- home BP or another-day office BP

Output should explain:
- current BP category
- whether high-risk background is present
- whether treatment consideration is immediate vs short-interval reassessment
- any decision-relevant missing information

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

HbA1c:
- <5.7%: no MASLD glucose CMRF from HbA1c
- 5.7–6.4%: glucose abnormality / MASLD CMRF
- >=6.5%: diabetic range

Only if HbA1c is in the diabetic range, expand glucose confirmation input:
- fasting glucose
- random glucose
- 75-g OGTT 2-hour glucose

If HbA1c and glucose are both diagnostic on the same assessment, indicate that diagnostic criteria are met.

If HbA1c alone is diagnostic, suggest blood-glucose confirmation.

## 10. Logic 5 — Uric acid

UA >7.0 mg/dL -> hyperuricemia.

If UA <=7 and the patient is not taking urate-lowering medication, do not ask gout or urinary-stone questions.

If UA >7, ask separately:
- gout present? (attack or tophus)
- urinary stone history?

### Gout present

Display:
- gout-associated hyperuricemia
- urate-lowering therapy should be considered clinically

### No gout

Use existing information to identify relevant complications:
- CKD / renal impairment
- urinary stones
- hypertension
- ischemic heart disease
- diabetes
- metabolic risk clustering

Pragmatic private-tool thresholds:
- complications present and UA >=8 mg/dL -> consider pharmacologic therapy
- no complications and UA >=9 mg/dL -> consider pharmacologic therapy
- below these thresholds -> lifestyle intervention as the default

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
