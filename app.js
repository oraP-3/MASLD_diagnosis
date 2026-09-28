import { calculateBmi, deriveCmrf, classifySld, calculateFib4, evaluateFib4, evaluatePlatelets, shouldShowNit, interpretNit } from './clinical-rules.js';

const DRINKS = [
  ['beer350', 'ビール・発泡酒 350mL', 14], ['beer500', 'ビール・発泡酒 500mL', 20],
  ['chuhai5350', 'チューハイ5% 350mL', 14], ['chuhai5500', 'チューハイ5% 500mL', 20],
  ['chuhai7350', 'チューハイ7% 350mL', 19.6], ['chuhai7500', 'チューハイ7% 500mL', 28],
  ['chuhai9350', 'ストロング9% 350mL', 25.2], ['chuhai9500', 'ストロング9% 500mL', 36],
  ['wine', 'ワイン グラス', 11.5], ['sake', '日本酒 1合', 21.6], ['shochu', '焼酎・ハイボール 1杯', 14],
];
const cmrfLabels = { body: '体格', glucose: '糖代謝', bp: '血圧', tg: '中性脂肪', hdl: 'HDL-C' };
const $ = (id) => document.getElementById(id);
const value = (id) => $(id)?.value ?? '';
const checked = (id) => Boolean($(id)?.checked);
const radioValue = (name) => document.querySelector(`input[name="${name}"]:checked`)?.value ?? '';
function boolRadio(name) { const v = radioValue(name); return v === 'true' ? true : v === 'false' ? false : null; }

function currentInput() {
  return {
    age: value('age'), sex: radioValue('sex'), bmi: value('bmi'), waist: value('waist'), sbp: value('sbp'), dbp: value('dbp'),
    hba1c: value('hba1c'), tg: value('tg'), hdl: value('hdl'),
    antihypertensiveTreatment: checked('antihypertensiveTreatment'), diagnosedDiabetes: checked('diagnosedDiabetes'), lipidTreatment: checked('lipidTreatment'),
    steatosis: boolRadio('steatosis'), alcoholGWeek: value('alcoholGWeek'), otherCause: checked('otherCause'),
    ast: value('ast'), alt: value('alt'), plateletsWan: value('plateletsWan'),
  };
}

function resultClass(id) {
  if (['masld', 'no_sld', 'low'].includes(id)) return 'good';
  if (['metald', 'intermediate', 'pending', 'unclassified', 'cryptogenic'].includes(id)) return 'warn';
  if (['ald', 'high', 'specific_sld'].includes(id)) return 'bad';
  return 'neutral';
}
function setResultCard(el, label, title, detail, cls = 'neutral') { el.className = `result-card ${cls}`; el.innerHTML = `<p class="result-label">${label}</p><h3>${title}</h3><p>${detail}</p>`; }

function renderCmrf(cmrf) {
  $('cmrfBadges').innerHTML = Object.entries(cmrf.statuses).map(([key, status]) => {
    const cls = status === true ? 'on' : status === false ? 'off' : 'unknown';
    const suffix = status === true ? '該当' : status === false ? '非該当' : '未確定';
    return `<span class="badge ${cls}">${cmrfLabels[key]}：${suffix}</span>`;
  }).join('');
  $('waistPrompt').classList.toggle('hidden', !cmrf.waistRelevant);
}
function renderSld(input, cmrf) { const r = classifySld(input, cmrf); setResultCard($('sldResult'), 'SLD分類', r.title, r.detail, resultClass(r.id)); }

function renderFibrosis(input) {
  const fib4 = calculateFib4(input);
  const evaluation = fib4 === null ? null : evaluateFib4(input.age, fib4);
  const platelets = evaluatePlatelets(input.plateletsWan);
  if (!evaluation) setResultCard($('fib4Result'), 'FIB-4', '入力待ち', '年齢・AST・ALT・血小板を入力してください。');
  else {
    const note = Number(input.age) >= 66 ? ` 66歳以上のため下限${evaluation.lowCutoff}を使用。` : '';
    setResultCard($('fib4Result'), 'FIB-4', `${fib4.toFixed(2)} — ${evaluation.label}`, `${evaluation.detail}${note}`, resultClass(evaluation.id));
  }
  if (!platelets) setResultCard($('plateletResult'), '血小板による補助評価', '入力待ち', '血小板値を入力してください。');
  else setResultCard($('plateletResult'), '血小板による補助評価', platelets.label, platelets.detail, resultClass(platelets.id));

  $('nitPrompt').classList.toggle('hidden', !shouldShowNit({ fib4Evaluation: evaluation, plateletsWan: input.plateletsWan }));
  renderNit();
}

function renderNit() {
  if ($('nitPrompt').classList.contains('hidden')) { $('nitResults').innerHTML = ''; return; }
  const results = interpretNit({ vcteKpa: value('vcteKpa'), swe: value('swe'), sweUnit: value('sweUnit'), mreKpa: value('mreKpa'), elf: value('elf'), type4Collagen7s: value('type4Collagen7s'), m2bpgi: value('m2bpgi') });
  $('nitResults').innerHTML = results.length
    ? results.map((item) => `<div class="nit-item"><strong>${item.label}: ${item.value}${item.unit ? ` ${item.unit}` : ''}</strong><span>${item.detail}</span></div>`).join('')
    : '<p class="microcopy">利用可能なNITがあれば入力してください。未入力の検査を不足データとしては扱いません。</p>';
}

function renderAll() { const input = currentInput(); const cmrf = deriveCmrf(input); renderCmrf(cmrf); renderSld(input, cmrf); renderFibrosis(input); }

function setupDrinkHelper() {
  $('drinkRows').innerHTML = DRINKS.map(([id, label, alcohol]) => `<label class="drink-row"><span>${label}<br><small>${alcohol}g/単位</small></span><input class="drink-count" data-id="${id}" data-alcohol="${alcohol}" type="number" min="0" step="1" value="0" /></label>`).join('');
  const recalc = () => {
    const perDay = [...document.querySelectorAll('.drink-count')].reduce((sum, input) => sum + Number(input.value || 0) * Number(input.dataset.alcohol), 0);
    const weekly = Math.round(perDay * Number(value('drinkingDays') || 0) * 10) / 10;
    $('alcoholPreview').textContent = `${weekly} g/週`; $('alcoholPreview').dataset.weekly = String(weekly);
  };
  $('drinkRows').addEventListener('input', recalc); $('drinkingDays').addEventListener('change', recalc);
  $('applyAlcoholButton').addEventListener('click', () => { $('alcoholGWeek').value = $('alcoholPreview').dataset.weekly || '0'; renderAll(); });
  recalc();
}

function resetAll() {
  document.querySelectorAll('input').forEach((input) => { if (input.type === 'checkbox' || input.type === 'radio') input.checked = false; else input.value = ''; });
  document.querySelectorAll('select').forEach((select) => { select.selectedIndex = 0; });
  document.querySelectorAll('.drink-count').forEach((input) => { input.value = '0'; });
  $('alcoholPreview').textContent = '0 g/週'; $('alcoholPreview').dataset.weekly = '0'; $('bmiHelper').open = false; $('alcoholHelper').open = false; renderAll();
}

function bindEvents() {
  document.body.addEventListener('input', (event) => { if (!event.target.classList.contains('drink-count')) renderAll(); });
  document.body.addEventListener('change', (event) => { if (event.target.id !== 'drinkingDays') renderAll(); });
  $('calculateBmiButton').addEventListener('click', () => { const bmi = calculateBmi(value('heightCm'), value('weightKg')); if (bmi !== null) { $('bmi').value = bmi.toFixed(1); renderAll(); } });
  $('resetButton').addEventListener('click', resetAll);
}
setupDrinkHelper(); bindEvents(); renderAll();
