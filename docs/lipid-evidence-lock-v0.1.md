# D1 — JAS lipid evidence / score lock v0.1

Date: 2026-09-29
Status: evidence lock for D2 / D3 implementation

## Purpose

Lock the current Japanese Atherosclerosis Society (JAS) routing, modified-Hisayama score, risk classes, LDL-C targets, and triglyceride handling before lipid-engine implementation.

This document does **not** implement the lipid engine and does not select a lipid-lowering drug.

## Current authorities checked

Primary / official:

- Japanese Atherosclerosis Society — Guidelines for Prevention of Atherosclerotic Cardiovascular Diseases 2022, current guideline publication page
  - https://www.j-athero.org/jp/jas_gl2022/
- JAS 2022 guideline, Chapter 3 / Figure 3-1, Figure 3-2, Table 3-2, Table 3-3
  - https://www.j-athero.org/jp/wp-content/uploads/publications/pdf/GL2022_s/jas_gl2022_3_230210.pdf
- JAS current dyslipidemia Q&A
  - https://www.j-athero.org/jp/publications/si_qanda/
- Comprehensive risk-management chart 2025, published through JAS / Japan Medical Association federation project
  - https://www.j-athero.org/chart2025/houkatsu_chart2025.pdf
- JAS Adult Familial Hypercholesterolemia Focus Update 2025
  - https://www.j-athero.org/jp/wp-content/uploads/publications/pdf/JAS_FH_GL2025.pdf

The 2025 comprehensive chart reproduces the modified-Hisayama point structure and primary-prevention LDL-C targets from the 2022 prevention guideline. As of this lock, the 2022 prevention guideline remains the current JAS prevention guideline.

## Routing order

### 1. Known familial hypercholesterolemia / familial type III hyperlipidemia

The general management-goal flowchart is not used for known FH or familial type III hyperlipidemia.

For known FH:
- primary prevention LDL-C target: <100 mg/dL
- secondary prevention LDL-C target: <70 mg/dL

The current app does not diagnose FH de novo.

For a primary-prevention patient with LDL-C >=180 mg/dL:
- JAS states pharmacologic treatment may be considered regardless of ordinary risk category
- FH should be considered
- do not silently treat LDL-C >=180 as an ordinary low-risk score result without an FH warning / guard

### 2. Secondary prevention

Do not use the modified-Hisayama score when there is:
- coronary artery disease, or
- atherothrombotic cerebral infarction, including another cerebral infarction with clear atheroma as defined by JAS

Operational note:
- do **not** reuse the broad BP `cvdHistory` flag for this purpose
- the lipid engine needs a lipid-specific secondary-prevention state because JAS defines the qualifying diseases narrowly

Base secondary-prevention LDL-C target:
- <100 mg/dL

Use the stricter LDL-C target <70 mg/dL when secondary prevention is accompanied by any of:
- acute coronary syndrome
- familial hypercholesterolemia
- diabetes
- both coronary artery disease and atherothrombotic cerebral infarction / qualifying atheromatous cerebral infarction

### 3. Primary-prevention high-risk bypass

If no secondary-prevention disease is present, the following bypass the modified-Hisayama score and enter the JAS high-risk group:
- diabetes
- established CKD
- PAD

Base LDL-C target:
- <120 mg/dL

For diabetes, consider the stricter LDL-C target <100 mg/dL when any of:
- PAD
- diabetic microvascular disease: retinopathy, nephropathy, or neuropathy
- current smoking

Do not infer diabetic nephropathy from a generic `CKD diagnosed` flag.

JAS Q&A also contains broader wording that diabetes + CKD may justify <100 mg/dL, but the formal 2022 Table 3-2 and the 2025 comprehensive chart specify PAD / diabetic microvascular disease / current smoking. For deterministic app logic, use the formal-table conditions. A generic CKD flag alone does not tighten diabetes from <120 to <100.

### 4. Modified-Hisayama eligibility

Use the modified-Hisayama score only when all are true:
- age 40–79
- no qualifying secondary-prevention disease
- no diabetes
- no established CKD
- no PAD
- no known FH / familial type III hyperlipidemia branch

Age <40:
- do not assign a JAS absolute-risk category by the modified-Hisayama score
- lifestyle / lifetime-risk context may still be discussed
- LDL-C >=180 should trigger FH consideration

Age >=80:
- do not assign a modified-Hisayama risk category
- primary-prevention lipid management should be individualized rather than mechanically tied to the 40–79 score table
- secondary-prevention / established high-risk diseases remain clinically relevant, but user-facing target wording should acknowledge individualization in advanced age / frailty where relevant

## Modified-Hisayama point system

### Sex
- female: 0
- male: 7

### Systolic blood pressure
- <120 mmHg: 0
- 120–129: 1
- 130–139: 2
- 140–159: 3
- >=160: 4

Use SBP only; DBP is not a Hisayama score item.

Antihypertensive treatment is not a point item in the JAS modified score. The guideline notes that absolute risk can be underestimated in treated patients at the same observed BP, but does not provide a point correction. Do not invent one.

### Glucose abnormality, excluding diabetes
- absent: 0
- present: 1

JAS uses non-diabetic glucose abnormality / impaired glucose tolerance as the score item.

Private-tool operational proxy already owner-approved:
- only when diabetes is not established
- HbA1c 5.7–6.4%, or
- fasting glucose 100–125 mg/dL
-> 1 point

This is an app-specific operational proxy for the JAS non-diabetic glucose-abnormality item, not a claim that these exact cutoffs are the JAS definition of impaired glucose tolerance.

Integration with the glycemia engine:
- `diagnosedDiabetes == true` -> diabetes bypass; do not score
- if the glycemia engine has enough information to state that diabetes diagnostic criteria are met -> route as diabetes / high risk for lipid management
- if diabetic-range testing remains diagnostically unresolved -> lipid routing remains unresolved; do not downgrade it to a 1-point glucose-abnormality state
- only clearly non-diabetic abnormal-range values use the 1-point proxy

### LDL-C
- <120 mg/dL: 0
- 120–139: 1
- 140–159: 2
- >=160: 3

### HDL-C
- >=60 mg/dL: 0
- 40–59: 1
- <40: 2

### Smoking
- current smoking: 2
- no current smoking: 0
- former smoking is scored as no current smoking

The app already stores current smoking as a shared baseline input.

### Total score
Maximum score: 19.

The score does not include:
- age points; age is applied through the age-specific risk table
- DBP
- exercise
- proteinuria
- diabetes
- CKD
- antihypertensive-medication points

## Risk-class mapping

JAS absolute-risk classes:
- low: predicted 10-year ASCVD risk <2%
- intermediate: >=2% and <10%
- high: >=10%

Operational score thresholds by age:

| Age | Low | Intermediate | High |
| --- | --- | --- | --- |
| 40–49 | 0–12 | 13–19 | not reached by this point range |
| 50–59 | 0–7 | 8–18 | 19 |
| 60–69 | 0–1 | 2–12 | 13–19 |
| 70–79 | none | 0–7 | 8–19 |

D2 only needs the deterministic score and risk class unless the UI later chooses to display the exact percentage.

## LDL-C management targets

### Primary prevention by JAS risk class
- low: <160 mg/dL
- intermediate: <140 mg/dL
- high: <120 mg/dL

For low/intermediate primary prevention, JAS also allows an LDL-C reduction of about 20–30% as an alternative management goal when appropriate. The app's primary output should remain the absolute LDL-C target unless a later owner decision adds percentage-reduction output.

### Diabetes primary prevention
- default: <120 mg/dL
- consider <100 mg/dL if PAD, diabetic microvascular disease, or current smoking is present

### CKD primary prevention
- <120 mg/dL

### PAD primary prevention
- <120 mg/dL
- if diabetes is also present, PAD is a diabetes-specific reason to consider <100 mg/dL

### Secondary prevention
- base: <100 mg/dL
- stricter <70 mg/dL when ACS, FH, diabetes, or combined CAD + qualifying atherothrombotic cerebral infarction is present

### LDL-C >=180 mg/dL in primary prevention
Regardless of ordinary primary-prevention risk category:
- pharmacologic therapy may be considered
- consider FH
- this is an action override / warning, not by itself a new risk-category target

## Triglycerides and fasting state

JAS targets:
- fasting TG: <150 mg/dL
- casual / nonfasting TG: <175 mg/dL
- HDL-C: >=40 mg/dL

JAS defines fasting as >=10 hours without caloric intake; if fasting status cannot be confirmed, treat the sample as casual / `随時`.

Therefore, the lipid engine should **not** ask a routine or conditional fasting-status question merely because TG is 150–174 mg/dL.

Operational rule:
- if the clinician explicitly knows the sample was fasting -> use 150 mg/dL
- otherwise -> use the casual threshold 175 mg/dL

This differs from the Phase-C BP dyslipidemia-factor logic, where fasting status can be decision-relevant to the JSH BP risk factor. Do not merge those two contexts.

## Input reuse / new lipid-specific states

Reusable existing inputs:
- age
- sex
- SBP
- HbA1c / fasting glucose via the glycemia engine
- LDL-C
- HDL-C
- TG
- current smoking
- established CKD
- diagnosed diabetes

Lipid-specific states needed later:
- qualifying secondary prevention: CAD and/or atherothrombotic cerebral infarction / qualifying atheromatous cerebral infarction
- PAD
- known FH when relevant
- ACS when secondary prevention and <70 target may apply
- diabetic microvascular disease only when diabetes is present and the answer can tighten the target from <120 to <100

Do not ask all of these routinely. D3 should keep them conditional where the answer can change routing or target.

## D2 deterministic-rule contract

D2 should implement pure routing / scoring for:
- general-flow bypass reason
- score eligibility
- modified-Hisayama points and total
- age-specific JAS risk class
- explicit out-of-score-range state for <40 and >=80
- unresolved state when a score-required input or diabetes status is unresolved

D2 should **not**:
- render the final lipid UI
- choose a lipid-lowering drug
- diagnose FH
- diagnose CKD
- infer secondary prevention from broad BP `cvdHistory`
- ask TG fasting status solely for lipid classification

## D3 target / UI contract

D3 should add:
- LDL-C target based on D2 routing
- conditional diabetes microvascular-disease question only when it can tighten <120 to <100
- secondary-prevention subtype questions only when they can tighten <100 to <70
- LDL-C >=180 warning / FH consideration in primary prevention
- concise user-facing reason for the target

## D1 conclusion

The current spec is confirmed for:
- the general low / intermediate / high LDL-C targets
- the primary routing order: secondary prevention -> diabetes/CKD/PAD -> modified Hisayama
- the private-tool non-diabetic glucose-abnormality proxy

The current spec is tightened in four places:
1. exact modified-Hisayama point values and age-specific risk thresholds are locked;
2. broad BP CVD history cannot be reused as a lipid secondary-prevention flag;
3. lipid TG handling uses fasting <150 only when fasting is known; otherwise casual <175, without a TG 150–174 fasting-status prompt;
4. FH / LDL-C >=180 and the stricter secondary-prevention <70 branch are explicitly guarded so ordinary risk scoring does not overwrite them.
