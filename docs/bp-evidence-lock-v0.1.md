# C1 — JSH2025 blood-pressure evidence lock v0.1

Date: 2026-09-29
Status: evidence lock for C2 / C3 implementation

## Purpose

Lock the BP classification, risk stratification, confirmation behavior, treatment timing, targets, and proteinuria handling for the MASLD clinical-support tool.

This document does **not** implement the BP engine and does not select an antihypertensive drug.

## Current authorities checked

Primary / official:
- Japanese Society of Hypertension — Guidelines for the management of elevated blood pressure and hypertension 2025  
  https://www.jpnsh.jp/guideline.html
- Full English JSH2025 guideline publication in Hypertension Research  
  https://doi.org/10.1038/s41440-025-02462-y
- JSH2025 key-highlights editorial by guideline committee members  
  https://doi.org/10.1038/s41440-025-02331-8
- Japanese Society of Nephrology 2026 statement on BP management in CKD  
  https://jsn.or.jp/medic/newstopics/formember/ckd.php

Supporting guideline-derived summaries were checked for the exact risk matrix / timing language where the public JSH web surface does not expose the Japanese tables as searchable text.

## Locked office-BP classification

Use the higher SBP / DBP category.

- normal: <120 and <80
- elevated-normal: 120–129 and <80
- high-normal / elevated BP: 130–139 and/or 80–89
- grade I hypertension: 140–159 and/or 90–99
- grade II hypertension: 160–179 and/or 100–109
- grade III hypertension: >=180 and/or >=110

Diagnostic thresholds remain:
- office >=140/90 mmHg
- home >=135/85 mmHg

## Persistence / confirmation

A single office value can classify the observed BP but does not by itself prove persistent hypertension.

Operational confirmation options:
- elevated at another health check / office visit
- elevated at home
- not yet confirmed

When not confirmed:
- suggest home BP or repeat office BP
- preserve a needs-confirmation state when persistence materially changes the management branch

Do not use this rule to delay urgent assessment for markedly elevated or symptomatic BP.

Already-treated patients do not need a persistence question.

## JSH2025 risk stratification

### Layer-2 factors

- age >=65
- male sex
- dyslipidemia
- current smoking

### Operational dyslipidemia definition

JSH2025 Table 6-1 identifies dyslipidemia using:
- LDL-C >=140 mg/dL
- HDL-C <40 mg/dL
- TG >=150 mg/dL, with fasting / postprandial handling noted in the table footnote

For this application, align the TG handling with the current Japanese Atherosclerosis Society diagnostic thresholds:
- fasting TG >=150 mg/dL
- nonfasting TG >=175 mg/dL

Operational rule for C2:
- active lipid-lowering treatment counts as dyslipidemia present so treated values do not erase the known condition
- otherwise any positive LDL-C / HDL-C / TG threshold counts as dyslipidemia present
- LDL-C is a shared baseline lab because it is also required by the future lipid engine
- fasting status is not a routine baseline field
- if TG 150–174 mg/dL is the only possible dyslipidemia criterion and fasting status is unknown, return dyslipidemia as unresolved only when that uncertainty can change the JSH risk tier

Do not make C2 wait for the complete Phase D lipid engine merely to establish the JSH layer-2 factor.

### High-risk / layer-3 triggers

Any of:
- prior cerebrovascular / cardiovascular disease
- atrial fibrillation
- diabetes
- CKD with proteinuria
- >=3 layer-2 factors

### Matrix

| BP category | no factor | layer-2 factor(s), <3 | high-risk trigger / >=3 layer-2 |
| --- | --- | --- | --- |
| elevated BP 130–139 / 80–89 | low | moderate | high |
| grade I 140–159 / 90–99 | low | moderate | high |
| grade II 160–179 / 100–109 | moderate | high | high |
| grade III >=180 / >=110 | high | high | high |

User-facing output should name the actual reason, e.g. `糖尿病を伴うため高リスク`, rather than expose JSH layer numbers.

## Treatment / reassessment timing lock

### Elevated BP 130–139 / 80–89

Low / moderate risk:
- lifestyle modification
- planned reassessment
- no automatic immediate-drug message

High risk:
- lifestyle modification
- reassess on a short interval, approximately 1 month
- if still above target, pharmacologic treatment may be considered

### Grade I hypertension

Low / moderate risk:
- lifestyle modification
- reassess within approximately 1 month
- if still above target, pharmacologic treatment should be started / considered

High risk:
- lifestyle modification and prompt pharmacologic treatment

### Grade II / III hypertension

- lifestyle modification and prompt pharmacologic treatment
- do not create a prolonged lifestyle-only waiting branch

These are clinician-support outputs, not autonomous prescribing commands.

## Treatment targets

JSH2025 default:
- office <130/80 mmHg
- home <125/75 mmHg

The target is broadly unified across age groups, while watching for:
- symptomatic hypotension
- orthostatic hypotension
- AKI
- hyperkalemia / electrolyte abnormality
- frailty / functional status
- other intolerance

## CKD update checked in 2026

The Japanese Society of Nephrology 2026 statement aligns CKD management with:
- office <130/80
- home <125/75

regardless of diabetes or proteinuria category as the **principle**.

For non-diabetic, proteinuria-negative CKD:
- cautious titration is emphasized
- office <140/90 / home <135/85 may be used as an intermediate target when appropriate

Therefore proteinuria is not required merely to choose the final default BP target.

## Shared CKD input placement

CKD is not owned by the BP engine alone.

Use two shared baseline fields in the application:
- current eGFR as a numeric value
- CKD diagnosed / established as a yes/no flag

Rationale:
- CKD diagnosis is not equivalent to one eGFR measurement. Current Japanese CKD guidance defines CKD by kidney damage and/or GFR <60 mL/min/1.73m² persisting for more than 3 months.
- CKD can exist with eGFR >=60 when persistent kidney-damage markers are present.
- The same CKD state is needed later by the lipid engine and is also relevant to the uric-acid complication branch.

Therefore:
- do not automatically switch `CKD diagnosed` on from one eGFR <60 result;
- do not hide CKD entirely inside the hypertension section;
- do not require proteinuria as a universal baseline field.

Proteinuria remains a conditional BP risk modifier.

## Proteinuria: decision-relevant use in this app

In JSH2025 risk stratification, **proteinuric CKD** is a high-risk trigger.

For C2/C3, ask proteinuria only when:
1. CKD is already known / established;
2. no other high-risk trigger already settles risk;
3. the current BP category is one where high-risk classification changes the treatment-timing output.

Most useful cases:
- elevated BP
- grade I hypertension

Do not ask it solely for grade II / III treatment timing, because the prompt-treatment branch is already determined.

Operational positive threshold:
- spot urine protein / creatinine ratio >=0.15 g/gCr

Drug-selection consequences of proteinuria are outside Phase C.

## Persistence question and treatment timing are separate concepts

The tool should not confuse:
- `this one measurement is high`
with
- `persistent hypertension is established`.

For example:
- one office BP of 146/92 -> grade I observed BP
- if persistence is not established -> confirmation still needed
- risk / severity may still justify a short interval or prompt clinical review

For markedly elevated BP, do not let the confirmation prompt imply that the clinician should simply wait.

## C2 deterministic-rule contract

C2 may implement:
- BP category
- risk level / high-risk reasons
- persistence-needed state
- proteinuria-needed state
- treatment-timing class
- target context

C2 should **not**:
- choose an antihypertensive drug
- infer proteinuria from CKD alone
- infer diagnosed hypertension from one isolated office value
- expose JSH risk-layer numbering in the normal result UI
- create a routine proteinuria question for every patient

## C1 conclusion

C1 confirms the existing office-BP thresholds, but tightens three parts of the prior draft:

1. treatment timing is explicitly risk- and BP-grade-dependent;
2. a single high office BP remains a persistence-confirmation problem distinct from severity/risk;
3. proteinuria is conditional for JSH high-risk classification, not a routine input and not required simply to set the default 130/80 target.
