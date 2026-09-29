import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUnifiedClinicalResult, MISSING_DATA_CLASS, UNIFIED_RESULT_VERSION } from '../unified-results.js';

const completeBase = {
  age: 45,
  sex: 'female',
  bmi: 24,
  waist: '',
  sbp: 110,
  dbp: 70,
  hba1c: 5.4,
  fastingGlucose: 90,
  randomGlucose: '',
  separateDayDiabeticTypeConfirmed: false,
  ldl: 100,
  tg: 100,
  hdl: 60,
  antihypertensiveTreatment: false,
  diagnosedDiabetes: false,
  diagnosedCkd: false,
  lipidTreatment: false,
  currentSmoking: false,
  cvdHistory: false,
  atrialFibrillation: false,
  proteinuriaPresent: null,
  tgFastingStatus: '',
  bpPersistence: '',
  knownFh: false,
  familialTypeIII: false,
  qualifyingSecondaryPrevention: false,
  pad: false,
  diabeticMicrovascularDisease: null,
  acuteCoronarySyndrome: null,
  combinedCadAtherothromboticStroke: null,
  steatosis: false,
  alcoholGWeek: '',
  otherCause: false,
  ast: 20,
  alt: 20,
  plateletsWan: 25,
  vcteKpa: '',
  swe: '',
  sweUnit: 'kpa',
  mreKpa: '',
  elf: '',
  type4Collagen7s: '',
  m2bpgi: '',
  uricAcid: 6.2,
  urateTreatment: false,
  goutPresent: null,
  urinaryStone: null,
  otherUrateComplication: null,
};

function missingByKey(result, key) {
  return result.missing.all.find((item) => item.key === key);
}

test('E1 exposes one normalized six-domain result contract in the canonical order', () => {
  const result = buildUnifiedClinicalResult(completeBase);
  assert.equal(result.version, UNIFIED_RESULT_VERSION);
  assert.deepEqual(result.domainOrder, ['sld', 'fibrosis', 'blood_pressure', 'lipids', 'glycemia', 'uric_acid']);
  assert.deepEqual(result.domains.map((domain) => domain.key), result.domainOrder);
  for (const domain of result.domains) {
    assert.ok(Array.isArray(domain.facts));
    assert.ok(domain.interpretation);
    assert.ok(Object.prototype.hasOwnProperty.call(domain, 'nextAction'));
    assert.ok(Array.isArray(domain.requiredMissingKeys));
    assert.ok(Array.isArray(domain.nextEvaluationKeys));
    assert.equal(typeof domain.currentDecisionComplete, 'boolean');
  }
});

test('E1 complete state is explicit when no decision-relevant information is missing', () => {
  const result = buildUnifiedClinicalResult(completeBase);
  assert.equal(result.missing.required.length, 0);
  assert.equal(result.missing.nextEvaluation.length, 0);
  assert.equal(result.completion.state, 'complete');
  assert.equal(result.completion.currentDecisionComplete, true);
  assert.equal(result.completion.allDecisionRelevantComplete, true);
  assert.match(result.completion.message, /必要な情報は揃っています/);
});

test('E1 diabetic-range confirmation is deduplicated across glycemia and lipids', () => {
  const result = buildUnifiedClinicalResult({
    ...completeBase,
    steatosis: false,
    hba1c: 6.6,
    fastingGlucose: 110,
  });
  const item = missingByKey(result, 'diabetes_confirmation');
  assert.ok(item);
  assert.equal(item.class, MISSING_DATA_CLASS.required);
  assert.ok(item.domains.includes('glycemia'));
  assert.ok(item.domains.includes('lipids'));
  assert.equal(result.missing.all.filter((entry) => entry.key === 'diabetes_confirmation').length, 1);
});

test('E1 BP persistence is a next evaluation rather than required missing data', () => {
  const result = buildUnifiedClinicalResult({
    ...completeBase,
    sbp: 132,
    dbp: 82,
    bpPersistence: '',
  });
  const item = missingByKey(result, 'bp_persistence');
  assert.ok(item);
  assert.equal(item.class, MISSING_DATA_CLASS.nextEvaluation);
  assert.equal(result.missing.required.some((entry) => entry.key === 'bp_persistence'), false);
});

test('E1 explicit not-confirmed BP still keeps persistence as the next meaningful evaluation', () => {
  const result = buildUnifiedClinicalResult({
    ...completeBase,
    sbp: 132,
    dbp: 82,
    bpPersistence: 'not_confirmed',
  });
  const item = missingByKey(result, 'bp_persistence');
  assert.ok(item);
  assert.equal(item.class, MISSING_DATA_CLASS.nextEvaluation);
});

test('E1 fibrosis second-line NIT appears only when meaningful and disappears after an NIT is entered', () => {
  const intermediate = buildUnifiedClinicalResult({
    ...completeBase,
    age: 55,
    ast: 60,
    alt: 40,
    plateletsWan: 16,
  });
  const item = missingByKey(intermediate, 'second_line_fibrosis_nit');
  assert.ok(item);
  assert.equal(item.class, MISSING_DATA_CLASS.nextEvaluation);

  const withNit = buildUnifiedClinicalResult({
    ...completeBase,
    age: 55,
    ast: 60,
    alt: 40,
    plateletsWan: 16,
    vcteKpa: 7,
  });
  assert.equal(missingByKey(withNit, 'second_line_fibrosis_nit'), undefined);
});

test('E1 low-risk fibrosis does not create irrelevant missing second-line NIT data', () => {
  const result = buildUnifiedClinicalResult(completeBase);
  assert.equal(missingByKey(result, 'second_line_fibrosis_nit'), undefined);
});

test('E1 UA <=7 does not surface gout or urinary-stone missing data', () => {
  const result = buildUnifiedClinicalResult({
    ...completeBase,
    uricAcid: 6.2,
    goutPresent: null,
    urinaryStone: null,
  });
  assert.equal(missingByKey(result, 'gout'), undefined);
  assert.equal(missingByKey(result, 'urinary_stone'), undefined);
});

test('E1 UA 8.0-8.9 complication branch marks decision-changing complication data as required', () => {
  const result = buildUnifiedClinicalResult({
    ...completeBase,
    uricAcid: 8.5,
    goutPresent: false,
    urinaryStone: null,
    otherUrateComplication: null,
  });
  assert.equal(missingByKey(result, 'urinary_stone')?.class, MISSING_DATA_CLASS.required);
  assert.equal(missingByKey(result, 'urate_other_complication')?.class, MISSING_DATA_CLASS.required);
});

test('E1 UA >=9 can classify treatment consideration before gout history and treats gout as next evaluation', () => {
  const result = buildUnifiedClinicalResult({
    ...completeBase,
    uricAcid: 9.2,
    goutPresent: null,
  });
  assert.equal(missingByKey(result, 'gout')?.class, MISSING_DATA_CLASS.nextEvaluation);
  assert.equal(result.domains.find((domain) => domain.key === 'uric_acid').currentDecisionComplete, true);
});

test('E1 SLD waist is required only when it can still change the current classification', () => {
  const needsWaist = buildUnifiedClinicalResult({
    ...completeBase,
    steatosis: true,
    alcoholGWeek: 0,
    bmi: 22,
    waist: '',
    hba1c: 5.4,
    fastingGlucose: 90,
    sbp: 110,
    dbp: 70,
    tg: 100,
    hdl: 60,
  });
  assert.equal(missingByKey(needsWaist, 'waist')?.class, MISSING_DATA_CLASS.required);

  const alreadyHasCmrf = buildUnifiedClinicalResult({
    ...completeBase,
    steatosis: true,
    alcoholGWeek: 0,
    bmi: 22,
    waist: '',
    hba1c: 5.8,
    fastingGlucose: 90,
  });
  assert.equal(missingByKey(alreadyHasCmrf, 'waist'), undefined);
});

test('E1 shared missing laboratory items are deduplicated globally', () => {
  const result = buildUnifiedClinicalResult({
    ...completeBase,
    sbp: 132,
    dbp: 82,
    ldl: '',
    hdl: '',
    tg: '',
    bpPersistence: 'home',
  });
  for (const key of ['ldl', 'hdl', 'tg']) {
    assert.equal(result.missing.all.filter((item) => item.key === key).length, 1);
  }
});

test('E1 next-evaluation-only state keeps current decisions complete but not all work complete', () => {
  const result = buildUnifiedClinicalResult({
    ...completeBase,
    age: 55,
    ast: 60,
    alt: 40,
    plateletsWan: 16,
  });
  assert.equal(result.missing.required.length, 0);
  assert.ok(result.missing.nextEvaluation.length > 0);
  assert.equal(result.completion.state, 'next_evaluation_pending');
  assert.equal(result.completion.currentDecisionComplete, true);
  assert.equal(result.completion.allDecisionRelevantComplete, false);
});

test('E1 facts, interpretation and next action remain separate', () => {
  const result = buildUnifiedClinicalResult({
    ...completeBase,
    diagnosedDiabetes: true,
    hba1c: 8.0,
    pad: false,
    diabeticMicrovascularDisease: false,
  });
  const glycemia = result.domains.find((domain) => domain.key === 'glycemia');
  assert.ok(glycemia.facts.some((item) => item.key === 'hba1c'));
  assert.equal(glycemia.interpretation.id, 'known_diabetes_above_general_target');
  assert.match(glycemia.nextAction.title, /治療目標/);
});
