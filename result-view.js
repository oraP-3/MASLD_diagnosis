const DOMAIN_LABELS = Object.freeze({
  sld: 'SLD分類',
  fibrosis: '肝線維化',
  blood_pressure: '血圧',
  lipids: '脂質',
  glycemia: '糖代謝',
  uric_acid: '尿酸',
});

function escapeHtml(value) {
  return String(value ?? '')
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function toneClass(tone) {
  return ['good', 'warn', 'bad', 'neutral'].includes(tone) ? tone : 'neutral';
}

function domainStatus(domain) {
  if (!domain.currentDecisionComplete) {
    return { label: '要確認', className: 'required' };
  }
  if (domain.hasNextEvaluation) {
    return { label: '次の評価あり', className: 'next' };
  }
  return { label: '判定可能', className: 'complete' };
}

function renderFacts(facts) {
  if (!facts?.length) {
    return '<p class="summary-empty">主要な入力・計算値はまだありません。</p>';
  }

  return `<div class="summary-facts">${facts.map((item) => `
    <span class="fact-chip"><span>${escapeHtml(item.label)}</span><strong>${escapeHtml(item.value)}</strong></span>
  `).join('')}</div>`;
}

function renderNextAction(nextAction) {
  if (!nextAction) {
    return '<p class="summary-empty">現時点で追加の対応はありません。</p>';
  }

  return `<div class="summary-action ${toneClass(nextAction.tone)}">
    <strong>${escapeHtml(nextAction.title)}</strong>
    <p>${escapeHtml(nextAction.detail)}</p>
  </div>`;
}

function renderDomainMissing(domain) {
  const count = domain.requiredMissingKeys.length + domain.nextEvaluationKeys.length;
  if (count === 0) return '';

  const parts = [];
  if (domain.requiredMissingKeys.length) {
    parts.push(`<span class="domain-missing required">A ${domain.requiredMissingKeys.length}件</span>`);
  }
  if (domain.nextEvaluationKeys.length) {
    parts.push(`<span class="domain-missing next">B ${domain.nextEvaluationKeys.length}件</span>`);
  }
  return `<div class="domain-missing-row">${parts.join('')}</div>`;
}

function renderDomainCard(domain) {
  const status = domainStatus(domain);
  return `<article class="clinical-result-card ${toneClass(domain.interpretation.tone)}" data-domain="${escapeHtml(domain.key)}">
    <header class="clinical-result-card-header">
      <div>
        <p class="result-label">${escapeHtml(domain.label)}</p>
        <h3>${escapeHtml(domain.interpretation.title)}</h3>
      </div>
      <span class="summary-status ${status.className}">${status.label}</span>
    </header>

    <section class="summary-layer">
      <p class="summary-layer-label">現在の情報</p>
      ${renderFacts(domain.facts)}
    </section>

    <section class="summary-layer interpretation">
      <p class="summary-layer-label">解釈</p>
      <p class="summary-detail">${escapeHtml(domain.interpretation.detail)}</p>
    </section>

    <section class="summary-layer action">
      <p class="summary-layer-label">次の対応</p>
      ${renderNextAction(domain.nextAction)}
    </section>

    ${renderDomainMissing(domain)}
  </article>`;
}

function renderMissingItem(item) {
  const domainLabels = item.domains
    .map((key) => DOMAIN_LABELS[key] || key)
    .join('・');
  const reason = item.reasons.join(' / ');

  return `<li class="additional-item">
    <div class="additional-item-main">
      <strong>${escapeHtml(item.label)}</strong>
      <span class="additional-domain">${escapeHtml(domainLabels)}</span>
    </div>
    <p>${escapeHtml(reason)}</p>
  </li>`;
}

function renderMissingGroup(items, dataClass) {
  if (!items.length) return '';

  const required = dataClass === 'required';
  const label = required ? 'A' : 'B';
  const title = required ? '現在の判定に必要' : '次に意味のある評価';
  const detail = required
    ? 'この情報がないと、現在の分類・追加検査・治療考慮のいずれかが確定しません。'
    : '現在の主要判定は可能ですが、次の臨床判断に意味のある評価です。';

  return `<section class="additional-group ${required ? 'required' : 'next'}">
    <div class="additional-group-heading">
      <span class="missing-class-badge">${label}</span>
      <div>
        <h3>${title}</h3>
        <p>${detail}</p>
      </div>
    </div>
    <ul class="additional-list">${items.map(renderMissingItem).join('')}</ul>
  </section>`;
}

function completionTone(state) {
  if (state === 'complete') return 'good';
  if (state === 'next_evaluation_pending') return 'accent';
  return 'warn';
}

export function renderUnifiedResultView(result) {
  const cardsHtml = result.domains.map(renderDomainCard).join('');
  const missingHtml = [
    renderMissingGroup(result.missing.required, 'required'),
    renderMissingGroup(result.missing.nextEvaluation, 'next_evaluation'),
  ].filter(Boolean).join('');

  const completionHtml = `<div class="completion-banner ${completionTone(result.completion.state)}">
    <strong>${escapeHtml(result.completion.message)}</strong>
    ${result.completion.state === 'complete'
      ? '<span>追加で確認すべき、現在の判断に影響する情報はありません。</span>'
      : ''}
  </div>`;

  return {
    cardsHtml,
    missingHtml,
    completionHtml,
    completionState: result.completion.state,
  };
}
