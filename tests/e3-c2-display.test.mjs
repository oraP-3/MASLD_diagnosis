import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUnifiedClinicalResult } from '../unified-results.js';
import { interpretNit } from '../clinical-rules.js';

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

function domain(result, key) {
  return result.domains.find((item) => item.key === key);
}

function fact(domainResult, key) {
  return domainResult.facts.find((item) => item.key === key);
}

test('E3 C2 hides non-applicable BP risk instead of exposing the internal enum', () => {
  const result = buildUnifiedClinicalResult(completeBase);
  const bp = domain(result, 'blood_pressure');
  assert.equal(fact(bp, 'bp_risk'), undefined);
  assert.doesNotMatch(JSON.stringify(bp), /not_applicable/);
});

test('E3 C2 keeps Hisayama score in the fact and risk class in the card title', () => {
  const result = buildUnifiedClinicalResult(completeBase);
  const lipids = domain(result, 'lipids');
  assert.equal(fact(lipids, 'modified_hisayama').value, '0点');
  assert.equal(lipids.interpretation.title, '一次予防・低リスク');
  assert.doesNotMatch(JSON.stringify(lipids), /\/ low|\/ intermediate|\/ high/);
});

test('E3 C2 removes repeated glycemia and urate numeric prose while retaining facts', () => {
  const result = buildUnifiedClinicalResult(completeBase);
  const glycemia = domain(result, 'glycemia');
  const urate = domain(result, 'uric_acid');

  assert.equal(fact(glycemia, 'hba1c').value, '5.4%');
  assert.equal(fact(glycemia, 'fasting_glucose').value, '90 mg/dL');
  assert.doesNotMatch(glycemia.interpretation.detail, /5\.4|90 mg\/dL/);

  assert.equal(fact(urate, 'uric_acid').value, '6.2 mg/dL');
  assert.doesNotMatch(urate.interpretation.detail, /6\.2 mg\/dL/);
});

test('E3 C2 target-met lipid interpretation omits redundant target values', () => {
  const result = buildUnifiedClinicalResult(completeBase);
  const lipids = domain(result, 'lipids');

  assert.equal(lipids.interpretation.title, '一次予防・低リスク');
  assert.match(lipids.interpretation.detail, /LDL-C：目標内/);
  assert.match(lipids.interpretation.detail, /TG：目標内/);
  assert.match(lipids.interpretation.detail, /HDL-C：基準内/);
  assert.doesNotMatch(lipids.interpretation.detail, /<160|<175|≥40/);
});

test('E3 C2 unmet lipid values are highlighted and retain the relevant thresholds', () => {
  const result = buildUnifiedClinicalResult({
    ...completeBase,
    ldl: 170,
    tg: 200,
    hdl: 35,
  });
  const lipids = domain(result, 'lipids');

  assert.equal(fact(lipids, 'ldl').tone, 'bad');
  assert.equal(fact(lipids, 'tg').tone, 'bad');
  assert.equal(fact(lipids, 'hdl').tone, 'bad');
  assert.match(lipids.interpretation.detail, /LDL-C：目標未達（目標 <160 mg\/dL）/);
  assert.match(lipids.interpretation.detail, /TG：目標未達（<175 mg\/dL）/);
  assert.match(lipids.interpretation.detail, /HDL-C：低値（<40 mg\/dL）/);
});

test('E3 C2 highlights only clear treatment-target misses for glycemia urate and treated BP', () => {
  const diabetes = buildUnifiedClinicalResult({
    ...completeBase,
    diagnosedDiabetes: true,
    hba1c: 8.0,
    pad: false,
    diabeticMicrovascularDisease: false,
  });
  assert.equal(fact(domain(diabetes, 'glycemia'), 'hba1c').tone, 'bad');

  const urate = buildUnifiedClinicalResult({
    ...completeBase,
    uricAcid: 7.0,
    urateTreatment: true,
  });
  assert.equal(fact(domain(urate, 'uric_acid'), 'uric_acid').tone, 'bad');

  const bp = buildUnifiedClinicalResult({
    ...completeBase,
    sbp: 140,
    dbp: 85,
    antihypertensiveTreatment: true,
  });
  assert.equal(fact(domain(bp, 'blood_pressure'), 'office_bp').tone, 'bad');
});

test('E3 C2 below-F2 NIT wording is simplified', () => {
  const result = interpretNit({ vcteKpa: 5.0 });
  assert.equal(result[0].severityLabel, 'F2未満');
  assert.doesNotMatch(result[0].detail, /≥F2未満/);
});


test('E3 C2 diabetes LDL tightening keeps 100-119 neutral and marks base-target misses red', () => {
  const withinBase = buildUnifiedClinicalResult({
    ...completeBase,
    diagnosedDiabetes: true,
    hba1c: 7.0,
    ldl: 110,
    pad: false,
    diabeticMicrovascularDisease: true,
  });
  const withinBaseLipids = domain(withinBase, 'lipids');
  assert.equal(fact(withinBaseLipids, 'ldl').tone, 'neutral');
  assert.match(withinBaseLipids.interpretation.detail, /LDL-C：基本目標内、<100 mg\/dLへの厳格化を考慮/);
  assert.equal(withinBaseLipids.nextAction, null);

  const aboveBase = buildUnifiedClinicalResult({
    ...completeBase,
    diagnosedDiabetes: true,
    hba1c: 7.0,
    ldl: 130,
    pad: false,
    diabeticMicrovascularDisease: true,
  });
  const aboveBaseLipids = domain(aboveBase, 'lipids');
  assert.equal(fact(aboveBaseLipids, 'ldl').tone, 'bad');
  assert.match(aboveBaseLipids.interpretation.detail, /基本目標未達（<120 mg\/dL）/);
  assert.match(aboveBaseLipids.interpretation.detail, /さらに<100 mg\/dLへの厳格化を考慮/);
  assert.ok(aboveBaseLipids.nextAction);
});

test('E3 C2 target-met glycemia and treated urate omit redundant numeric target values', () => {
  const diabetes = buildUnifiedClinicalResult({
    ...completeBase,
    diagnosedDiabetes: true,
    hba1c: 6.5,
    pad: false,
    diabeticMicrovascularDisease: false,
  });
  const glycemia = domain(diabetes, 'glycemia');
  assert.match(glycemia.interpretation.detail, /一般的な合併症予防目標の範囲内/);
  assert.doesNotMatch(glycemia.interpretation.detail, /7\.0%未満/);

  const urate = buildUnifiedClinicalResult({
    ...completeBase,
    uricAcid: 5.5,
    urateTreatment: true,
  });
  const urateDomain = domain(urate, 'uric_acid');
  assert.equal(urateDomain.interpretation.detail, 'ガイドライン上の参考目標内です。');
  assert.doesNotMatch(urateDomain.interpretation.detail, /6\.0 mg\/dL/);
});


test('E3 C2 treated urate keeps the threshold only when the target is missed', () => {
  const urate = buildUnifiedClinicalResult({
    ...completeBase,
    uricAcid: 7.0,
    urateTreatment: true,
  });
  const urateDomain = domain(urate, 'uric_acid');
  assert.equal(urateDomain.interpretation.detail, 'ガイドライン上の参考目標（6.0 mg/dL以下）を上回ります。');
  assert.ok(urateDomain.nextAction);
});
