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

test('E3 C2 localizes modified Hisayama risk labels', () => {
  const result = buildUnifiedClinicalResult(completeBase);
  const lipids = domain(result, 'lipids');
  assert.match(fact(lipids, 'modified_hisayama').value, /低リスク/);
  assert.doesNotMatch(fact(lipids, 'modified_hisayama').value, /\/ low$/);
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
