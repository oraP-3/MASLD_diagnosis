// Clinical thresholds: Japanese MASLD diagnostic criteria / MASLD clinical practice guideline 2026.
// Keep thresholds centralized here; authoritative current guidance supersedes repository values.
export const MASLD_THRESHOLDS = Object.freeze({
  bmi: 23,
  waist: { male: 94, female: 80 },
  hba1c: 5.7,
  fastingGlucose: 100,
  sbp: 130,
  dbp: 85,
  tg: 150,
  hdl: { male: 40, female: 50 },
  alcohol: {
    male: { metaldMin: 210, aldMinExclusive: 420 },
    female: { metaldMin: 140, aldMinExclusive: 350 },
  },
  fib4: { standardLow: 1.3, olderLow: 2.0, high: 2.67, olderAge: 66 },
  plateletsWan: { highRiskBelow: 15, lowRiskAbove: 20 },
});

export const GLYCEMIA_THRESHOLDS = Object.freeze({
  diabeticHba1c: 6.5,
  fastingGlucose: 126,
  randomGlucose: 200,
  generalHba1cTarget: 7.0,
});

export const URIC_ACID_THRESHOLDS = Object.freeze({
  hyperuricemiaExclusive: 7.0,
  complicationConsideration: 8.0,
  noComplicationConsideration: 9.0,
  treatmentTarget: 6.0,
});

export const NIT_THRESHOLDS = Object.freeze({
  vcteKpa: 8,
  sweKpa: 8,
  sweMs: 1.6,
  mreKpa: 3.14,
  mreF4Kpa: 4.45,
  elfLower: 9.2,
  elfUpper: 9.8,
  elfF4: 11.8,
  type4Collagen7s: 3.8,
  m2bpgi: 1.0,
});

export function toNumber(value) {
  if (value === '' || value === null || value === undefined) return null;
  const n = Number(value);
  return Number.isFinite(n) ? n : null;
}

export function calculateBmi(heightCm, weightKg) {
  const h = toNumber(heightCm);
  const w = toNumber(weightKg);
  if (h === null || w === null || h <= 0 || w <= 0) return null;
  const meters = h / 100;
  return Math.round((w / (meters * meters)) * 10) / 10;
}

function criterionFromTwoMeasurements(first, firstThreshold, second, secondThreshold) {
  if ((first !== null && first >= firstThreshold) || (second !== null && second >= secondThreshold)) return true;
  if (first !== null && second !== null) return false;
  return null;
}

export function deriveCmrf(input) {
  const sex = input.sex;
  const bmi = toNumber(input.bmi);
  const waist = toNumber(input.waist);
  const hba1c = toNumber(input.hba1c);
  const fastingGlucose = toNumber(input.fastingGlucose);
  const sbp = toNumber(input.sbp);
  const dbp = toNumber(input.dbp);
  const tg = toNumber(input.tg);
  const hdl = toNumber(input.hdl);

  let body = null;
  if (bmi !== null && bmi >= MASLD_THRESHOLDS.bmi) body = true;
  else if (bmi !== null && bmi < MASLD_THRESHOLDS.bmi && waist !== null && sex && MASLD_THRESHOLDS.waist[sex] !== undefined) body = waist > MASLD_THRESHOLDS.waist[sex];

  let glucose = null;
  if (input.diagnosedDiabetes) glucose = true;
  else if (
    (hba1c !== null && hba1c >= MASLD_THRESHOLDS.hba1c) ||
    (fastingGlucose !== null && fastingGlucose >= MASLD_THRESHOLDS.fastingGlucose)
  ) glucose = true;
  else if (hba1c !== null && fastingGlucose !== null) glucose = false;

  let bp = null;
  if (input.antihypertensiveTreatment) bp = true;
  else bp = criterionFromTwoMeasurements(sbp, MASLD_THRESHOLDS.sbp, dbp, MASLD_THRESHOLDS.dbp);

  let tgCriterion = null;
  if (input.lipidTreatment) tgCriterion = true;
  else if (tg !== null) tgCriterion = tg >= MASLD_THRESHOLDS.tg;

  let hdlCriterion = null;
  if (input.lipidTreatment) hdlCriterion = true;
  else if (hdl !== null && sex && MASLD_THRESHOLDS.hdl[sex] !== undefined) hdlCriterion = hdl <= MASLD_THRESHOLDS.hdl[sex];

  const statuses = { body, glucose, bp, tg: tgCriterion, hdl: hdlCriterion };
  const count = Object.values(statuses).filter((value) => value === true).length;
  const unknownKeys = Object.entries(statuses).filter(([, v]) => v === null).map(([key]) => key);
  const otherCriteriaKnownNegative = [glucose, bp, tgCriterion, hdlCriterion].every((v) => v === false);
  const waistRelevant = bmi !== null && bmi < MASLD_THRESHOLDS.bmi && otherCriteriaKnownNegative;
  const needsWaist = waistRelevant && waist === null;

  return { statuses, count, unknownKeys, hasAny: count > 0, waistRelevant, needsWaist, canRuleOutAll: count === 0 && unknownKeys.length === 0 };
}

export function evaluateGlycemia(input) {
  const hba1c = toNumber(input.hba1c);
  const fastingGlucose = toNumber(input.fastingGlucose);
  const randomGlucose = toNumber(input.randomGlucose);

  if (input.diagnosedDiabetes) {
    if (hba1c === null) {
      return {
        id: 'known_diabetes_no_hba1c',
        title: '糖尿病（診断済み）',
        detail: 'HbA1cを入力すると、一般的な血糖コントロール目標との位置づけを表示します。',
        tone: 'neutral',
        needsGlucoseConfirmation: false,
      };
    }
    if (hba1c < GLYCEMIA_THRESHOLDS.generalHba1cTarget) {
      return {
        id: 'known_diabetes_general_target',
        title: '糖尿病 — 一般目標内',
        detail: `HbA1c ${hba1c.toFixed(1)}%。一般的な合併症予防目標（7.0%未満）の範囲内です。実際の目標は年齢・罹病期間・合併症・低血糖リスク等で個別化します。`,
        tone: 'good',
        needsGlucoseConfirmation: false,
      };
    }
    return {
      id: 'known_diabetes_above_general_target',
      title: '糖尿病 — 一般目標を上回る',
      detail: `HbA1c ${hba1c.toFixed(1)}%。一般的な合併症予防目標（7.0%未満）を上回ります。治療強化の要否は個別目標と低血糖リスク等を踏まえて臨床判断します。`,
      tone: 'warn',
      needsGlucoseConfirmation: false,
    };
  }

  const hba1cDiabetic = hba1c !== null && hba1c >= GLYCEMIA_THRESHOLDS.diabeticHba1c;
  const fastingDiabetic = fastingGlucose !== null && fastingGlucose >= GLYCEMIA_THRESHOLDS.fastingGlucose;
  const randomDiabetic = hba1cDiabetic && randomGlucose !== null && randomGlucose >= GLYCEMIA_THRESHOLDS.randomGlucose;
  const showRandomGlucose = hba1cDiabetic && (!fastingDiabetic || randomGlucose !== null);

  if (hba1cDiabetic && (fastingDiabetic || randomDiabetic)) {
    const bloodParts = [];
    if (fastingDiabetic) bloodParts.push(`空腹時血糖 ${fastingGlucose} mg/dL`);
    if (randomDiabetic) bloodParts.push(`随時血糖 ${randomGlucose} mg/dL`);
    return {
      id: 'hba1c_and_glucose_diabetic_range',
      title: 'HbA1c・血糖とも糖尿病型',
      detail: `HbA1c ${hba1c.toFixed(1)}%は糖尿病型で、入力された血糖値のうち少なくとも一つ（${bloodParts.join('、')}）も糖尿病型です。同一採血で得られた場合は日本糖尿病学会の診断基準を満たします。本ツールでは検査日や症状を保持しないため、最終診断は臨床情報と併せて判断してください。`,
      tone: 'bad',
      needsGlucoseConfirmation: false,
      showRandomGlucose,
    };
  }

  if (hba1cDiabetic) {
    const enteredBlood = [];
    if (fastingGlucose !== null) enteredBlood.push(`空腹時血糖 ${fastingGlucose} mg/dL`);
    if (randomGlucose !== null) enteredBlood.push(`随時血糖 ${randomGlucose} mg/dL`);

    if (enteredBlood.length === 0) {
      return {
        id: 'hba1c_diabetic_range_needs_glucose',
        title: 'HbA1cは糖尿病型 — 血糖確認待ち',
        detail: `HbA1c ${hba1c.toFixed(1)}%は糖尿病型です。HbA1c単独では診断を確定せず、血糖値による確認が必要です。`,
        tone: 'warn',
        needsGlucoseConfirmation: true,
        showRandomGlucose: true,
      };
    }

    return {
      id: 'hba1c_diabetic_range_glucose_below',
      title: 'HbA1cは糖尿病型、血糖は糖尿病型未満',
      detail: `HbA1c ${hba1c.toFixed(1)}%は糖尿病型ですが、${enteredBlood.join('、')}は糖尿病型の基準未満です。HbA1c単独では診断を確定せず、再検査等を臨床的に検討します。`,
      tone: 'warn',
      needsGlucoseConfirmation: true,
      showRandomGlucose: true,
    };
  }

  if (fastingDiabetic) {
    const hba1cContext = hba1c === null ? 'HbA1cは未入力です。' : `HbA1c ${hba1c.toFixed(1)}%は6.5%未満です。`;
    if (input.separateDayDiabeticTypeConfirmed) {
      return {
        id: 'fasting_glucose_diabetic_range_repeat_confirmed',
        title: '糖尿病診断基準を満たす',
        detail: `空腹時血糖 ${fastingGlucose} mg/dLは糖尿病型です。${hba1cContext} 別日に糖尿病型を再確認済みのため、日本糖尿病学会の診断基準を満たします。最終診断は症状や臨床経過も含めて判断してください。`,
        tone: 'bad',
        needsGlucoseConfirmation: false,
        showSeparateDayConfirmation: true,
      };
    }
    return {
      id: 'fasting_glucose_diabetic_range_needs_confirmation',
      title: '空腹時血糖は糖尿病型 — 診断確認が必要',
      detail: `空腹時血糖 ${fastingGlucose} mg/dLは糖尿病型です。${hba1cContext} 1回のみでは本ツール上は診断を確定せず、別日の糖尿病型確認や症状等を含めて臨床判断します。`,
      tone: 'warn',
      needsGlucoseConfirmation: false,
      showSeparateDayConfirmation: true,
    };
  }

  const cmrfParts = [];
  if (hba1c !== null && hba1c >= MASLD_THRESHOLDS.hba1c) cmrfParts.push(`HbA1c ${hba1c.toFixed(1)}%`);
  if (fastingGlucose !== null && fastingGlucose >= MASLD_THRESHOLDS.fastingGlucose) cmrfParts.push(`空腹時血糖 ${fastingGlucose} mg/dL`);

  if (cmrfParts.length > 0) {
    return {
      id: 'masld_glucose_cmrf',
      title: '糖代謝異常 — MASLD CMRF',
      detail: `${cmrfParts.join('、')}がMASLDの糖代謝CMRFに該当します。現在の入力では糖尿病型の基準には達していません。`,
      tone: 'warn',
      needsGlucoseConfirmation: false,
    };
  }

  if (hba1c === null && fastingGlucose === null) {
    return {
      id: 'pending',
      title: '入力待ち',
      detail: 'HbA1cまたは空腹時血糖を入力してください。',
      tone: 'neutral',
      needsGlucoseConfirmation: false,
    };
  }

  const observed = [];
  if (hba1c !== null) observed.push(`HbA1c ${hba1c.toFixed(1)}%`);
  if (fastingGlucose !== null) observed.push(`空腹時血糖 ${fastingGlucose} mg/dL`);
  return {
    id: 'below_masld_cmrf',
    title: '糖代謝CMRFなし',
    detail: `${observed.join('、')}。現在入力された値ではMASLDの糖代謝CMRFには該当しません。`,
    tone: 'good',
    needsGlucoseConfirmation: false,
  };
}


export const BP_THRESHOLDS = Object.freeze({
  officeTargetSbp: 130,
  officeTargetDbp: 80,
  dyslipidemia: {
    ldl: 140,
    hdl: 40,
    tgFasting: 150,
    tgNonfasting: 175,
  },
});

const BP_CATEGORY_META = Object.freeze({
  normal: { rank: 0, label: '正常血圧' },
  elevated_normal: { rank: 1, label: '正常高値血圧' },
  elevated: { rank: 2, label: '高値血圧' },
  grade1: { rank: 3, label: 'I度高血圧' },
  grade2: { rank: 4, label: 'II度高血圧' },
  grade3: { rank: 5, label: 'III度高血圧' },
});

function systolicBpCategory(value) {
  if (value >= 180) return 'grade3';
  if (value >= 160) return 'grade2';
  if (value >= 140) return 'grade1';
  if (value >= 130) return 'elevated';
  if (value >= 120) return 'elevated_normal';
  return 'normal';
}

function diastolicBpCategory(value) {
  if (value >= 110) return 'grade3';
  if (value >= 100) return 'grade2';
  if (value >= 90) return 'grade1';
  if (value >= 80) return 'elevated';
  return 'normal';
}

export function classifyOfficeBp(sbp, dbp) {
  const s = toNumber(sbp);
  const d = toNumber(dbp);
  if (s === null || d === null) return null;
  const sId = systolicBpCategory(s);
  const dId = diastolicBpCategory(d);
  const id = BP_CATEGORY_META[sId].rank >= BP_CATEGORY_META[dId].rank ? sId : dId;
  return { id, ...BP_CATEGORY_META[id], sbp: s, dbp: d };
}

export function evaluateBpDyslipidemia(input) {
  if (input.lipidTreatment) {
    return { status: true, reason: 'lipid_treatment', needsFastingStatusCandidate: false };
  }

  const ldl = toNumber(input.ldl);
  const hdl = toNumber(input.hdl);
  const tg = toNumber(input.tg);
  const fastingStatus = input.tgFastingStatus || '';

  if (ldl !== null && ldl >= BP_THRESHOLDS.dyslipidemia.ldl) {
    return { status: true, reason: 'ldl', needsFastingStatusCandidate: false };
  }
  if (hdl !== null && hdl < BP_THRESHOLDS.dyslipidemia.hdl) {
    return { status: true, reason: 'hdl', needsFastingStatusCandidate: false };
  }
  if (tg !== null && tg >= BP_THRESHOLDS.dyslipidemia.tgNonfasting) {
    return { status: true, reason: 'tg', needsFastingStatusCandidate: false };
  }
  if (
    tg !== null &&
    tg >= BP_THRESHOLDS.dyslipidemia.tgFasting &&
    tg < BP_THRESHOLDS.dyslipidemia.tgNonfasting
  ) {
    if (fastingStatus === 'fasting') {
      return { status: true, reason: 'tg_fasting', needsFastingStatusCandidate: false };
    }
    if (fastingStatus === 'nonfasting' && ldl !== null && hdl !== null) {
      return { status: false, reason: 'all_negative', needsFastingStatusCandidate: false };
    }
    const candidate = ldl !== null && ldl < BP_THRESHOLDS.dyslipidemia.ldl &&
      hdl !== null && hdl >= BP_THRESHOLDS.dyslipidemia.hdl;
    return { status: null, reason: 'tg_fasting_unknown', needsFastingStatusCandidate: candidate };
  }

  if (ldl !== null && hdl !== null && tg !== null) {
    return { status: false, reason: 'all_negative', needsFastingStatusCandidate: false };
  }

  return { status: null, reason: 'insufficient_lipids', needsFastingStatusCandidate: false };
}

function bpRiskFrom(categoryId, layer2Count, highRiskTrigger) {
  if (categoryId === 'grade3') return 'high';
  if (highRiskTrigger || layer2Count >= 3) return 'high';
  if (categoryId === 'grade2') return layer2Count === 0 ? 'moderate' : 'high';
  if (categoryId === 'elevated' || categoryId === 'grade1') {
    if (layer2Count === 0) return 'low';
    return 'moderate';
  }
  return 'not_applicable';
}

function possibleBpRiskLevels(input, categoryId, overrides = {}) {
  if (!['elevated', 'grade1', 'grade2', 'grade3'].includes(categoryId)) return ['not_applicable'];
  if (categoryId === 'grade3') return ['high'];

  const age = toNumber(input.age);
  const ageOptions = age === null ? [false, true] : [age >= 65];
  const sexOptions = input.sex === 'male' ? [true] : input.sex === 'female' ? [false] : [false, true];

  const dys = evaluateBpDyslipidemia(input);
  const dysStatus = Object.prototype.hasOwnProperty.call(overrides, 'dyslipidemia')
    ? overrides.dyslipidemia
    : dys.status;
  const dysOptions = dysStatus === null ? [false, true] : [Boolean(dysStatus)];

  const cvdStatus = Object.prototype.hasOwnProperty.call(overrides, 'cvdHistory')
    ? overrides.cvdHistory
    : input.cvdHistory;
  const afStatus = Object.prototype.hasOwnProperty.call(overrides, 'atrialFibrillation')
    ? overrides.atrialFibrillation
    : input.atrialFibrillation;
  const cvdOptions = cvdStatus === null || cvdStatus === undefined ? [false, true] : [Boolean(cvdStatus)];
  const afOptions = afStatus === null || afStatus === undefined ? [false, true] : [Boolean(afStatus)];

  let proteinStatus = false;
  if (input.diagnosedCkd) {
    proteinStatus = Object.prototype.hasOwnProperty.call(overrides, 'proteinuriaPresent')
      ? overrides.proteinuriaPresent
      : input.proteinuriaPresent;
  }
  const proteinOptions = proteinStatus === null || proteinStatus === undefined
    ? [false, true]
    : [Boolean(proteinStatus)];

  const levels = new Set();
  for (const ageRisk of ageOptions) {
    for (const maleRisk of sexOptions) {
      for (const dysRisk of dysOptions) {
        for (const cvd of cvdOptions) {
          for (const af of afOptions) {
            for (const protein of proteinOptions) {
              const layer2Count = [ageRisk, maleRisk, dysRisk, Boolean(input.currentSmoking)].filter(Boolean).length;
              const highTrigger = Boolean(input.diagnosedDiabetes) || cvd || af || protein;
              levels.add(bpRiskFrom(categoryId, layer2Count, highTrigger));
            }
          }
        }
      }
    }
  }

  const order = ['low', 'moderate', 'high', 'not_applicable'];
  return [...levels].sort((a, b) => order.indexOf(a) - order.indexOf(b));
}

function sameStringArray(a, b) {
  return a.length === b.length && a.every((value, index) => value === b[index]);
}

export function evaluateBloodPressure(input) {
  const category = classifyOfficeBp(input.sbp, input.dbp);
  if (!category) {
    return {
      category: null,
      riskLevel: 'unresolved',
      possibleRisks: [],
      highRiskReasons: [],
      showRiskBackground: false,
      showPersistenceQuestion: false,
      persistenceConfirmed: false,
      showProteinuriaQuestion: false,
      needsProteinuria: false,
      showTgFastingQuestion: false,
      needsTgFastingStatus: false,
      timingClass: 'pending',
    };
  }

  const treated = Boolean(input.antihypertensiveTreatment);
  const riskApplicable = ['elevated', 'grade1', 'grade2', 'grade3'].includes(category.id);
  const dys = evaluateBpDyslipidemia(input);

  const age = toNumber(input.age);
  const knownLayer2Count = [
    age !== null && age >= 65,
    input.sex === 'male',
    dys.status === true,
    Boolean(input.currentSmoking),
  ].filter(Boolean).length;

  const highRiskReasons = [];
  if (input.diagnosedDiabetes) highRiskReasons.push('diabetes');
  if (input.cvdHistory === true) highRiskReasons.push('cvd');
  if (input.atrialFibrillation === true) highRiskReasons.push('atrial_fibrillation');
  if (input.diagnosedCkd && input.proteinuriaPresent === true) highRiskReasons.push('proteinuric_ckd');
  if (knownLayer2Count >= 3) highRiskReasons.push('three_layer2_factors');

  const possibleRisks = possibleBpRiskLevels(input, category.id);
  const riskLevel = possibleRisks.length === 1 ? possibleRisks[0] : 'unresolved';

  const highRiskEstablishedWithoutCvdAf =
    Boolean(input.diagnosedDiabetes) ||
    knownLayer2Count >= 3 ||
    (Boolean(input.diagnosedCkd) && input.proteinuriaPresent === true);
  const riskBackgroundAlreadyAnswered =
    input.cvdHistory !== null && input.cvdHistory !== undefined ||
    input.atrialFibrillation !== null && input.atrialFibrillation !== undefined;
  const showRiskBackground =
    !treated &&
    ['elevated', 'grade1'].includes(category.id) &&
    (!highRiskEstablishedWithoutCvdAf || riskBackgroundAlreadyAnswered);

  const riskBackgroundResolved =
    highRiskEstablishedWithoutCvdAf ||
    (
      input.cvdHistory !== null && input.cvdHistory !== undefined &&
      input.atrialFibrillation !== null && input.atrialFibrillation !== undefined
    );

  const riskWithoutProtein = possibleBpRiskLevels(input, category.id, { proteinuriaPresent: false });
  const riskWithProtein = possibleBpRiskLevels(input, category.id, { proteinuriaPresent: true });
  const otherHighRiskEstablished =
    Boolean(input.diagnosedDiabetes) ||
    input.cvdHistory === true ||
    input.atrialFibrillation === true ||
    knownLayer2Count >= 3;
  const showProteinuriaQuestion =
    !treated &&
    ['elevated', 'grade1'].includes(category.id) &&
    Boolean(input.diagnosedCkd) &&
    riskBackgroundResolved &&
    !otherHighRiskEstablished &&
    !sameStringArray(riskWithoutProtein, riskWithProtein);
  const needsProteinuria =
    showProteinuriaQuestion &&
    (input.proteinuriaPresent === null || input.proteinuriaPresent === undefined);

  const ldl = toNumber(input.ldl);
  const hdl = toNumber(input.hdl);
  const tg = toNumber(input.tg);
  const tgBorderlineCanResolveDyslipidemia =
    !input.lipidTreatment &&
    ldl !== null && ldl < BP_THRESHOLDS.dyslipidemia.ldl &&
    hdl !== null && hdl >= BP_THRESHOLDS.dyslipidemia.hdl &&
    tg !== null &&
    tg >= BP_THRESHOLDS.dyslipidemia.tgFasting &&
    tg < BP_THRESHOLDS.dyslipidemia.tgNonfasting;

  let showTgFastingQuestion = false;
  if (
    !treated &&
    riskApplicable &&
    category.id !== 'grade3' &&
    tgBorderlineCanResolveDyslipidemia &&
    riskBackgroundResolved
  ) {
    const riskIfNonfasting = possibleBpRiskLevels(
      { ...input, tgFastingStatus: 'nonfasting' },
      category.id,
      { dyslipidemia: false }
    );
    const riskIfFasting = possibleBpRiskLevels(
      { ...input, tgFastingStatus: 'fasting' },
      category.id,
      { dyslipidemia: true }
    );
    showTgFastingQuestion = !sameStringArray(riskIfNonfasting, riskIfFasting);
  }
  const needsTgFastingStatus = showTgFastingQuestion && !input.tgFastingStatus;

  const persistence = input.bpPersistence || '';
  const persistenceConfirmed = persistence === 'other_office' || persistence === 'home';
  const showPersistenceQuestion = !treated && ['elevated', 'grade1', 'grade2'].includes(category.id);

  let timingClass = 'no_hypertension_action';
  if (category.id === 'grade3') {
    timingClass = 'urgent_assessment';
  } else if (treated) {
    const sbp = toNumber(input.sbp);
    const dbp = toNumber(input.dbp);
    timingClass = sbp < BP_THRESHOLDS.officeTargetSbp && dbp < BP_THRESHOLDS.officeTargetDbp
      ? 'treated_within_target'
      : 'treated_above_target';
  } else if (category.id === 'grade2') {
    timingClass = persistenceConfirmed ? 'prompt_pharmacologic_consideration' : 'prompt_confirmation';
  } else if (category.id === 'grade1') {
    if (!persistenceConfirmed) {
      timingClass = riskLevel === 'high' ? 'prompt_confirmation_high_risk' : 'needs_confirmation';
    } else if (riskLevel === 'high') {
      timingClass = 'prompt_pharmacologic_consideration';
    } else if (riskLevel === 'unresolved') {
      timingClass = 'needs_risk_resolution';
    } else {
      timingClass = 'short_interval_reassessment';
    }
  } else if (category.id === 'elevated') {
    if (!persistenceConfirmed) {
      timingClass = 'needs_confirmation';
    } else if (riskLevel === 'high') {
      timingClass = 'short_interval_reassessment_with_pharmacologic_consideration';
    } else if (riskLevel === 'unresolved') {
      timingClass = 'needs_risk_resolution';
    } else {
      timingClass = 'lifestyle_planned_reassessment';
    }
  }

  return {
    category,
    riskLevel,
    possibleRisks,
    highRiskReasons,
    dyslipidemiaStatus: dys.status,
    showRiskBackground,
    showPersistenceQuestion,
    persistenceConfirmed,
    showProteinuriaQuestion,
    needsProteinuria,
    showTgFastingQuestion,
    needsTgFastingStatus,
    timingClass,
  };
}


function bpLayer2Labels(input, dyslipidemiaStatus) {
  const labels = [];
  const age = toNumber(input.age);
  if (age !== null && age >= 65) labels.push('65歳以上');
  if (input.sex === 'male') labels.push('男性');
  if (dyslipidemiaStatus === true) labels.push('脂質異常症');
  if (input.currentSmoking) labels.push('現在喫煙');
  return labels;
}

function bpHighRiskLabels(input, result, layer2Labels) {
  const labels = [];
  if (result.highRiskReasons.includes('diabetes')) labels.push('糖尿病');
  if (result.highRiskReasons.includes('cvd')) labels.push('脳・心血管疾患既往');
  if (result.highRiskReasons.includes('atrial_fibrillation')) labels.push('心房細動');
  if (result.highRiskReasons.includes('proteinuric_ckd')) labels.push('蛋白尿ありCKD');
  if (result.highRiskReasons.includes('three_layer2_factors') && layer2Labels.length >= 3) {
    labels.push(`${layer2Labels.join('・')}の組み合わせ`);
  }
  return labels;
}

function bpMissingLabels(input, result) {
  const labels = [];
  const riskResolutionAffectsAction =
    !input.antihypertensiveTreatment &&
    ['elevated', 'grade1'].includes(result.category?.id);

  if (result.riskLevel === 'unresolved' && riskResolutionAffectsAction) {
    if (toNumber(input.age) === null) labels.push('年齢');
    if (input.sex !== 'male' && input.sex !== 'female') labels.push('性別');
    if (result.showRiskBackground && (input.cvdHistory === null || input.cvdHistory === undefined)) labels.push('脳・心血管疾患既往');
    if (result.showRiskBackground && (input.atrialFibrillation === null || input.atrialFibrillation === undefined)) labels.push('心房細動');
    if (result.needsProteinuria) labels.push('蛋白尿');
    if (result.needsTgFastingStatus) labels.push('TGの採血条件');
    if (
      result.dyslipidemiaStatus === null &&
      !result.needsTgFastingStatus &&
      !input.lipidTreatment
    ) labels.push('LDL-C / HDL-C / TG');
  }
  if (result.showPersistenceQuestion && !input.bpPersistence) labels.push('血圧高値の持続確認');
  return [...new Set(labels)];
}

export function summarizeBloodPressure(input) {
  const result = evaluateBloodPressure(input);
  if (!result.category) {
    return {
      ...result,
      classificationDetail: '収縮期・拡張期血圧を入力してください。',
      actionTitle: '入力待ち',
      actionDetail: '血圧分類後に次の対応を表示します。',
      actionTone: 'neutral',
      showAction: false,
      missing: [],
    };
  }

  const layer2Labels = bpLayer2Labels(input, result.dyslipidemiaStatus);
  const highRiskLabels = bpHighRiskLabels(input, result, layer2Labels);
  const missing = bpMissingLabels(input, result);

  let classificationDetail = '';
  if (!input.antihypertensiveTreatment && result.riskLevel === 'high') {
    if (highRiskLabels.length) {
      classificationDetail = `${highRiskLabels.join('・')}：高リスク。`;
    } else if (result.category.id === 'grade3') {
      classificationDetail = 'III度高血圧域：高リスク。';
    } else if (result.category.id === 'grade2' && layer2Labels.length) {
      classificationDetail = `${layer2Labels.join('・')}：高リスク。`;
    } else {
      classificationDetail = '高リスク。';
    }
  } else if (!input.antihypertensiveTreatment && result.riskLevel === 'moderate') {
    classificationDetail = layer2Labels.length
      ? `${layer2Labels.join('・')}：中等リスク。`
      : '中等リスク。';
  } else if (!input.antihypertensiveTreatment && result.riskLevel === 'low') {
    classificationDetail = '追加高リスク背景なし。';
  } else if (
    !input.antihypertensiveTreatment &&
    result.riskLevel === 'unresolved' &&
    ['elevated', 'grade1'].includes(result.category.id)
  ) {
    classificationDetail = '背景情報の確認でリスク判定が変わります。';
  }

  const persistenceExplicitlyUnconfirmed = input.bpPersistence === 'not_confirmed';
  const persistenceNotEntered = result.showPersistenceQuestion && !input.bpPersistence;
  let actionTitle = '経過を確認';
  let actionDetail = '';
  let actionTone = 'neutral';

  switch (result.timingClass) {
    case 'urgent_assessment':
      actionTitle = '速やかな臨床評価が必要';
      actionDetail = 'III度高血圧域。家庭血圧待ちにせず速やかに臨床評価。';
      actionTone = 'bad';
      break;

    case 'treated_within_target':
      actionTitle = '降圧目標内';
      actionDetail = '目標 <130/80 mmHg。現治療の継続・経過観察を検討。';
      actionTone = 'good';
      break;

    case 'treated_above_target':
      actionTitle = result.category.id === 'grade2' ? '目標超過 — 早めに治療内容を再評価' : '目標超過 — 治療内容を再評価';
      actionDetail = '服薬・忍容性・家庭血圧を確認し、必要なら治療強化を検討。';
      actionTone = result.category.id === 'grade2' ? 'bad' : 'warn';
      break;

    case 'prompt_confirmation_high_risk':
      actionTitle = '高リスク背景あり — 速やかに持続確認';
      actionDetail = '家庭/別日血圧で持続確認。持続なら薬物療法を速やかに検討。';
      actionTone = 'bad';
      break;

    case 'prompt_confirmation':
      actionTitle = '速やかに再確認・臨床評価';
      actionDetail = '再測定・家庭血圧で速やかに持続確認。持続なら薬物療法を検討。';
      actionTone = 'bad';
      break;

    case 'prompt_pharmacologic_consideration':
      actionTitle = '薬物療法を速やかに検討';
      actionDetail = '持続性高血圧を確認済み。生活習慣改善と薬物療法を検討。';
      actionTone = 'bad';
      break;

    case 'short_interval_reassessment_with_pharmacologic_consideration':
      actionTitle = '生活習慣改善＋約1か月で再評価';
      actionDetail = '約1か月で再評価。目標超過が続けば薬物療法を考慮。';
      actionTone = 'warn';
      break;

    case 'short_interval_reassessment':
      actionTitle = '生活習慣改善＋約1か月で再評価';
      actionDetail = '約1か月で再評価。目標未達が続けば薬物療法を検討。';
      actionTone = 'warn';
      break;

    case 'lifestyle_planned_reassessment':
      actionTitle = '生活習慣改善＋計画的再評価';
      actionDetail = '生活習慣改善を行い、計画的に再評価。';
      actionTone = 'warn';
      break;

    case 'needs_risk_resolution':
      actionTitle = '追加情報で対応を確定';
      actionDetail = '背景情報を確認して対応を確定。';
      actionTone = 'warn';
      break;

    case 'needs_confirmation':
      if (persistenceNotEntered) {
        actionTitle = result.riskLevel === 'high'
          ? '高リスク背景あり — 血圧高値の持続状況を確認'
          : '血圧高値の持続状況を確認';
        if (result.category.id === 'grade1') {
          actionDetail = '生活習慣改善。持続なら約1か月で再評価し、薬物療法を検討。';
        } else if (result.riskLevel === 'high') {
          actionDetail = '家庭/別日血圧で持続確認。持続時は約1か月で再評価・薬物療法を考慮。';
        } else {
          actionDetail = '家庭/別日血圧で持続確認。持続時は生活習慣改善・再評価。';
        }
      } else if (persistenceExplicitlyUnconfirmed) {
        actionTitle = result.riskLevel === 'high'
          ? '高リスク背景あり — 持続確認を優先'
          : '血圧高値の持続確認を優先';
        if (result.category.id === 'grade1') {
          actionDetail = '生活習慣改善。持続確認後、約1か月で再評価し薬物療法を検討。';
        } else if (result.riskLevel === 'high') {
          actionDetail = '未確認。持続時は約1か月で再評価し、薬物療法を考慮。';
        } else {
          actionDetail = '未確認。家庭/別日血圧で持続確認。';
        }
      } else {
        actionTitle = '血圧高値の持続確認を優先';
        actionDetail = '家庭/別日血圧で持続確認。';
      }
      actionTone = 'warn';
      break;

    case 'no_hypertension_action':
    default:
      actionTitle = '';
      actionDetail = '';
      actionTone = 'good';
      break;
  }

  return {
    ...result,
    classificationDetail,
    actionTitle,
    actionDetail,
    actionTone,
    showAction: result.timingClass !== 'no_hypertension_action',
    missing,
  };
}


// D1 evidence lock: JAS Guidelines for Prevention of Atherosclerotic Cardiovascular Diseases 2022 / current JAS risk chart.
export const LIPID_HISAYAMA_THRESHOLDS = Object.freeze({
  ageMin: 40,
  ageMax: 79,
  sbp: [120, 130, 140, 160],
  ldl: [120, 140, 160],
  hdl: [40, 60],
  hba1cAbnormal: 5.7,
  fastingGlucoseAbnormal: 100,
});

function triStateBoolean(value) {
  if (value === true) return true;
  if (value === false) return false;
  return null;
}

export function evaluateLipidDiabetesState(input) {
  if (input.diagnosedDiabetes === true) {
    return { status: 'diabetes', glucoseAbnormality: null, reason: 'diagnosed_diabetes' };
  }

  const hba1c = toNumber(input.hba1c);
  const fastingGlucose = toNumber(input.fastingGlucose);
  const randomGlucose = toNumber(input.randomGlucose);

  const hba1cDiabetic = hba1c !== null && hba1c >= GLYCEMIA_THRESHOLDS.diabeticHba1c;
  const fastingDiabetic = fastingGlucose !== null && fastingGlucose >= GLYCEMIA_THRESHOLDS.fastingGlucose;
  const randomDiabeticWithHba1c = hba1cDiabetic &&
    randomGlucose !== null &&
    randomGlucose >= GLYCEMIA_THRESHOLDS.randomGlucose;

  if (
    (hba1cDiabetic && (fastingDiabetic || randomDiabeticWithHba1c)) ||
    (fastingDiabetic && input.separateDayDiabeticTypeConfirmed === true)
  ) {
    return { status: 'diabetes', glucoseAbnormality: null, reason: 'criteria_met' };
  }

  if (hba1cDiabetic || fastingDiabetic) {
    return { status: 'unresolved', glucoseAbnormality: null, reason: 'diabetic_range_unconfirmed' };
  }

  const abnormal =
    (hba1c !== null && hba1c >= LIPID_HISAYAMA_THRESHOLDS.hba1cAbnormal) ||
    (fastingGlucose !== null && fastingGlucose >= LIPID_HISAYAMA_THRESHOLDS.fastingGlucoseAbnormal);

  if (abnormal) {
    return { status: 'no_diabetes', glucoseAbnormality: true, reason: 'non_diabetic_glucose_abnormality' };
  }

  if (hba1c !== null && fastingGlucose !== null) {
    return { status: 'no_diabetes', glucoseAbnormality: false, reason: 'no_glucose_abnormality' };
  }

  return { status: 'no_diabetes', glucoseAbnormality: null, reason: 'glucose_score_input_missing' };
}

function hisayamaSbpPoints(sbp) {
  if (sbp < 120) return 0;
  if (sbp < 130) return 1;
  if (sbp < 140) return 2;
  if (sbp < 160) return 3;
  return 4;
}

function hisayamaLdlPoints(ldl) {
  if (ldl < 120) return 0;
  if (ldl < 140) return 1;
  if (ldl < 160) return 2;
  return 3;
}

function hisayamaHdlPoints(hdl) {
  if (hdl >= 60) return 0;
  if (hdl >= 40) return 1;
  return 2;
}

export function calculateModifiedHisayama(input) {
  const diabetesState = evaluateLipidDiabetesState(input);
  if (diabetesState.status === 'diabetes') {
    return { score: null, points: null, missing: [], status: 'diabetes_bypass' };
  }
  if (diabetesState.status === 'unresolved') {
    return { score: null, points: null, missing: ['diabetes_status'], status: 'unresolved' };
  }

  const sex = input.sex;
  const sbp = toNumber(input.sbp);
  const ldl = toNumber(input.ldl);
  const hdl = toNumber(input.hdl);
  const missing = [];

  if (!['male', 'female'].includes(sex)) missing.push('sex');
  if (sbp === null) missing.push('sbp');
  if (ldl === null) missing.push('ldl');
  if (hdl === null) missing.push('hdl');
  if (diabetesState.glucoseAbnormality === null) missing.push('glucose_abnormality');

  if (missing.length > 0) {
    return { score: null, points: null, missing, status: 'unresolved' };
  }

  const points = {
    sex: sex === 'male' ? 7 : 0,
    sbp: hisayamaSbpPoints(sbp),
    glucose: diabetesState.glucoseAbnormality ? 1 : 0,
    ldl: hisayamaLdlPoints(ldl),
    hdl: hisayamaHdlPoints(hdl),
    smoking: input.currentSmoking === true ? 2 : 0,
  };

  return {
    score: Object.values(points).reduce((sum, value) => sum + value, 0),
    points,
    missing: [],
    status: 'scored',
  };
}

export function classifyModifiedHisayamaRisk(age, score) {
  const a = toNumber(age);
  const s = toNumber(score);
  if (a === null || s === null) return null;
  if (a < LIPID_HISAYAMA_THRESHOLDS.ageMin || a > LIPID_HISAYAMA_THRESHOLDS.ageMax) return null;

  if (a < 50) return s <= 12 ? 'low' : 'intermediate';
  if (a < 60) {
    if (s <= 7) return 'low';
    if (s <= 18) return 'intermediate';
    return 'high';
  }
  if (a < 70) {
    if (s <= 1) return 'low';
    if (s <= 12) return 'intermediate';
    return 'high';
  }
  return s <= 7 ? 'intermediate' : 'high';
}

function unresolvedLipidRoute(reason, missing = []) {
  return {
    id: 'unresolved',
    bypassReason: null,
    scoreEligible: false,
    score: null,
    points: null,
    riskClass: null,
    reason,
    missing,
  };
}

export function evaluateLipidRouting(input) {
  const knownFh = triStateBoolean(input.knownFh);
  const familialTypeIII = triStateBoolean(input.familialTypeIII);

  if (knownFh === true) {
    return {
      id: 'known_fh',
      bypassReason: 'familial_hypercholesterolemia',
      scoreEligible: false,
      score: null,
      points: null,
      riskClass: null,
    };
  }
  if (familialTypeIII === true) {
    return {
      id: 'familial_type_iii',
      bypassReason: 'familial_type_iii_hyperlipidemia',
      scoreEligible: false,
      score: null,
      points: null,
      riskClass: null,
    };
  }
  if (knownFh === null || familialTypeIII === null) {
    return unresolvedLipidRoute('familial_dyslipidemia_status', ['known_fh_or_type_iii']);
  }

  const secondaryPrevention = triStateBoolean(input.qualifyingSecondaryPrevention);
  if (secondaryPrevention === true) {
    return {
      id: 'secondary_prevention',
      bypassReason: 'qualifying_secondary_prevention',
      scoreEligible: false,
      score: null,
      points: null,
      riskClass: null,
    };
  }
  if (secondaryPrevention === null) {
    return unresolvedLipidRoute('secondary_prevention_status', ['qualifying_secondary_prevention']);
  }

  const diabetesState = evaluateLipidDiabetesState(input);
  if (diabetesState.status === 'unresolved') {
    return unresolvedLipidRoute('diabetes_status', ['diabetes_confirmation']);
  }

  const diagnosedCkd = triStateBoolean(input.diagnosedCkd);
  const pad = triStateBoolean(input.pad);
  const highRiskReasons = [];
  if (diabetesState.status === 'diabetes') highRiskReasons.push('diabetes');
  if (diagnosedCkd === true) highRiskReasons.push('ckd');
  if (pad === true) highRiskReasons.push('pad');

  // Once a primary-prevention high-risk condition is established, another bypass
  // condition does not need to be forced solely to determine routing.
  if (highRiskReasons.length > 0) {
    return {
      id: 'primary_high_risk',
      bypassReason: highRiskReasons[0],
      highRiskReasons,
      scoreEligible: false,
      score: null,
      points: null,
      riskClass: 'high',
    };
  }

  if (diagnosedCkd === null || pad === null) {
    const missing = [];
    if (diagnosedCkd === null) missing.push('diagnosed_ckd');
    if (pad === null) missing.push('pad');
    return unresolvedLipidRoute('primary_high_risk_status', missing);
  }

  const age = toNumber(input.age);
  if (age === null) return unresolvedLipidRoute('age', ['age']);
  if (age < LIPID_HISAYAMA_THRESHOLDS.ageMin || age > LIPID_HISAYAMA_THRESHOLDS.ageMax) {
    return {
      id: 'out_of_score_range',
      bypassReason: age < LIPID_HISAYAMA_THRESHOLDS.ageMin ? 'age_under_40' : 'age_80_or_older',
      scoreEligible: false,
      score: null,
      points: null,
      riskClass: null,
    };
  }

  const scored = calculateModifiedHisayama(input);
  if (scored.status !== 'scored') {
    return unresolvedLipidRoute(
      scored.missing.includes('diabetes_status') ? 'diabetes_status' : 'score_input',
      scored.missing,
    );
  }

  return {
    id: 'modified_hisayama',
    bypassReason: null,
    scoreEligible: true,
    score: scored.score,
    points: scored.points,
    riskClass: classifyModifiedHisayamaRisk(age, scored.score),
  };
}


export const LIPID_TARGETS = Object.freeze({
  primary: { low: 160, intermediate: 140, high: 120 },
  diabetesDefault: 120,
  diabetesStrict: 100,
  ckd: 120,
  pad: 120,
  secondary: 100,
  secondaryStrict: 70,
  fhPrimary: 100,
  fhSecondary: 70,
  primaryLdlGuard: 180,
  tgFasting: 150,
  tgCasual: 175,
  hdlMinimum: 40,
});

export function evaluateLipidTriglycerides(input) {
  const tg = toNumber(input.tg);
  const hdl = toNumber(input.hdl);
  const fastingKnown = input.tgFastingStatus === 'fasting';
  const tgThreshold = fastingKnown ? LIPID_TARGETS.tgFasting : LIPID_TARGETS.tgCasual;

  return {
    tg,
    hdl,
    fastingKnown,
    sampleClass: fastingKnown ? 'fasting' : 'casual',
    tgThreshold,
    tgAboveTarget: tg === null ? null : tg >= tgThreshold,
    hdlBelowTarget: hdl === null ? null : hdl < LIPID_TARGETS.hdlMinimum,
  };
}

export function evaluateLipidTarget(input) {
  const route = evaluateLipidRouting(input);
  const diabetesState = evaluateLipidDiabetesState(input);
  const knownFh = triStateBoolean(input.knownFh);
  const familialTypeIII = triStateBoolean(input.familialTypeIII);
  const secondary = triStateBoolean(input.qualifyingSecondaryPrevention);
  const pad = triStateBoolean(input.pad);
  const microvascular = triStateBoolean(input.diabeticMicrovascularDisease);
  const acs = triStateBoolean(input.acuteCoronarySyndrome);
  const combinedVascular = triStateBoolean(input.combinedCadAtherothromboticStroke);
  const ldl = toNumber(input.ldl);
  const age = toNumber(input.age);

  const questionState = {
    showSecondaryQuestion:
      familialTypeIII !== true &&
      knownFh !== null &&
      familialTypeIII !== null,
    showSecondarySubtypeQuestion: false,
    showSecondaryCombinedQuestion: false,
    showPadQuestion: false,
    showDiabeticMicrovascularQuestion: false,
  };

  const base = {
    route,
    target: null,
    targetReason: null,
    status: 'unresolved',
    strictReason: null,
    ldl,
    atTarget: null,
    ldl180Guard: secondary === false && knownFh !== true && familialTypeIII !== true &&
      ldl !== null && ldl >= LIPID_TARGETS.primaryLdlGuard,
    questionState,
  };

  if (familialTypeIII === true) {
    return { ...base, status: 'familial_type_iii', targetReason: 'familial_type_iii' };
  }

  if (knownFh === true) {
    if (secondary === null) {
      return { ...base, targetReason: 'fh_secondary_status_needed' };
    }
    const target = secondary ? LIPID_TARGETS.fhSecondary : LIPID_TARGETS.fhPrimary;
    return {
      ...base,
      status: 'target_set',
      target,
      targetReason: secondary ? 'fh_secondary' : 'fh_primary',
      atTarget: ldl === null ? null : ldl < target,
    };
  }

  if (knownFh === null || familialTypeIII === null) {
    return { ...base, targetReason: 'familial_status_needed' };
  }

  if (secondary === null) {
    return { ...base, targetReason: 'secondary_status_needed' };
  }

  if (secondary === true) {
    const strictReasons = [];
    if (diabetesState.status === 'diabetes') strictReasons.push('diabetes');
    if (acs === true) strictReasons.push('acute_coronary_syndrome');
    if (combinedVascular === true) strictReasons.push('combined_cad_and_atherothrombotic_stroke');

    questionState.showSecondarySubtypeQuestion = diabetesState.status !== 'diabetes';
    questionState.showSecondaryCombinedQuestion =
      questionState.showSecondarySubtypeQuestion && acs === false;

    if (strictReasons.length > 0) {
      const target = LIPID_TARGETS.secondaryStrict;
      return {
        ...base,
        status: 'target_set',
        target,
        targetReason: 'secondary_strict',
        strictReason: strictReasons[0],
        atTarget: ldl === null ? null : ldl < target,
      };
    }

    let strictnessUnresolved = diabetesState.status === 'unresolved';
    if (diabetesState.status !== 'diabetes') {
      if (acs === null) strictnessUnresolved = true;
      else if (acs === false && combinedVascular === null) strictnessUnresolved = true;
    }

    if (strictnessUnresolved) {
      return { ...base, targetReason: 'secondary_strictness_unresolved' };
    }

    const target = LIPID_TARGETS.secondary;
    return {
      ...base,
      status: 'target_set',
      target,
      targetReason: 'secondary_base',
      atTarget: ldl === null ? null : ldl < target,
    };
  }

  if (diabetesState.status === 'unresolved') {
    return { ...base, targetReason: 'diabetes_status_unresolved' };
  }

  const diagnosedCkd = triStateBoolean(input.diagnosedCkd);

  if (diabetesState.status === 'diabetes') {
    if (input.currentSmoking === true || pad === true || microvascular === true) {
      const strictReason = input.currentSmoking === true
        ? 'current_smoking'
        : pad === true
          ? 'pad'
          : 'diabetic_microvascular_disease';
      if (input.currentSmoking !== true) {
        questionState.showPadQuestion = true;
        questionState.showDiabeticMicrovascularQuestion = pad === false;
      }
      const target = LIPID_TARGETS.diabetesStrict;
      return {
        ...base,
        status: 'target_set',
        target,
        targetReason: 'diabetes_strict',
        strictReason,
        atTarget: ldl === null ? null : ldl < target,
      };
    }

    if (input.currentSmoking !== true && pad === null) {
      questionState.showPadQuestion = true;
      return { ...base, targetReason: 'diabetes_pad_status_needed' };
    }

    if (input.currentSmoking !== true && pad === false && microvascular === null) {
      questionState.showPadQuestion = true;
      questionState.showDiabeticMicrovascularQuestion = true;
      return { ...base, targetReason: 'diabetes_microvascular_status_needed' };
    }

    questionState.showPadQuestion = input.currentSmoking !== true;
    questionState.showDiabeticMicrovascularQuestion =
      input.currentSmoking !== true && pad === false;

    const target = LIPID_TARGETS.diabetesDefault;
    return {
      ...base,
      status: 'target_set',
      target,
      targetReason: 'diabetes_default',
      atTarget: ldl === null ? null : ldl < target,
    };
  }

  if (diagnosedCkd === true) {
    const target = LIPID_TARGETS.ckd;
    return {
      ...base,
      status: 'target_set',
      target,
      targetReason: 'ckd',
      atTarget: ldl === null ? null : ldl < target,
    };
  }

  if (diagnosedCkd === null) {
    return { ...base, targetReason: 'ckd_status_needed' };
  }

  if (pad === null) {
    questionState.showPadQuestion = true;
    return { ...base, targetReason: 'pad_status_needed' };
  }

  questionState.showPadQuestion = true;

  if (pad === true) {
    const target = LIPID_TARGETS.pad;
    return {
      ...base,
      status: 'target_set',
      target,
      targetReason: 'pad',
      atTarget: ldl === null ? null : ldl < target,
    };
  }

  if (route.id === 'modified_hisayama') {
    const target = LIPID_TARGETS.primary[route.riskClass];
    return {
      ...base,
      status: 'target_set',
      target,
      targetReason: `primary_${route.riskClass}`,
      atTarget: ldl === null ? null : ldl < target,
    };
  }

  if (route.id === 'out_of_score_range') {
    return {
      ...base,
      status: 'out_of_score_range',
      targetReason: route.bypassReason,
      age,
    };
  }

  return {
    ...base,
    targetReason: route.reason || 'routing_unresolved',
  };
}

function lipidTargetReasonLabel(result) {
  switch (result.targetReason) {
    case 'fh_primary': return '既知FH・一次予防';
    case 'fh_secondary': return '既知FH・二次予防';
    case 'secondary_base': return '二次予防';
    case 'secondary_strict':
      if (result.strictReason === 'diabetes') return '二次予防＋糖尿病';
      if (result.strictReason === 'acute_coronary_syndrome') return '二次予防＋ACS';
      return '冠動脈疾患＋アテローム血栓性脳梗塞';
    case 'diabetes_default': return '糖尿病・一次予防';
    case 'diabetes_strict':
      if (result.strictReason === 'current_smoking') return '糖尿病＋現在喫煙';
      if (result.strictReason === 'pad') return '糖尿病＋PAD';
      return '糖尿病＋細小血管症';
    case 'ckd': return 'CKD・一次予防';
    case 'pad': return 'PAD・一次予防';
    case 'primary_low': return '一次予防・低リスク';
    case 'primary_intermediate': return '一次予防・中リスク';
    case 'primary_high': return '一次予防・高リスク';
    default: return '';
  }
}

export function summarizeLipids(input) {
  const targetResult = evaluateLipidTarget(input);
  const tgResult = evaluateLipidTriglycerides(input);
  const questionState = targetResult.questionState;
  const reasonLabel = lipidTargetReasonLabel(targetResult);

  let title = '脂質リスク判定待ち';
  let detail = '';
  let tone = 'neutral';

  if (targetResult.status === 'target_set') {
    const diabetesStrict = targetResult.targetReason === 'diabetes_strict';
    title = diabetesStrict
      ? `LDL-C <${targetResult.target} mg/dLへの厳格化を考慮`
      : `LDL-C目標 <${targetResult.target} mg/dL`;
    const valueText = targetResult.ldl === null
      ? 'LDL-Cを入力すると現在値との位置づけを表示します。'
      : diabetesStrict
        ? targetResult.atTarget
          ? `現在 ${targetResult.ldl} mg/dLで、考慮する厳格化目標の範囲内です。`
          : `現在 ${targetResult.ldl} mg/dLです。`
        : targetResult.atTarget
          ? `現在 ${targetResult.ldl} mg/dLで目標内です。`
          : `現在 ${targetResult.ldl} mg/dLで目標以上です。`;
    const treatmentText = targetResult.ldl !== null && !targetResult.atTarget
      ? input.lipidTreatment
        ? ' 脂質低下療法中のため、治療強化の要否を臨床的に検討します。'
        : ' 目標達成に向けた介入の要否を臨床的に検討します。'
      : input.lipidTreatment
        ? ' 脂質低下療法中です。'
        : '';
    detail = diabetesStrict
      ? `${reasonLabel}では基本目標 <120 mg/dLに加えて <100 mg/dLへの厳格化を考慮します。 ${valueText}${treatmentText}`
      : `${reasonLabel}。 ${valueText}${treatmentText}`;
    if (toNumber(input.age) !== null && toNumber(input.age) >= 80) {
      detail += ' 80歳以上では全身状態・フレイル等を踏まえて管理目標を個別化します。';
    }
    tone = targetResult.atTarget === true ? 'good' : targetResult.atTarget === false ? 'warn' : 'neutral';
  } else if (targetResult.status === 'familial_type_iii') {
    title = '家族性III型高脂血症 — 一般フロー対象外';
    detail = 'JASの一般的なLDL-C管理目標フローをそのまま当てず、病型に応じて個別に管理します。';
    tone = 'warn';
  } else if (targetResult.status === 'out_of_score_range') {
    if (targetResult.targetReason === 'age_under_40') {
      title = 'modified Hisayama適用外（40歳未満）';
      detail = '40–79歳用の絶対リスク分類は適用せず、生涯リスクや個別背景を踏まえて判断します。';
    } else {
      title = 'modified Hisayama適用外（80歳以上）';
      detail = '40–79歳用の絶対リスク分類は適用せず、全身状態・フレイル等を含めて個別化します。';
    }
    tone = 'neutral';
  } else {
    const waiting = {
      familial_status_needed: 'FH／家族性III型高脂血症の既知診断を確認してください。',
      fh_secondary_status_needed: 'FHのLDL-C目標は一次予防か二次予防かで変わります。',
      secondary_status_needed: '脂質二次予防に該当する疾患の有無を確認してください。',
      secondary_strictness_unresolved: '二次予防の厳格化条件を確認するとLDL-C目標が確定します。',
      diabetes_status_unresolved: '糖尿病診断の確定状況で脂質ルーティングが変わるため確認待ちです。',
      diabetes_pad_status_needed: '糖尿病ではPADの有無でLDL-C目標が変わります。',
      diabetes_microvascular_status_needed: '糖尿病細小血管症の有無でLDL-C目標が変わります。',
      ckd_status_needed: 'CKDの既知診断を確認してください。',
      pad_status_needed: 'PADの有無でリスク分類が変わります。',
    };
    detail = waiting[targetResult.targetReason] || '判定に必要な情報を入力してください。';
    tone = 'warn';
  }

  if (targetResult.ldl180Guard) {
    detail += ' LDL-C 180 mg/dL以上では通常のrisk分類とは別に薬物療法を考慮し、FHも検討します。';
    if (tone === 'good') tone = 'warn';
  }

  const tgParts = [];
  if (tgResult.tg !== null) {
    const sampleLabel = tgResult.fastingKnown ? '空腹時' : '随時扱い';
    tgParts.push(
      `TG ${tgResult.tg} mg/dL（${sampleLabel}、目標 <${tgResult.tgThreshold}）${tgResult.tgAboveTarget ? '：目標以上' : '：目標内'}`,
    );
  }
  if (tgResult.hdl !== null) {
    tgParts.push(
      `HDL-C ${tgResult.hdl} mg/dL（目標 ≥${LIPID_TARGETS.hdlMinimum}）${tgResult.hdlBelowTarget ? '：低値' : '：目標内'}`,
    );
  }

  return {
    ...targetResult,
    title,
    detail,
    tone,
    tgTitle: tgParts.length ? 'TG / HDL-C' : 'TG / HDL-C入力待ち',
    tgDetail: tgParts.length ? tgParts.join('。') + '。' : 'TGまたはHDL-Cを入力してください。',
    tgTone: tgResult.tgAboveTarget === true || tgResult.hdlBelowTarget === true ? 'warn' :
      (tgResult.tgAboveTarget === false || tgResult.hdlBelowTarget === false) ? 'good' : 'neutral',
    showSecondaryQuestion: questionState.showSecondaryQuestion,
    showSecondarySubtypeQuestion: questionState.showSecondarySubtypeQuestion,
    showSecondaryCombinedQuestion: questionState.showSecondaryCombinedQuestion,
    showPadQuestion: questionState.showPadQuestion,
    showDiabeticMicrovascularQuestion: questionState.showDiabeticMicrovascularQuestion,
    showLipidTgFastingQuestion: false,
  };
}

export function evaluateUricAcid(input) {
  const ua = toNumber(input.uricAcid);
  const treated = Boolean(input.urateTreatment);
  const gout = input.goutPresent;
  const stone = input.urinaryStone;
  const otherComplication = input.otherUrateComplication;

  if (ua === null) {
    return {
      id: treated ? 'treated_needs_ua' : 'pending',
      title: treated ? '尿酸降下薬治療中 — 尿酸値入力待ち' : '入力待ち',
      detail: treated ? '現在の尿酸値を入力すると治療目標との位置づけを表示します。' : '尿酸値を入力してください。',
      tone: 'neutral',
      showContextQuestions: false,
      showComplicationQuestion: false,
    };
  }

  const showContextQuestions = !treated && ua > URIC_ACID_THRESHOLDS.hyperuricemiaExclusive;

  if (treated) {
    if (ua <= URIC_ACID_THRESHOLDS.treatmentTarget) {
      return {
        id: 'treated_at_target',
        title: '尿酸降下薬治療中 — 参考目標内',
        detail: `尿酸 ${ua.toFixed(1)} mg/dL。ガイドライン上の参考目標（6.0 mg/dL以下）の範囲内です。`,
        tone: 'good',
        showContextQuestions,
        showComplicationQuestion: false,
      };
    }
    return {
      id: 'treated_above_target',
      title: '尿酸降下薬治療中 — 参考目標を上回る',
      detail: `尿酸 ${ua.toFixed(1)} mg/dL。ガイドライン上の参考目標（6.0 mg/dL以下）を上回ります。治療内容の調整要否は病型・合併症等を踏まえて臨床判断します。`,
      tone: 'warn',
      showContextQuestions,
      showComplicationQuestion: false,
    };
  }

  if (ua <= URIC_ACID_THRESHOLDS.hyperuricemiaExclusive) {
    return {
      id: 'no_hyperuricemia',
      title: '高尿酸血症なし',
      detail: `尿酸 ${ua.toFixed(1)} mg/dL。高尿酸血症の定義（7.0 mg/dL超）には該当しません。`,
      tone: 'good',
      showContextQuestions: false,
      showComplicationQuestion: false,
    };
  }

  if (gout === true) {
    return {
      id: 'gout_branch',
      title: '痛風関連高尿酸血症',
      detail: `尿酸 ${ua.toFixed(1)} mg/dL。痛風を伴うため尿酸降下療法がガイドライン上支持される分岐です。参考目標は6.0 mg/dL以下です。`,
      tone: 'bad',
      showContextQuestions: true,
      showComplicationQuestion: false,
    };
  }

  if (ua >= URIC_ACID_THRESHOLDS.noComplicationConsideration) {
    return {
      id: 'asymptomatic_ge9',
      title: gout === false ? '無症候性高尿酸血症 — 薬物療法を考慮' : '高尿酸血症 — 薬物療法を考慮',
      detail: `尿酸 ${ua.toFixed(1)} mg/dL。9.0 mg/dL以上では合併症の有無にかかわらず尿酸降下薬による治療を考慮する範囲です。痛風歴があれば治療文脈と目標の表示を更新します。自動的な投薬適応ではありません。`,
      tone: 'warn',
      showContextQuestions: true,
      showComplicationQuestion: false,
    };
  }

  if (gout === null || gout === undefined) {
    return {
      id: 'needs_gout',
      title: '高尿酸血症 — 痛風歴確認待ち',
      detail: `尿酸 ${ua.toFixed(1)} mg/dL。痛風発作または痛風結節の有無で治療分岐が変わります。`,
      tone: 'warn',
      showContextQuestions: true,
      showComplicationQuestion: false,
    };
  }

  if (ua >= URIC_ACID_THRESHOLDS.complicationConsideration) {
    const knownComplication =
      Boolean(input.diagnosedDiabetes) ||
      Boolean(input.antihypertensiveTreatment) ||
      Boolean(input.diagnosedCkd) ||
      stone === true ||
      otherComplication === true;
    const complicationResolved = knownComplication || (stone === false && otherComplication === false);
    const showComplicationQuestion =
      !input.diagnosedDiabetes &&
      !input.antihypertensiveTreatment &&
      !input.diagnosedCkd &&
      stone !== true;

    if (!complicationResolved) {
      return {
        id: 'needs_complication',
        title: '無症候性高尿酸血症 — 合併症確認待ち',
        detail: `尿酸 ${ua.toFixed(1)} mg/dL。8.0–8.9 mg/dLでは関連合併症の有無で薬物療法を考慮するかが変わります。`,
        tone: 'warn',
        showContextQuestions: true,
        showComplicationQuestion,
      };
    }

    if (knownComplication) {
      return {
        id: 'asymptomatic_ge8_with_complication',
        title: '無症候性高尿酸血症 — 薬物療法を考慮',
        detail: `尿酸 ${ua.toFixed(1)} mg/dL。関連合併症を伴うため8.0 mg/dL以上では尿酸降下薬による治療を考慮する範囲です。合併症ごとの予後改善エビデンスは同等ではなく、自動的な投薬適応ではありません。`,
        tone: 'warn',
        showContextQuestions: true,
        showComplicationQuestion,
      };
    }

    return {
      id: 'asymptomatic_8_without_complication',
      title: '無症候性高尿酸血症',
      detail: `尿酸 ${ua.toFixed(1)} mg/dL。関連合併症を認めないため、9.0 mg/dL未満では生活習慣・併存疾患の管理を基本とします。`,
      tone: 'warn',
      showContextQuestions: true,
      showComplicationQuestion,
    };
  }

  return {
    id: 'asymptomatic_7_to_8',
    title: '無症候性高尿酸血症',
    detail: `尿酸 ${ua.toFixed(1)} mg/dL。8.0 mg/dL未満では、痛風がなければ生活習慣・併存疾患の管理を基本とします。`,
    tone: 'warn',
    showContextQuestions: true,
    showComplicationQuestion: false,
  };
}

export function classifySld(input, cmrf) {
  if (input.steatosis === null || input.steatosis === undefined || input.steatosis === '') return { id: 'pending', title: '判定保留', detail: '肝脂肪化の有無を入力してください。' };
  if (input.steatosis === false || input.steatosis === 'false') return { id: 'no_sld', title: '肝脂肪化なし', detail: '現在の入力ではSLD分類の対象外です。' };

  const sex = input.sex;
  const alcohol = toNumber(input.alcoholGWeek);
  if (!sex || !MASLD_THRESHOLDS.alcohol[sex]) return { id: 'pending', title: '判定保留', detail: '性別を入力してください。' };
  if (alcohol === null || alcohol < 0) return { id: 'pending', title: '判定保留', detail: '純アルコール量（g/週）を入力してください。' };

  const threshold = MASLD_THRESHOLDS.alcohol[sex];
  const coexistence = input.otherCause === true ? ' 他の明確な成因も併存します。' : '';
  if (alcohol > threshold.aldMinExclusive) return { id: 'ald', title: input.otherCause ? 'ALD（他成因併存）' : 'ALD', detail: `飲酒量がALD域です。CMRFの有無にかかわらずアルコール関連肝疾患として評価します。${coexistence}` };

  if (cmrf.hasAny) {
    if (alcohol < threshold.metaldMin) return { id: 'masld', title: input.otherCause ? 'MASLD＋特定成因併存' : 'MASLD', detail: `CMRF ${cmrf.count}項目を満たし、飲酒量はMASLD域です。${coexistence}` };
    return { id: 'metald', title: input.otherCause ? 'MetALD＋特定成因併存' : 'MetALD', detail: `CMRF ${cmrf.count}項目を満たし、飲酒量はMetALD域です。${coexistence}` };
  }

  if (cmrf.needsWaist) return { id: 'pending', title: '判定保留', detail: '他のCMRFを認めないため、腹囲を確認するとMASLD分類が確定できます。', missing: ['waist'] };
  if (!cmrf.canRuleOutAll) return { id: 'pending', title: '判定保留', detail: 'CMRF判定に必要な入力が不足しています。', missing: cmrf.unknownKeys };
  if (input.otherCause === true) return { id: 'specific_sld', title: '特定成因SLD', detail: 'CMRFを認めず、ウイルス性・薬剤性など別の明確な成因を伴うSLDとして評価します。' };
  if (alcohol < threshold.metaldMin) return { id: 'cryptogenic', title: '成因不明SLD', detail: 'CMRFを認めず、飲酒量もMASLD域で、他の明確な成因が入力されていません。' };

  return { id: 'unclassified', title: 'SLD（要臨床分類）', detail: 'CMRFを認めず、飲酒量はMetALD域ですがALD域には達していません。本ツールでは自動分類せず臨床判断に戻します。' };
}

export function calculateFib4({ age, ast, alt, plateletsWan }) {
  const a = toNumber(age), av = toNumber(ast), lv = toNumber(alt), p = toNumber(plateletsWan);
  if ([a, av, lv, p].some((v) => v === null || v <= 0)) return null;
  return (a * av) / ((p * 10) * Math.sqrt(lv));
}

export function evaluateFib4(age, score) {
  const a = toNumber(age), s = toNumber(score);
  if (a === null || s === null) return null;
  const lowCutoff = a >= MASLD_THRESHOLDS.fib4.olderAge ? MASLD_THRESHOLDS.fib4.olderLow : MASLD_THRESHOLDS.fib4.standardLow;
  if (s > MASLD_THRESHOLDS.fib4.high) return { id: 'high', label: '高リスク', detail: '高度線維化を疑う範囲です。', secondLineMeaningful: true, lowCutoff };
  if (s >= lowCutoff) return { id: 'intermediate', label: '中間リスク', detail: '二次NITによる線維化評価を検討します。', secondLineMeaningful: true, lowCutoff };
  return { id: 'low', label: '低リスク', detail: '現時点では高度線維化リスクは低い範囲です。', secondLineMeaningful: false, lowCutoff };
}

export function evaluatePlatelets(plateletsWan) {
  const v = toNumber(plateletsWan);
  if (v === null) return null;
  if (v < MASLD_THRESHOLDS.plateletsWan.highRiskBelow) return { id: 'high', label: '高リスク方向', detail: '15万/µL未満' };
  if (v <= MASLD_THRESHOLDS.plateletsWan.lowRiskAbove) return { id: 'intermediate', label: '中間', detail: '15–20万/µL' };
  return { id: 'low', label: '低リスク方向', detail: '20万/µL超' };
}

export function shouldShowNit({ fib4Evaluation, plateletsWan }) {
  const p = toNumber(plateletsWan);
  return Boolean(fib4Evaluation?.secondLineMeaningful || (p !== null && p <= 20));
}

export function interpretNit(input) {
  const results = [];
  const add = (key, label, value, cutoff, unit, f4Cutoff = null) => {
    const n = toNumber(value);
    if (n === null) return;
    if (f4Cutoff !== null && n >= f4Cutoff) {
      results.push({
        key, label, value: n, unit, status: 'f4', severityLabel: 'F4を示唆',
        detail: `F4を示唆する報告カットオフ（${f4Cutoff} ${unit}）以上`
      });
      return;
    }
    if (n >= cutoff) {
      results.push({
        key, label, value: n, unit, status: 'f2', severityLabel: '≥F2を示唆',
        detail: `≥F2を示唆する報告カットオフ（${cutoff} ${unit}）以上`
      });
      return;
    }
    results.push({
      key, label, value: n, unit, status: 'below', severityLabel: 'F2未満',
      detail: `F2相当を示唆する報告カットオフ（${cutoff} ${unit}）未満`
    });
  };

  add('vcte', 'VCTE / FibroScan', input.vcteKpa, NIT_THRESHOLDS.vcteKpa, 'kPa');
  if (input.sweUnit === 'ms') add('swe', 'SWE', input.swe, NIT_THRESHOLDS.sweMs, 'm/s');
  else add('swe', 'SWE', input.swe, NIT_THRESHOLDS.sweKpa, 'kPa');
  add('mre', 'MRE', input.mreKpa, NIT_THRESHOLDS.mreKpa, 'kPa', NIT_THRESHOLDS.mreF4Kpa);
  add('type4', 'IV型コラーゲン7S', input.type4Collagen7s, NIT_THRESHOLDS.type4Collagen7s, 'ng/mL');
  add('m2bpgi', 'M2BPGi', input.m2bpgi, NIT_THRESHOLDS.m2bpgi, 'C.O.I.');

  const elf = toNumber(input.elf);
  if (elf !== null) {
    let detail, status, severityLabel;
    if (elf >= NIT_THRESHOLDS.elfF4) {
      detail = `F4を示唆する報告カットオフ（${NIT_THRESHOLDS.elfF4}）以上`;
      status = 'f4';
      severityLabel = 'F4を示唆';
    } else if (elf < NIT_THRESHOLDS.elfLower) {
      detail = `報告されているF2相当の閾値範囲（約${NIT_THRESHOLDS.elfLower}–${NIT_THRESHOLDS.elfUpper}）未満`;
      status = 'below';
      severityLabel = 'F2未満';
    } else {
      detail = `報告されている≥F2閾値範囲（約${NIT_THRESHOLDS.elfLower}–${NIT_THRESHOLDS.elfUpper}）以上`;
      status = 'f2';
      severityLabel = '≥F2を示唆';
    }
    results.push({ key: 'elf', label: 'ELF', value: elf, unit: '', status, severityLabel, detail });
  }
  return results;
}
