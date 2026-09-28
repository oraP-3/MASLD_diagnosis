// Clinical thresholds: Japanese MASLD diagnostic criteria / MASLD clinical practice guideline 2026.
// Keep thresholds centralized here; authoritative current guidance supersedes repository values.
export const MASLD_THRESHOLDS = Object.freeze({
  bmi: 23,
  waist: { male: 94, female: 80 },
  hba1c: 5.7,
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
  const sbp = toNumber(input.sbp);
  const dbp = toNumber(input.dbp);
  const tg = toNumber(input.tg);
  const hdl = toNumber(input.hdl);

  let body = null;
  if (bmi !== null && bmi >= MASLD_THRESHOLDS.bmi) body = true;
  else if (bmi !== null && bmi < MASLD_THRESHOLDS.bmi && waist !== null && sex && MASLD_THRESHOLDS.waist[sex] !== undefined) body = waist > MASLD_THRESHOLDS.waist[sex];

  let glucose = null;
  if (input.diagnosedDiabetes) glucose = true;
  else if (hba1c !== null) glucose = hba1c >= MASLD_THRESHOLDS.hba1c;

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

  if (hba1c === null) {
    return {
      id: 'pending',
      title: '入力待ち',
      detail: 'HbA1cを入力してください。',
      tone: 'neutral',
      needsGlucoseConfirmation: false,
    };
  }

  if (hba1c < MASLD_THRESHOLDS.hba1c) {
    return {
      id: 'below_masld_cmrf',
      title: 'HbA1cからは糖代謝CMRFなし',
      detail: `HbA1c ${hba1c.toFixed(1)}%。この値単独ではMASLDの糖代謝CMRFには該当しません。`,
      tone: 'good',
      needsGlucoseConfirmation: false,
    };
  }

  if (hba1c < GLYCEMIA_THRESHOLDS.diabeticHba1c) {
    return {
      id: 'masld_glucose_cmrf',
      title: '糖代謝異常 — MASLD CMRF',
      detail: `HbA1c ${hba1c.toFixed(1)}%。MASLDの糖代謝CMRFに該当しますが、HbA1cは糖尿病型（6.5%以上）には達していません。`,
      tone: 'warn',
      needsGlucoseConfirmation: false,
    };
  }

  const fastingGlucose = toNumber(input.fastingGlucose);
  const randomGlucose = toNumber(input.randomGlucose);
  const enteredGlucose = [];
  if (fastingGlucose !== null) enteredGlucose.push(`空腹時血糖 ${fastingGlucose} mg/dL`);
  if (randomGlucose !== null) enteredGlucose.push(`随時血糖 ${randomGlucose} mg/dL`);

  if (enteredGlucose.length === 0) {
    return {
      id: 'hba1c_diabetic_range_needs_glucose',
      title: 'HbA1cは糖尿病型 — 血糖確認待ち',
      detail: `HbA1c ${hba1c.toFixed(1)}%は糖尿病型です。HbA1c単独では診断を確定せず、空腹時または随時血糖による確認が必要です。`,
      tone: 'warn',
      needsGlucoseConfirmation: true,
    };
  }

  const hasDiabeticGlucose =
    (fastingGlucose !== null && fastingGlucose >= GLYCEMIA_THRESHOLDS.fastingGlucose) ||
    (randomGlucose !== null && randomGlucose >= GLYCEMIA_THRESHOLDS.randomGlucose);
  const glucoseSummary = enteredGlucose.join('、');

  if (hasDiabeticGlucose) {
    return {
      id: 'hba1c_and_glucose_diabetic_range',
      title: 'HbA1c・血糖とも糖尿病型',
      detail: `HbA1c ${hba1c.toFixed(1)}%、${glucoseSummary}。入力された血糖値のうち少なくとも一つが糖尿病型です。HbA1cと糖尿病型の血糖値が同一採血で得られた場合は日本糖尿病学会の診断基準を満たします。本ツールでは検査日や症状を保持しないため、最終診断は臨床情報と併せて判断してください。`,
      tone: 'bad',
      needsGlucoseConfirmation: true,
    };
  }

  return {
    id: 'hba1c_diabetic_range_glucose_below',
    title: 'HbA1cは糖尿病型、血糖は糖尿病型未満',
    detail: `HbA1c ${hba1c.toFixed(1)}%は糖尿病型ですが、${glucoseSummary}は糖尿病型の基準未満です。HbA1c単独では診断を確定せず、再検査等を臨床的に検討します。`,
    tone: 'warn',
    needsGlucoseConfirmation: true,
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
      title: '無症候性高尿酸血症 — 薬物療法を考慮',
      detail: `尿酸 ${ua.toFixed(1)} mg/dL。合併症がなくても9.0 mg/dL以上では尿酸降下薬による治療を考慮する範囲です。自動的な投薬適応ではありません。`,
      tone: 'warn',
      showContextQuestions: true,
      showComplicationQuestion: false,
    };
  }

  if (ua >= URIC_ACID_THRESHOLDS.complicationConsideration) {
    const knownComplication =
      Boolean(input.diagnosedDiabetes) ||
      Boolean(input.antihypertensiveTreatment) ||
      stone === true ||
      otherComplication === true;
    const complicationResolved = knownComplication || (stone === false && otherComplication === false);
    const showComplicationQuestion =
      !input.diagnosedDiabetes &&
      !input.antihypertensiveTreatment &&
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
      key, label, value: n, unit, status: 'below', severityLabel: '≥F2未満',
      detail: `≥F2を示唆する報告カットオフ（${cutoff} ${unit}）未満`
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
      detail = `報告されている≥F2閾値範囲（約${NIT_THRESHOLDS.elfLower}–${NIT_THRESHOLDS.elfUpper}）未満`;
      status = 'below';
      severityLabel = '≥F2未満';
    } else {
      detail = `報告されている≥F2閾値範囲（約${NIT_THRESHOLDS.elfLower}–${NIT_THRESHOLDS.elfUpper}）以上`;
      status = 'f2';
      severityLabel = '≥F2を示唆';
    }
    results.push({ key: 'elf', label: 'ELF', value: elf, unit: '', status, severityLabel, detail });
  }
  return results;
}
