import {
  classifySld,
  calculateFib4,
  deriveCmrf,
  evaluateFib4,
  evaluateGlycemia,
  evaluateLipidTriglycerides,
  evaluatePlatelets,
  evaluateUricAcid,
  interpretNit,
  shouldShowNit,
  summarizeBloodPressure,
  summarizeLipids,
  toNumber,
} from './clinical-rules.js';

export const UNIFIED_RESULT_VERSION = '1';

export const MISSING_DATA_CLASS = Object.freeze({
  required: 'required',
  nextEvaluation: 'next_evaluation',
});

const DOMAIN_ORDER = Object.freeze([
  'sld',
  'fibrosis',
  'blood_pressure',
  'lipids',
  'glycemia',
  'uric_acid',
]);

const LABELS = Object.freeze({
  age: '年齢',
  sex: '性別',
  bmi: 'BMI',
  waist: '腹囲',
  steatosis: '肝脂肪化',
  alcohol: '純アルコール量',
  blood_pressure: '診察室血圧',
  glycemia_measurement: 'HbA1c / 空腹時血糖',
  hba1c: 'HbA1c',
  diabetes_confirmation: '糖尿病型の確認',
  familial_lipid_status: '既知FH / 家族性III型高脂血症',
  lipid_secondary_prevention: '脂質二次予防の該当歴',
  lipid_acs: '急性冠症候群（ACS）の既往',
  lipid_combined_vascular: '冠動脈疾患＋該当脳梗塞の併存',
  pad: '末梢動脈疾患（PAD）',
  diabetic_microvascular: '糖尿病細小血管症',
  ckd_status: 'CKD診断',
  ldl: 'LDL-C',
  hdl: 'HDL-C',
  tg: '中性脂肪',
  tg_fasting_status: 'TGの採血条件',
  bp_cvd_history: '脳・心血管疾患既往',
  atrial_fibrillation: '心房細動',
  proteinuria: '蛋白尿',
  bp_persistence: '血圧高値の持続確認',
  ast: 'AST',
  alt: 'ALT',
  platelets: '血小板',
  second_line_fibrosis_nit: '二次NIT',
  uric_acid: '尿酸',
  gout: '痛風歴',
  urinary_stone: '尿路結石歴',
  urate_other_complication: '高尿酸血症の関連合併症',
});

function missingItem(key, dataClass, domain, reason) {
  return {
    key,
    class: dataClass,
    label: LABELS[key] || key,
    domain,
    reason,
  };
}

function fact(key, label, value, tone = 'neutral') {
  return { key, label, value: String(value), tone };
}

function numericFact(key, label, raw, suffix = '', tone = 'neutral') {
  const value = toNumber(raw);
  return value === null ? null : fact(key, label, `${value}${suffix}`, tone);
}

function compactFacts(items) {
  return items.filter(Boolean);
}

function sldTone(id) {
  if (['masld', 'no_sld'].includes(id)) return 'good';
  if (['ald', 'specific_sld'].includes(id)) return 'bad';
  if (['metald', 'pending', 'cryptogenic', 'unclassified'].includes(id)) return 'warn';
  return 'neutral';
}

function fibrosisTone(id) {
  if (id === 'low') return 'good';
  if (id === 'intermediate') return 'warn';
  if (id === 'high') return 'bad';
  return 'neutral';
}

const BP_RISK_LABELS = Object.freeze({
  low: '低リスク',
  moderate: '中等リスク',
  high: '高リスク',
});

const HISAYAMA_RISK_LABELS = Object.freeze({
  low: '低リスク',
  intermediate: '中リスク',
  high: '高リスク',
});

function compactGlycemiaDetail(result) {
  const details = {
    known_diabetes_general_target:
      '一般的な合併症予防目標（HbA1c 7.0%未満）の範囲内です。実際の目標は年齢・罹病期間・合併症・低血糖リスク等で個別化します。',
    known_diabetes_above_general_target:
      '一般的な合併症予防目標（HbA1c 7.0%未満）を上回ります。実際の目標は個別背景を踏まえて設定します。',
    hba1c_and_glucose_diabetic_range:
      'HbA1cと入力血糖の少なくとも一つが糖尿病型です。同一採血で得られた場合は日本糖尿病学会の診断基準を満たします。最終診断は臨床情報と併せて判断してください。',
    hba1c_diabetic_range_needs_glucose:
      'HbA1cは糖尿病型です。HbA1c単独では診断を確定せず、血糖値による確認が必要です。',
    hba1c_diabetic_range_glucose_below:
      'HbA1cは糖尿病型ですが、入力血糖は糖尿病型未満です。HbA1c単独では診断を確定せず、再検査等を臨床的に検討します。',
    fasting_glucose_diabetic_range_repeat_confirmed:
      '空腹時血糖は糖尿病型で、別日に糖尿病型を再確認済みのため診断基準を満たします。最終診断は症状や臨床経過も含めて判断してください。',
    fasting_glucose_diabetic_range_needs_confirmation:
      '空腹時血糖は糖尿病型です。1回のみでは本ツール上は診断を確定せず、別日の糖尿病型確認や症状等を含めて臨床判断します。',
    masld_glucose_cmrf:
      'MASLDの糖代謝CMRFに該当します。現在の入力では糖尿病型の基準には達していません。',
    below_masld_cmrf:
      'MASLDの糖代謝CMRFには該当しません。',
  };
  return details[result.id] || result.detail;
}

function compactUricAcidDetail(result) {
  return result.detail.replace(/^尿酸 [0-9.]+ mg\/dL。\s*/, '');
}

function lipidContextLabel(result) {
  switch (result.targetReason) {
    case 'fh_primary': return '既知FH・一次予防';
    case 'fh_secondary': return '既知FH・二次予防';
    case 'secondary_base': return '二次予防';
    case 'secondary_strict':
      if (result.strictReason === 'diabetes') return '二次予防＋糖尿病';
      if (result.strictReason === 'acute_coronary_syndrome') return '二次予防＋ACS';
      return '冠動脈疾患＋該当脳梗塞';
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
    default: return result.title;
  }
}

function compactLipidInterpretation(result, input) {
  if (result.status !== 'target_set') {
    return { title: result.title, detail: result.detail };
  }

  const tgResult = evaluateLipidTriglycerides(input);
  const parts = [];
  const strict = result.targetReason === 'diabetes_strict';

  if (result.ldl !== null) {
    if (strict) {
      parts.push(result.atTarget
        ? 'LDL-C：厳格化目標内'
        : `LDL-C：<${result.target} mg/dLへの厳格化を考慮`);
    } else {
      parts.push(result.atTarget
        ? 'LDL-C：目標内'
        : `LDL-C：目標未達（目標 <${result.target} mg/dL）`);
    }
  } else {
    parts.push(strict
      ? `LDL-C：未入力（<${result.target} mg/dLへの厳格化を考慮）`
      : `LDL-C：未入力（目標 <${result.target} mg/dL）`);
  }

  if (tgResult.tg !== null) {
    parts.push(tgResult.tgAboveTarget
      ? `TG：目標未達（<${tgResult.tgThreshold} mg/dL）`
      : 'TG：目標内');
  }

  if (tgResult.hdl !== null) {
    parts.push(tgResult.hdlBelowTarget
      ? 'HDL-C：低値（<40 mg/dL）'
      : 'HDL-C：基準内');
  }

  return {
    title: lipidContextLabel(result),
    detail: parts.join(' / '),
  };
}

function mapCmrfMissing(input, cmrf, suggestions) {
  for (const key of cmrf.unknownKeys) {
    if (key === 'body') {
      if (toNumber(input.bmi) === null) {
        suggestions.push(missingItem('bmi', MISSING_DATA_CLASS.required, 'sld', '体格CMRFを判定するため'));
      } else if (cmrf.needsWaist) {
        suggestions.push(missingItem('waist', MISSING_DATA_CLASS.required, 'sld', '腹囲のみでMASLD分類が変わり得るため'));
      }
    }
    if (key === 'glucose') {
      suggestions.push(missingItem('glycemia_measurement', MISSING_DATA_CLASS.required, 'sld', '糖代謝CMRFの有無でSLD分類が変わり得るため'));
    }
    if (key === 'bp') {
      suggestions.push(missingItem('blood_pressure', MISSING_DATA_CLASS.required, 'sld', '血圧CMRFの有無でSLD分類が変わり得るため'));
    }
    if (key === 'tg') {
      suggestions.push(missingItem('tg', MISSING_DATA_CLASS.required, 'sld', '中性脂肪CMRFの有無でSLD分類が変わり得るため'));
    }
    if (key === 'hdl') {
      suggestions.push(missingItem('hdl', MISSING_DATA_CLASS.required, 'sld', 'HDL-C CMRFの有無でSLD分類が変わり得るため'));
    }
  }
}

function buildSldDomain(input) {
  const cmrf = deriveCmrf(input);
  const result = classifySld(input, cmrf);
  const suggestions = [];

  const steatosisUnknown =
    input.steatosis === null ||
    input.steatosis === undefined ||
    input.steatosis === '';

  if (steatosisUnknown) {
    suggestions.push(missingItem('steatosis', MISSING_DATA_CLASS.required, 'sld', 'SLD分類の入口を確定するため'));
  } else if (input.steatosis === true || input.steatosis === 'true') {
    if (!['male', 'female'].includes(input.sex)) {
      suggestions.push(missingItem('sex', MISSING_DATA_CLASS.required, 'sld', '飲酒量閾値と一部CMRF判定に必要なため'));
    }
    if (toNumber(input.alcoholGWeek) === null) {
      suggestions.push(missingItem('alcohol', MISSING_DATA_CLASS.required, 'sld', 'MASLD / MetALD / ALD分類に必要なため'));
    }

    if (result.id === 'pending' && Array.isArray(result.missing)) {
      if (result.missing.includes('waist')) {
        suggestions.push(missingItem('waist', MISSING_DATA_CLASS.required, 'sld', '腹囲のみでMASLD分類が変わり得るため'));
      } else {
        mapCmrfMissing(input, cmrf, suggestions);
      }
    }
  }

  const facts = compactFacts([
    !steatosisUnknown ? fact('steatosis', '肝脂肪化', input.steatosis === true || input.steatosis === 'true' ? 'あり' : 'なし') : null,
    numericFact('alcohol', '純アルコール量', input.alcoholGWeek, ' g/週'),
    result.id !== 'pending' && (input.steatosis === true || input.steatosis === 'true')
      ? fact('cmrf_count', 'CMRF', `${cmrf.count}項目`)
      : null,
  ]);

  return {
    key: 'sld',
    label: 'SLD分類',
    facts,
    interpretation: {
      id: result.id,
      title: result.title,
      detail: result.detail,
      tone: sldTone(result.id),
    },
    nextAction: null,
    suggestions,
  };
}

function buildFibrosisDomain(input) {
  const fib4 = calculateFib4(input);
  const fib4Evaluation = fib4 === null ? null : evaluateFib4(input.age, fib4);
  const plateletEvaluation = evaluatePlatelets(input.plateletsWan);
  const nitResults = interpretNit(input);
  const suggestions = [];

  if (fib4 === null) {
    const age = toNumber(input.age);
    const ast = toNumber(input.ast);
    const alt = toNumber(input.alt);
    const platelets = toNumber(input.plateletsWan);
    if (age === null || age <= 0) suggestions.push(missingItem('age', MISSING_DATA_CLASS.required, 'fibrosis', 'FIB-4計算に有効な年齢が必要なため'));
    if (ast === null || ast <= 0) suggestions.push(missingItem('ast', MISSING_DATA_CLASS.required, 'fibrosis', 'FIB-4計算に有効なASTが必要なため'));
    if (alt === null || alt <= 0) suggestions.push(missingItem('alt', MISSING_DATA_CLASS.required, 'fibrosis', 'FIB-4計算に有効なALTが必要なため'));
    if (platelets === null || platelets <= 0) suggestions.push(missingItem('platelets', MISSING_DATA_CLASS.required, 'fibrosis', 'FIB-4計算と補助評価に有効な血小板値が必要なため'));
  }

  const secondLineMeaningful = shouldShowNit({
    fib4Evaluation,
    plateletsWan: input.plateletsWan,
  });
  if (fib4Evaluation && secondLineMeaningful && nitResults.length === 0) {
    suggestions.push(missingItem(
      'second_line_fibrosis_nit',
      MISSING_DATA_CLASS.nextEvaluation,
      'fibrosis',
      'FIB-4または血小板から追加の線維化評価に意味があるため',
    ));
  }

  const plateletText = plateletEvaluation
    ? `血小板：${plateletEvaluation.label}（${plateletEvaluation.detail}）`
    : '';
  const detail = fib4Evaluation
    ? [fib4Evaluation.detail, plateletText].filter(Boolean).join(' ')
    : '年齢・AST・ALT・血小板が揃うとFIB-4を評価できます。';

  let nextAction = null;
  if (fib4Evaluation && secondLineMeaningful && nitResults.length === 0) {
    nextAction = {
      title: '二次NITによる評価を検討',
      detail: '利用可能なエラストグラフィまたは血清NITで線維化リスクを追加評価します。',
      tone: 'warn',
    };
  }

  const facts = compactFacts([
    fib4 !== null ? fact('fib4', 'FIB-4', fib4.toFixed(2)) : null,
    numericFact('platelets', '血小板', input.plateletsWan, ' 万/µL'),
    ...nitResults.map((item) => fact(
      `nit_${item.key}`,
      item.label,
      `${item.value}${item.unit ? ` ${item.unit}` : ''}（${item.severityLabel}）`,
    )),
  ]);

  return {
    key: 'fibrosis',
    label: '肝線維化',
    facts,
    interpretation: {
      id: fib4Evaluation?.id || 'pending',
      title: fib4Evaluation ? fib4Evaluation.label : 'FIB-4判定待ち',
      detail,
      tone: fibrosisTone(fib4Evaluation?.id),
    },
    nextAction,
    suggestions,
  };
}

function addBpMissingFromLabel(input, label, suggestions) {
  if (label === '年齢') suggestions.push(missingItem('age', MISSING_DATA_CLASS.required, 'blood_pressure', '血圧リスク判定に必要なため'));
  if (label === '性別') suggestions.push(missingItem('sex', MISSING_DATA_CLASS.required, 'blood_pressure', '血圧リスク判定に必要なため'));
  if (label === '脳・心血管疾患既往') suggestions.push(missingItem('bp_cvd_history', MISSING_DATA_CLASS.required, 'blood_pressure', '高リスク背景の有無で対応が変わり得るため'));
  if (label === '心房細動') suggestions.push(missingItem('atrial_fibrillation', MISSING_DATA_CLASS.required, 'blood_pressure', '高リスク背景の有無で対応が変わり得るため'));
  if (label === '蛋白尿') suggestions.push(missingItem('proteinuria', MISSING_DATA_CLASS.required, 'blood_pressure', 'CKDの高リスク判定で対応が変わり得るため'));
  if (label === 'TGの採血条件') suggestions.push(missingItem('tg_fasting_status', MISSING_DATA_CLASS.required, 'blood_pressure', 'JSHリスク判定が空腹時かどうかで変わり得るため'));
  if (label === 'LDL-C / HDL-C / TG') {
    if (toNumber(input.ldl) === null) suggestions.push(missingItem('ldl', MISSING_DATA_CLASS.required, 'blood_pressure', '脂質異常症のリスク因子判定に必要なため'));
    if (toNumber(input.hdl) === null) suggestions.push(missingItem('hdl', MISSING_DATA_CLASS.required, 'blood_pressure', '脂質異常症のリスク因子判定に必要なため'));
    if (toNumber(input.tg) === null) suggestions.push(missingItem('tg', MISSING_DATA_CLASS.required, 'blood_pressure', '脂質異常症のリスク因子判定に必要なため'));
  }
}

function buildBloodPressureDomain(input) {
  const result = summarizeBloodPressure(input);
  const suggestions = [];

  if (!result.category) {
    suggestions.push(missingItem('blood_pressure', MISSING_DATA_CLASS.required, 'blood_pressure', '診察室血圧の分類に必要なため'));
  } else {
    for (const label of result.missing || []) {
      if (label !== '血圧高値の持続確認') addBpMissingFromLabel(input, label, suggestions);
    }
    if (result.showPersistenceQuestion && !result.persistenceConfirmed) {
      suggestions.push(missingItem(
        'bp_persistence',
        MISSING_DATA_CLASS.nextEvaluation,
        'blood_pressure',
        '家庭血圧または別日の診察室血圧で高値の持続を確認するため',
      ));
    }
  }

  const sbp = toNumber(input.sbp);
  const dbp = toNumber(input.dbp);
  const facts = compactFacts([
    sbp !== null && dbp !== null
      ? fact(
          'office_bp',
          '診察室血圧',
          `${sbp}/${dbp} mmHg`,
          result.timingClass === 'treated_above_target' ? 'bad' : 'neutral',
        )
      : null,
    BP_RISK_LABELS[result.riskLevel]
      ? fact('bp_risk', 'リスク', BP_RISK_LABELS[result.riskLevel])
      : null,
  ]);

  return {
    key: 'blood_pressure',
    label: '血圧',
    facts,
    interpretation: {
      id: result.category?.id || 'pending',
      title: result.category?.label || '入力待ち',
      detail: result.classificationDetail,
      tone: !result.category
        ? 'neutral'
        : result.category.id === 'grade3'
          ? 'bad'
          : ['elevated', 'grade1', 'grade2'].includes(result.category.id)
            ? 'warn'
            : 'good',
    },
    nextAction: result.showAction
      ? {
          title: result.actionTitle,
          detail: result.actionDetail,
          tone: result.actionTone,
        }
      : null,
    suggestions,
  };
}

function mapLipidRouteMissing(input, result, suggestions) {
  for (const key of result.route?.missing || []) {
    if (key === 'age') suggestions.push(missingItem('age', MISSING_DATA_CLASS.required, 'lipids', '脂質リスク分類に必要なため'));
    if (key === 'sex') suggestions.push(missingItem('sex', MISSING_DATA_CLASS.required, 'lipids', 'modified Hisayama計算に必要なため'));
    if (key === 'sbp') suggestions.push(missingItem('blood_pressure', MISSING_DATA_CLASS.required, 'lipids', 'modified Hisayama計算に収縮期血圧が必要なため'));
    if (key === 'ldl') suggestions.push(missingItem('ldl', MISSING_DATA_CLASS.required, 'lipids', 'modified Hisayama計算に必要なため'));
    if (key === 'hdl') suggestions.push(missingItem('hdl', MISSING_DATA_CLASS.required, 'lipids', 'modified Hisayama計算に必要なため'));
    if (key === 'glucose_abnormality') suggestions.push(missingItem('glycemia_measurement', MISSING_DATA_CLASS.required, 'lipids', 'modified Hisayamaの糖代謝項目判定に必要なため'));
    if (key === 'diabetes_status' || key === 'diabetes_confirmation') suggestions.push(missingItem('diabetes_confirmation', MISSING_DATA_CLASS.required, 'lipids', '糖尿病の確定状況で脂質リスク経路が変わるため'));
    if (key === 'diagnosed_ckd') suggestions.push(missingItem('ckd_status', MISSING_DATA_CLASS.required, 'lipids', 'CKDの有無で脂質リスク経路が変わるため'));
    if (key === 'pad') suggestions.push(missingItem('pad', MISSING_DATA_CLASS.required, 'lipids', 'PADの有無で脂質リスク経路が変わるため'));
  }
}

function buildLipidsDomain(input) {
  const result = summarizeLipids(input);
  const suggestions = [];

  if (result.targetReason === 'familial_status_needed') {
    suggestions.push(missingItem('familial_lipid_status', MISSING_DATA_CLASS.required, 'lipids', '一般リスク経路を使用できるか確認するため'));
  }
  if (['fh_secondary_status_needed', 'secondary_status_needed'].includes(result.targetReason)) {
    suggestions.push(missingItem('lipid_secondary_prevention', MISSING_DATA_CLASS.required, 'lipids', '一次予防か二次予防かでLDL-C目標が変わるため'));
  }
  if (result.targetReason === 'secondary_strictness_unresolved') {
    if (result.showSecondarySubtypeQuestion && (input.acuteCoronarySyndrome === null || input.acuteCoronarySyndrome === undefined)) {
      suggestions.push(missingItem('lipid_acs', MISSING_DATA_CLASS.required, 'lipids', '二次予防のLDL-C目標を<70 mg/dLへ厳格化する条件のため'));
    } else if (result.showSecondaryCombinedQuestion && (input.combinedCadAtherothromboticStroke === null || input.combinedCadAtherothromboticStroke === undefined)) {
      suggestions.push(missingItem('lipid_combined_vascular', MISSING_DATA_CLASS.required, 'lipids', '二次予防のLDL-C目標を<70 mg/dLへ厳格化する条件のため'));
    } else {
      suggestions.push(missingItem('diabetes_confirmation', MISSING_DATA_CLASS.required, 'lipids', '糖尿病の確定状況で二次予防目標が変わるため'));
    }
  }
  if (result.targetReason === 'diabetes_status_unresolved') {
    suggestions.push(missingItem('diabetes_confirmation', MISSING_DATA_CLASS.required, 'lipids', '糖尿病の確定状況で脂質リスク経路が変わるため'));
  }
  if (result.targetReason === 'diabetes_pad_status_needed' || result.targetReason === 'pad_status_needed') {
    suggestions.push(missingItem('pad', MISSING_DATA_CLASS.required, 'lipids', 'PADの有無でLDL-C目標またはリスク区分が変わるため'));
  }
  if (result.targetReason === 'diabetes_microvascular_status_needed') {
    suggestions.push(missingItem('diabetic_microvascular', MISSING_DATA_CLASS.required, 'lipids', '糖尿病で<100 mg/dLへの厳格化を考慮する条件のため'));
  }
  if (result.targetReason === 'ckd_status_needed') {
    suggestions.push(missingItem('ckd_status', MISSING_DATA_CLASS.required, 'lipids', 'CKDの有無で高リスク経路が変わるため'));
  }

  mapLipidRouteMissing(input, result, suggestions);

  if (result.status === 'target_set' && result.ldl === null) {
    suggestions.push(missingItem('ldl', MISSING_DATA_CLASS.required, 'lipids', 'LDL-C目標の達成状況と介入要否を評価するため'));
  }
  if (result.status !== 'familial_type_iii') {
    if (toNumber(input.tg) === null) {
      suggestions.push(missingItem('tg', MISSING_DATA_CLASS.required, 'lipids', 'TG目標との位置づけを評価するため'));
    }
    if (toNumber(input.hdl) === null) {
      suggestions.push(missingItem('hdl', MISSING_DATA_CLASS.required, 'lipids', 'HDL-C低値の有無を評価するため'));
    }
  }

  let nextAction = null;
  if (result.ldl180Guard) {
    nextAction = {
      title: 'LDL-C 180 mg/dL以上',
      detail: '通常のrisk分類とは別に薬物療法を考慮し、FHも検討します。',
      tone: 'warn',
    };
  } else if (result.status === 'target_set' && result.atTarget === false) {
    nextAction = {
      title: input.lipidTreatment ? '脂質低下療法を再評価' : 'LDL-C管理介入を検討',
      detail: input.lipidTreatment
        ? '治療強化の要否を臨床的に検討します。'
        : '目標達成に向けた生活習慣介入・薬物療法の要否を臨床的に検討します。',
      tone: 'warn',
    };
  }

  const tgResult = evaluateLipidTriglycerides(input);
  const display = compactLipidInterpretation(result, input);
  const facts = compactFacts([
    numericFact('hdl', 'HDL-C', input.hdl, ' mg/dL', tgResult.hdlBelowTarget === true ? 'bad' : 'neutral'),
    numericFact('ldl', 'LDL-C', input.ldl, ' mg/dL', result.atTarget === false ? 'bad' : 'neutral'),
    numericFact('tg', '中性脂肪', input.tg, ' mg/dL', tgResult.tgAboveTarget === true ? 'bad' : 'neutral'),
    result.route?.score !== null && result.route?.score !== undefined
      ? fact(
          'modified_hisayama',
          'modified Hisayama',
          `${result.route.score}点 / ${HISAYAMA_RISK_LABELS[result.route.riskClass] || result.route.riskClass}`,
        )
      : null,
  ]);

  return {
    key: 'lipids',
    label: '脂質',
    facts,
    interpretation: {
      id: result.targetReason || result.status,
      title: display.title,
      detail: display.detail,
      tone: result.tone === 'bad' || result.tgTone === 'bad'
        ? 'bad'
        : result.tone === 'warn' || result.tgTone === 'warn'
          ? 'warn'
          : result.tone === 'good' || result.tgTone === 'good'
            ? 'good'
            : 'neutral',
    },
    nextAction,
    suggestions,
  };
}

function buildGlycemiaDomain(input) {
  const result = evaluateGlycemia(input);
  const suggestions = [];

  if (result.id === 'pending') {
    suggestions.push(missingItem('glycemia_measurement', MISSING_DATA_CLASS.required, 'glycemia', '糖代謝評価にHbA1cまたは空腹時血糖が必要なため'));
  }
  if (result.id === 'known_diabetes_no_hba1c') {
    suggestions.push(missingItem('hba1c', MISSING_DATA_CLASS.required, 'glycemia', '糖尿病のコントロール状況を一般目標と比較するため'));
  }
  if (result.needsGlucoseConfirmation) {
    suggestions.push(missingItem('diabetes_confirmation', MISSING_DATA_CLASS.required, 'glycemia', '糖尿病型HbA1cを血糖または再検で確認するため'));
  }
  if (
    result.id === 'fasting_glucose_diabetic_range_needs_confirmation' &&
    input.separateDayDiabeticTypeConfirmed !== true
  ) {
    suggestions.push(missingItem('diabetes_confirmation', MISSING_DATA_CLASS.required, 'glycemia', '空腹時血糖の糖尿病型を別日等で確認するため'));
  }

  let nextAction = null;
  if (result.id === 'known_diabetes_above_general_target') {
    nextAction = {
      title: '糖尿病治療目標を再評価',
      detail: '個別目標・低血糖リスク・合併症を踏まえて治療強化の要否を判断します。',
      tone: 'warn',
    };
  }

  const facts = compactFacts([
    numericFact(
      'hba1c',
      'HbA1c',
      input.hba1c,
      '%',
      result.id === 'known_diabetes_above_general_target' ? 'bad' : 'neutral',
    ),
    numericFact('fasting_glucose', '空腹時血糖', input.fastingGlucose, ' mg/dL'),
    numericFact('random_glucose', '随時血糖', input.randomGlucose, ' mg/dL'),
  ]);

  return {
    key: 'glycemia',
    label: '糖代謝',
    facts,
    interpretation: {
      id: result.id,
      title: result.title,
      detail: compactGlycemiaDetail(result),
      tone: result.tone,
    },
    nextAction,
    suggestions,
  };
}

function buildUricAcidDomain(input) {
  const result = evaluateUricAcid(input);
  const suggestions = [];
  const ua = toNumber(input.uricAcid);

  if (['pending', 'treated_needs_ua'].includes(result.id)) {
    suggestions.push(missingItem('uric_acid', MISSING_DATA_CLASS.required, 'uric_acid', '高尿酸血症または治療目標との位置づけを評価するため'));
  }
  if (result.id === 'needs_gout') {
    suggestions.push(missingItem('gout', MISSING_DATA_CLASS.required, 'uric_acid', '痛風の有無で尿酸降下療法の分岐が変わるため'));
  }
  if (result.id === 'needs_complication') {
    if (input.urinaryStone === null || input.urinaryStone === undefined) {
      suggestions.push(missingItem('urinary_stone', MISSING_DATA_CLASS.required, 'uric_acid', '尿酸8.0–8.9 mg/dLでは関連合併症として治療考慮が変わるため'));
    }
    if (
      input.otherUrateComplication === null ||
      input.otherUrateComplication === undefined
    ) {
      suggestions.push(missingItem('urate_other_complication', MISSING_DATA_CLASS.required, 'uric_acid', '尿酸8.0–8.9 mg/dLでは関連合併症として治療考慮が変わるため'));
    }
  }

  if (
    ua !== null &&
    ua >= 9 &&
    !input.urateTreatment &&
    (input.goutPresent === null || input.goutPresent === undefined)
  ) {
    suggestions.push(missingItem('gout', MISSING_DATA_CLASS.nextEvaluation, 'uric_acid', '薬物療法考慮は既に成立するが、痛風歴で治療文脈と目標が変わるため'));
  }

  const urateDecisionEstablished =
    !['pending', 'treated_needs_ua', 'needs_gout', 'needs_complication'].includes(result.id);
  if (
    ua !== null &&
    ua > 7 &&
    !input.urateTreatment &&
    urateDecisionEstablished &&
    (input.urinaryStone === null || input.urinaryStone === undefined)
  ) {
    suggestions.push(missingItem('urinary_stone', MISSING_DATA_CLASS.nextEvaluation, 'uric_acid', '現在の治療分岐は変えないが、結石管理の文脈に意味があるため'));
  }

  let nextAction = null;
  if (result.id === 'treated_above_target') {
    nextAction = {
      title: '尿酸降下療法を再評価',
      detail: '病型・合併症を踏まえて治療内容の調整要否を判断します。',
      tone: 'warn',
    };
  }
  if (['gout_branch', 'asymptomatic_ge9', 'asymptomatic_ge8_with_complication'].includes(result.id)) {
    nextAction = {
      title: '尿酸降下療法を検討',
      detail: 'ガイドライン上の治療考慮分岐です。自動的な投薬適応ではありません。',
      tone: result.id === 'gout_branch' ? 'bad' : 'warn',
    };
  }

  const facts = compactFacts([
    numericFact(
      'uric_acid',
      '尿酸',
      input.uricAcid,
      ' mg/dL',
      result.id === 'treated_above_target' ? 'bad' : 'neutral',
    ),
    input.urateTreatment ? fact('urate_treatment', '尿酸降下薬', '使用中') : null,
  ]);

  return {
    key: 'uric_acid',
    label: '尿酸',
    facts,
    interpretation: {
      id: result.id,
      title: result.title,
      detail: compactUricAcidDetail(result),
      tone: result.tone,
    },
    nextAction,
    suggestions,
  };
}

function mergeSuggestions(suggestions) {
  const merged = new Map();
  for (const item of suggestions) {
    if (!merged.has(item.key)) {
      merged.set(item.key, {
        key: item.key,
        class: item.class,
        label: item.label,
        domains: [item.domain],
        reasons: [item.reason],
      });
      continue;
    }

    const existing = merged.get(item.key);
    if (item.class === MISSING_DATA_CLASS.required) {
      existing.class = MISSING_DATA_CLASS.required;
    }
    if (!existing.domains.includes(item.domain)) existing.domains.push(item.domain);
    if (!existing.reasons.includes(item.reason)) existing.reasons.push(item.reason);
  }
  return [...merged.values()];
}

function finalizeDomain(domain, mergedSuggestions) {
  const requiredMissingKeys = domain.suggestions
    .filter((item) => item.class === MISSING_DATA_CLASS.required)
    .map((item) => item.key);
  const nextEvaluationKeys = domain.suggestions
    .filter((item) => item.class === MISSING_DATA_CLASS.nextEvaluation)
    .map((item) => item.key);

  return {
    key: domain.key,
    label: domain.label,
    facts: domain.facts,
    interpretation: domain.interpretation,
    nextAction: domain.nextAction,
    requiredMissingKeys: [...new Set(requiredMissingKeys)],
    nextEvaluationKeys: [...new Set(nextEvaluationKeys)],
    currentDecisionComplete: requiredMissingKeys.length === 0,
    hasNextEvaluation: nextEvaluationKeys.length > 0,
    missing: mergedSuggestions.filter((item) => item.domains.includes(domain.key)),
  };
}

export function buildUnifiedClinicalResult(input) {
  const rawDomains = [
    buildSldDomain(input),
    buildFibrosisDomain(input),
    buildBloodPressureDomain(input),
    buildLipidsDomain(input),
    buildGlycemiaDomain(input),
    buildUricAcidDomain(input),
  ];

  const mergedSuggestions = mergeSuggestions(rawDomains.flatMap((domain) => domain.suggestions));
  const required = mergedSuggestions.filter((item) => item.class === MISSING_DATA_CLASS.required);
  const nextEvaluation = mergedSuggestions.filter((item) => item.class === MISSING_DATA_CLASS.nextEvaluation);

  let completion;
  if (required.length > 0) {
    completion = {
      state: 'required_missing',
      currentDecisionComplete: false,
      allDecisionRelevantComplete: false,
      message: '現在の判定を完了するため、追加で確認すべき情報があります。',
    };
  } else if (nextEvaluation.length > 0) {
    completion = {
      state: 'next_evaluation_pending',
      currentDecisionComplete: true,
      allDecisionRelevantComplete: false,
      message: '現在の主要判定は可能です。次に臨床的に意味のある評価があります。',
    };
  } else {
    completion = {
      state: 'complete',
      currentDecisionComplete: true,
      allDecisionRelevantComplete: true,
      message: '現在の主要判定に必要な情報は揃っています。',
    };
  }

  return {
    version: UNIFIED_RESULT_VERSION,
    domainOrder: [...DOMAIN_ORDER],
    domains: rawDomains.map((domain) => finalizeDomain(domain, mergedSuggestions)),
    missing: {
      required,
      nextEvaluation,
      all: mergedSuggestions,
    },
    completion,
  };
}
