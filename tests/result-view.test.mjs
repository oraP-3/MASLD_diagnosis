import test from 'node:test';
import assert from 'node:assert/strict';
import { renderUnifiedResultView } from '../result-view.js';

function domain(key, label, overrides = {}) {
  return {
    key,
    label,
    facts: [{ key: `${key}_fact`, label: '代表値', value: '123' }],
    interpretation: {
      id: 'example',
      title: `${label}の判定`,
      detail: `${label}の解釈です。`,
      tone: 'good',
    },
    nextAction: null,
    requiredMissingKeys: [],
    nextEvaluationKeys: [],
    currentDecisionComplete: true,
    hasNextEvaluation: false,
    missing: [],
    ...overrides,
  };
}

const sixDomains = [
  domain('sld', 'SLD分類'),
  domain('fibrosis', '肝線維化'),
  domain('blood_pressure', '血圧'),
  domain('lipids', '脂質'),
  domain('glycemia', '糖代謝'),
  domain('uric_acid', '尿酸'),
];

test('E2 renderer emits six readable domain cards in E1 order', () => {
  const view = renderUnifiedResultView({
    domains: sixDomains,
    missing: { required: [], nextEvaluation: [] },
    completion: { state: 'complete', message: '現在の主要判定に必要な情報は揃っています。' },
  });

  assert.equal((view.cardsHtml.match(/class="clinical-result-card/g) || []).length, 6);
  const positions = sixDomains.map((item) => view.cardsHtml.indexOf(`data-domain="${item.key}"`));
  assert.ok(positions.every((position) => position >= 0));
  assert.deepEqual([...positions].sort((a, b) => a - b), positions);
});

test('E2 cards visually separate fact interpretation and next action layers', () => {
  const withAction = sixDomains.map((item, index) => index === 0
    ? {
        ...item,
        nextAction: { title: '次の対応あり', detail: '対応内容', tone: 'warn' },
      }
    : item);

  const view = renderUnifiedResultView({
    domains: withAction,
    missing: { required: [], nextEvaluation: [] },
    completion: { state: 'complete', message: '完了' },
  });

  assert.match(view.cardsHtml, /現在のfact/);
  assert.match(view.cardsHtml, /解釈/);
  assert.match(view.cardsHtml, /次の対応/);
  assert.match(view.cardsHtml, /次の対応あり/);
});

test('E2 renderer gives required and next-evaluation missing classes distinct labels', () => {
  const view = renderUnifiedResultView({
    domains: sixDomains,
    missing: {
      required: [{
        key: 'diabetes_confirmation',
        class: 'required',
        label: '糖尿病型の確認',
        domains: ['glycemia', 'lipids'],
        reasons: ['糖代謝の診断確認に必要', '脂質リスク経路が変わる'],
      }],
      nextEvaluation: [{
        key: 'bp_persistence',
        class: 'next_evaluation',
        label: '血圧高値の持続確認',
        domains: ['blood_pressure'],
        reasons: ['家庭血圧または別日血圧で確認'],
      }],
    },
    completion: { state: 'required_missing', message: '追加確認があります。' },
  });

  assert.match(view.missingHtml, />A</);
  assert.match(view.missingHtml, /現在の判定に必要/);
  assert.match(view.missingHtml, />B</);
  assert.match(view.missingHtml, /次に意味のある評価/);
  assert.match(view.missingHtml, /糖代謝・脂質/);
  assert.match(view.missingHtml, /血圧高値の持続確認/);
});

test('E2 complete state renders a clear no-more-decision-relevant-data message', () => {
  const view = renderUnifiedResultView({
    domains: sixDomains,
    missing: { required: [], nextEvaluation: [] },
    completion: { state: 'complete', message: '現在の主要判定に必要な情報は揃っています。' },
  });

  assert.equal(view.completionState, 'complete');
  assert.equal(view.missingHtml, '');
  assert.match(view.completionHtml, /現在の主要判定に必要な情報は揃っています/);
  assert.match(view.completionHtml, /decision-relevant dataはありません/);
  assert.match(view.completionHtml, /completion-banner good/);
});

test('E2 per-domain status distinguishes incomplete current decisions from next evaluation', () => {
  const domains = [
    domain('sld', 'SLD分類', {
      requiredMissingKeys: ['waist'],
      currentDecisionComplete: false,
    }),
    domain('fibrosis', '肝線維化', {
      nextEvaluationKeys: ['second_line_fibrosis_nit'],
      hasNextEvaluation: true,
    }),
    ...sixDomains.slice(2),
  ];

  const view = renderUnifiedResultView({
    domains,
    missing: { required: [], nextEvaluation: [] },
    completion: { state: 'complete', message: 'test' },
  });

  assert.match(view.cardsHtml, /summary-status required">要確認/);
  assert.match(view.cardsHtml, /summary-status next">次の評価あり/);
  assert.match(view.cardsHtml, /domain-missing required">A 1件/);
  assert.match(view.cardsHtml, /domain-missing next">B 1件/);
});

test('E2 renderer escapes fact and interpretation text before inserting HTML', () => {
  const unsafe = domain('sld', 'SLD分類', {
    facts: [{ key: 'unsafe', label: '<img>', value: '<script>alert(1)</script>' }],
    interpretation: {
      id: 'unsafe',
      title: '<b>unsafe</b>',
      detail: '"quoted" & <tag>',
      tone: 'neutral',
    },
  });

  const view = renderUnifiedResultView({
    domains: [unsafe],
    missing: { required: [], nextEvaluation: [] },
    completion: { state: 'complete', message: '<done>' },
  });

  assert.doesNotMatch(view.cardsHtml, /<script>/);
  assert.doesNotMatch(view.cardsHtml, /<b>unsafe/);
  assert.match(view.cardsHtml, /&lt;script&gt;/);
  assert.match(view.cardsHtml, /&lt;b&gt;unsafe&lt;\/b&gt;/);
  assert.match(view.completionHtml, /&lt;done&gt;/);
});
