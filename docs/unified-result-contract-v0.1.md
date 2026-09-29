# Unified result contract v0.1

Status: E1 implementation contract.

This document defines the normalized result model used to combine the six clinical domains without changing their underlying clinical rules.

## 1. Scope

E1 is a pure model layer.

It does:
- map SLD, fibrosis, blood pressure, lipids, glycemia, and uric acid into one result shape;
- separate current facts, derived interpretation, and next action;
- classify decision-relevant missing information into exactly two classes;
- deduplicate the same underlying missing information across domains;
- expose an explicit completion state.

E1 does not:
- redesign the UI;
- replace or rewrite the six domain engines;
- introduce new guideline thresholds;
- add drug-selection logic;
- persist patient data.

The six-card UI and the visual `Additional information to confirm` section remain E2 work.

## 2. Domain contract

Every domain maps to:

```js
{
  key,
  label,
  facts: [{ key, label, value }],
  interpretation: {
    id,
    title,
    detail,
    tone
  },
  nextAction: null | {
    title,
    detail,
    tone
  },
  requiredMissingKeys: [],
  nextEvaluationKeys: [],
  currentDecisionComplete,
  hasNextEvaluation,
  missing: []
}
```

The semantic separation is deliberate:

- `facts`: measured or directly derived numeric/context facts;
- `interpretation`: the clinical classification or current assessment;
- `nextAction`: an action consideration already supported by the owning domain logic;
- missing data: information still needed or a meaningful next evaluation.

## 3. Missing-data classes

Only two classes are permitted.

### A. `required`

Required to complete the current decision.

Examples:
- glucose confirmation for diabetic-range data;
- PAD when it changes the diabetes LDL-C target;
- BP risk background only when it changes the current action branch;
- waist circumference only when it can still change SLD classification.

### B. `next_evaluation`

The current decision is possible, but another evaluation is clinically meaningful.

Examples:
- home / repeat office BP when persistence is not yet confirmed;
- second-line fibrosis NIT after an intermediate/high FIB-4 or platelet signal;
- gout history at UA >=9 mg/dL, where treatment consideration is already established but the clinical context/target can still change;
- urinary-stone history after the urate treatment branch is already established, because downstream stone-management context remains clinically meaningful.

## 4. Deduplication

Suggestions are deduplicated by a stable clinical key.

When the same key is emitted by multiple domains:
- keep one global suggestion;
- retain all contributing domains and reasons;
- if any domain requires it for the current decision, global class is promoted to `required`.

Example:
- diabetic-range glycemia may cause both the glycemia and lipid engines to require `diabetes_confirmation`;
- the global result shows one suggestion with both domains attached.

## 5. Completion states

`required_missing`
- one or more class-A items remain;
- current decision set is incomplete.

`next_evaluation_pending`
- no class-A items remain;
- one or more class-B items remain;
- current major decisions are available.

`complete`
- no class-A or class-B item remains;
- displayable message: `現在の主要判定に必要な情報は揃っています。`

## 6. Preservation rules

- Existing domain engines remain authoritative for their own clinical rules.
- E1 may normalize or deduplicate outputs but must not silently invent a new threshold or treatment indication.
- A missing item should not appear merely because it is generally useful.
- If the answer cannot change current classification, further evaluation, or treatment consideration, it should remain absent.
- BP persistence is a next evaluation, not a generic required demographic input.
- Lipid TG 150–174 mg/dL does not create a lipid-specific fasting-status question.
- Low-risk fibrosis does not create missing second-line NIT items.
- UA <=7 mg/dL does not create gout or urinary-stone missing items.
