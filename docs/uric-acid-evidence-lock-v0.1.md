# B2 — Uric-acid evidence lock v0.1

Date: 2026-09-28  
Status: evidence lock for B3 implementation

## Purpose

Lock the Japanese hyperuricemia / gout rules that B3 may implement.

This document does **not** implement the uric-acid engine and does not select a urate-lowering drug.

## Current Japanese authority checked

As of 2026-09-28, the Japanese Society of Gout and Uric & Nucleic Acids continues to list:

- `高尿酸血症・痛風の治療ガイドライン 第3版`
- `高尿酸血症・痛風の治療ガイドライン 第3版 [2022年追補版]`

Minds also labels the third edition as the latest guideline and links the 2022 supplement.

Primary / official sources:

- Japanese Society of Gout and Uric & Nucleic Acids guideline page  
  https://www.tukaku.jp/guideline/
- Minds guideline library — third edition, current/latest listing  
  https://minds.jcqhc.or.jp/summary/c00476/
- Third edition full text  
  https://minds.jcqhc.or.jp/common/summary/pdf/c00476-1.pdf
- 2022 supplementary edition  
  https://minds.jcqhc.or.jp/common/summary/pdf/c00476_supplementary.pdf

No newer Japanese society guideline superseding this third-edition + 2022-supplement framework was identified in the B2 check.

## Locked thresholds

### Hyperuricemia definition

- serum uric acid **>7.0 mg/dL**

Boundary:
- 7.0 mg/dL exactly is not `>7.0`

### Symptomatic gout / tophus

When gouty arthritis / gout attack or gouty tophus is present:

- this is a pharmacologic urate-lowering treatment branch in the Japanese algorithm
- reference treatment target: serum uric acid **<=6.0 mg/dL**

For this tool, gout attack and gouty tophus remain compressed into one `gout present` item because their downstream branch is the same.

### Asymptomatic hyperuricemia

The traditional Japanese 7 / 8 / 9 structure remains current:

- relevant complication present + UA **>=8.0 mg/dL** -> **consider** urate-lowering pharmacotherapy
- no relevant complication + UA **>=9.0 mg/dL** -> **consider** urate-lowering pharmacotherapy
- below the applicable consideration threshold -> lifestyle intervention / associated-disease management is the default

These are not automatic medication mandates.

If pharmacologic urate lowering is used, the Japanese guideline reference target is **<=6.0 mg/dL**.

## What counts as a relevant complication for the 8 mg/dL branch

The third-edition treatment algorithm explicitly lists examples including:

- renal impairment / CKD
- urinary stones
- hypertension
- ischemic heart disease
- diabetes
- metabolic syndrome

Implementation rule:

- reuse already-known structured data rather than re-asking the same history
- do not treat generic MASLD CMRF accumulation as equivalent to a formal diagnosis of metabolic syndrome
- do not silently broaden `metabolic syndrome` into `metabolic risk clustering`

## Evidence-strength caveat by complication

The 8 mg/dL algorithm is a **consideration** framework; it must not be presented as though urate lowering has equivalent outcome evidence for every listed comorbidity.

### Renal impairment / CKD

The third edition conditionally recommends urate-lowering therapy in hyperuricemic patients with renal impairment for the purpose of suppressing renal-function decline.

B3 may therefore explain CKD as a stronger reason for treatment consideration than a generic risk-marker association.

### Hypertension

The guideline does **not** actively recommend urate-lowering therapy solely for improving life prognosis or reducing cardiovascular-disease risk in patients with hyperuricemia and hypertension.

Therefore:

- hypertension may place an asymptomatic patient into the guideline's >=8 mg/dL consideration branch
- the UI must not state that lowering uric acid is proven to prevent cardiovascular events in that patient

### Heart failure

The guideline does not actively recommend urate-lowering therapy solely for improving life prognosis in hyperuricemic patients with heart failure.

Heart failure is not added as a new automatic 8 mg/dL trigger by this B2 lock.

### Ischemic heart disease / diabetes / metabolic syndrome

These remain listed in the Japanese treatment-algorithm examples of relevant complications, but B3 should use **consider treatment** wording rather than claim organ-event prevention from urate lowering.

## Urinary-stone handling

Urinary stones remain separate from gout.

Reason:

- urinary stones are included among relevant complications in the Japanese treatment algorithm
- the guideline also treats urinary-stone history / presence as relevant to urate-lowering drug selection and urinary uric-acid management

B3 may therefore ask:

- urinary-stone history / current urinary stone?

The tool must **not** choose a specific urate-lowering drug class; drug selection remains outside scope.

## Existing urate-lowering treatment

A current UA <=7.0 mg/dL does not erase the clinical context if the patient is already taking a urate-lowering drug.

B3 should therefore preserve an `urate-lowering treatment` flag and interpret the current value in treatment context rather than treating the patient as simply `no hyperuricemia`.

Where gout / active treatment context makes a target relevant, <=6.0 mg/dL may be displayed as the Japanese guideline reference target.

## B3 implementation contract

B3 may implement the following deterministic branches:

1. **UA <=7.0 and no urate-lowering treatment**
   - do not ask gout / stone history
   - no hyperuricemia classification

2. **UA >7.0**
   - hyperuricemia
   - ask gout and urinary-stone history separately

3. **Gout present**
   - symptomatic gout branch
   - pharmacologic urate lowering is guideline-supported
   - reference target <=6.0 mg/dL

4. **No gout, UA 7.1–7.9**
   - lifestyle / associated-disease management
   - do not promote drug treatment based on UA alone

5. **No gout, UA 8.0–8.9**
   - relevant complication status can change the conclusion
   - complication present -> pharmacologic therapy may be considered
   - complication status unresolved -> decision-relevant missing data
   - no relevant complication -> lifestyle / associated-disease management

6. **No gout, UA >=9.0**
   - pharmacologic therapy may be considered even without a listed complication

7. **Already taking urate-lowering medication**
   - preserve treatment context regardless of current UA
   - do not use current UA <=7.0 to hide the treated condition

## Non-goals for B3

B3 should not:

- choose allopurinol / febuxostat / topiroxostat / dotinurad or another specific drug
- derive a formal metabolic-syndrome diagnosis from generic CMRF count
- claim that urate lowering prevents cardiovascular events in all patients with hypertension / ischemic heart disease / diabetes
- turn >=8 or >=9 mg/dL into an automatic medication instruction
- implement gout-flare treatment
- implement colchicine prophylaxis
- implement urinary alkalinization or stone-specific pharmacotherapy

## B2 conclusion

The original private-tool 7 / 8 / 9 structure is **retained**, but its wording is tightened:

- `>7.0` = hyperuricemia
- `>=8.0 with relevant complication` = medication **consideration**
- `>=9.0 without complication` = medication **consideration**
- `<=6.0` = reference treatment target when urate lowering is being used in the relevant branch

The key correction is not the numeric thresholds; it is the interpretation:
**consideration threshold != automatic treatment indication**, and comorbidities do not all have equal evidence that urate lowering improves their clinical outcomes.
