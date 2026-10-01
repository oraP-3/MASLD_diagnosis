import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const html = readFileSync(new URL('../index.html', import.meta.url), 'utf8');
const app = readFileSync(new URL('../app.js', import.meta.url), 'utf8');
const css = readFileSync(new URL('../styles.css', import.meta.url), 'utf8');

test('E3 C1 defaults to input mode and keeps result summary hidden until requested', () => {
  assert.match(html, /id="inputModeButton"[^>]*aria-selected="true"/);
  assert.match(html, /id="resultModeButton"[^>]*aria-selected="false"/);
  assert.match(html, /class="card results-overview hidden" data-view="result"/);
  assert.equal((html.match(/data-view="input"/g) || []).length, 8);
  assert.match(app, /setActiveView\('input'\);/);
});

test('E3 C1 reset returns to input mode and restores unknown TG sampling state', () => {
  assert.match(app, /\$\('tgFastingUnknown'\)\.checked = true;/);
  assert.match(app, /setActiveView\('input', \{ scroll: true \}\);/);
});

test('E3 C1 moves TG sampling beside TG and removes the BP duplicate prompt', () => {
  assert.match(html, /id="tgFastingUnknown"[^>]*name="tgFastingStatus"[^>]*value=""[^>]*checked/);
  assert.match(html, /name="tgFastingStatus" value="fasting"/);
  assert.match(html, /name="tgFastingStatus" value="nonfasting"/);
  assert.doesNotMatch(html, /bpTgFastingPrompt/);
  assert.doesNotMatch(app, /bpTgFastingPrompt/);
});

test('E3 C1 orders routine lipid inputs as HDL then LDL then TG', () => {
  const hdl = html.indexOf('id="hdl"');
  const ldl = html.indexOf('id="ldl"');
  const tg = html.indexOf('id="tg"');
  assert.ok(hdl > 0 && ldl > 0 && tg > 0);
  assert.ok(hdl < ldl && ldl < tg);
});

test('E3 C1 view switch is sticky and mobile-safe', () => {
  assert.match(css, /\.view-switcher\s*\{[\s\S]*?position:\s*sticky;/);
  assert.match(css, /\.view-switcher-inner\s*\{[\s\S]*?grid-template-columns:\s*repeat\(2/);
  assert.match(css, /@media \(max-width: 760px\)[\s\S]*?\.view-switcher-inner \{ width: 100%; \}/);
});


test('E3 C1 TG block reads as TG label then sampling condition then value input', () => {
  const groupStart = html.indexOf('<div class="tg-input-group">');
  const groupEnd = html.indexOf('</div>', groupStart);
  const block = html.slice(groupStart, groupEnd);
  const title = block.indexOf('中性脂肪 mg/dL');
  const sampling = block.indexOf('<legend>採血条件</legend>');
  const input = block.indexOf('id="tg"');
  assert.ok(title >= 0 && sampling >= 0 && input >= 0);
  assert.ok(title < sampling && sampling < input);
});
