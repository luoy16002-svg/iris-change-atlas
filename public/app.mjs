import { SCHEMA, LABELS, compare, validateSnapshot, displayValue, markdownReport } from './atlas-core.mjs';
const $ = id => document.getElementById(id);
const esc = value => String(value ?? '').replace(/[&<>"']/g, char => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char]);
const time = iso => new Date(iso).toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', second: '2-digit' });
let captures = [], result = null, filter = 'all', selectedKey = '', running = false;
const importedIds = new Set();
function notice(message, error = false) { $('notice').textContent = message; $('notice').hidden = !message; $('notice').classList.toggle('error', error); }
function changeId(change) { return `${change.section}:${change.key}`; }
function addCaptures(incoming) {
  const validated = incoming.map(validateSnapshot);
  const existing = new Map(captures.map(item => [item.id, item]));
  for (const item of validated) {
    if (!item.id) throw new Error('Snapshot ID is missing.');
    if (existing.has(item.id) && JSON.stringify(existing.get(item.id)) !== JSON.stringify(item)) throw new Error('A different snapshot already uses this ID.');
    existing.set(item.id, item);
  }
  if (existing.size > 20) throw new Error('This workspace holds up to 20 captures. Save your work and refresh before a new review.');
  captures = [...existing.values()];
  const oldBaseline = $('baseline').value;
  for (const id of ['baseline', 'current']) $(''+id).innerHTML = captures.map(item => `<option value="${esc(item.id)}">${esc(item.label)} · ${esc(time(item.capturedAt))}${item.source.kind === 'example' ? ' · example' : ''}</option>`).join('');
  $('baseline').value = captures.some(item => item.id === oldBaseline) ? oldBaseline : captures[0].id;
  $('current').value = captures.at(-1).id;
  // When switching from an example to live evidence, make the first live capture the baseline.
  const last = captures.at(-1), baseline = captures.find(item => item.id === $('baseline').value);
  if (last.source.kind === 'live' && baseline.source.kind === 'example') $('baseline').value = last.id;
  $('export-captures').disabled = !captures.length;
  $('swap').disabled = captures.length < 2;
  render();
}
function render() {
  const before = captures.find(item => item.id === $('baseline').value), after = captures.find(item => item.id === $('current').value);
  const ready = before && after && before.id !== after.id;
  $('empty').hidden = !!ready; $('review').hidden = !ready;
  if (!ready) { result = null; return; }
  result = compare(before, after);
  const added = result.changes.filter(item => item.type === 'added').length;
  const removed = result.changes.filter(item => item.type === 'removed').length;
  const provenance = after.source.kind === 'example' ? 'RECORDED EXAMPLE' : importedIds.has(before.id) || importedIds.has(after.id) ? 'IMPORTED CAPTURES' : 'LIVE CAPTURES';
  $('source-strip').innerHTML = `<span><strong>${esc(after.source.label)}</strong> &nbsp; <span class="source-tag">${provenance}</span></span><span>${esc(time(before.capturedAt))} → ${esc(time(after.capturedAt))}</span>`;
  $('stats').innerHTML = [
    ['Changed objects', result.changes.length, `${added} added · ${removed} removed`],
    ['Unchanged objects', result.unchanged, 'Within comparable collections'],
    ['Evidence coverage', `${result.compared}/3`, result.gaps.length ? 'Review the gaps below' : 'All three collections available'],
    ['Fields changed', result.changes.filter(item => item.type === 'changed').reduce((n, item) => n + item.fields.length, 0), 'Existing objects only']
  ].map(([label, value, hint]) => `<div class="stat"><span class="label">${label}</span><span class="number">${value}</span><span class="hint">${hint}</span></div>`).join('');
  $('gaps').innerHTML = result.gaps.map(gap => `<div class="gap"><strong>Evidence gap · ${LABELS[gap.section]}</strong><br>${esc(gap.reason)}<br>We do not infer additions or removals from incomplete evidence.</div>`).join('');
  if (new Date(before.capturedAt) > new Date(after.capturedAt)) $('gaps').insertAdjacentHTML('beforeend', '<div class="gap"><strong>Reverse chronology</strong><br>The baseline is newer than the current capture. Changes are shown in the selected direction.</div>');
  renderChanges(); renderRuntime(after);
}
function renderChanges() {
  if (!result) return;
  const query = $('search').value.trim().toLowerCase();
  const visible = result.changes.filter(item => (filter === 'all' || item.section === filter) && `${item.name} ${item.key} ${LABELS[item.section]}`.toLowerCase().includes(query));
  $('change-count').textContent = visible.length;
  if (!visible.some(item => changeId(item) === selectedKey)) selectedKey = visible.length ? changeId(visible[0]) : '';
  $('change-list').innerHTML = visible.length ? visible.map(item => `<button class="change-row ${changeId(item) === selectedKey ? 'selected' : ''}" data-key="${esc(changeId(item))}" aria-pressed="${changeId(item) === selectedKey}"><span><strong>${esc(item.name)}</strong><small>${LABELS[item.section]} · ${item.type === 'changed' ? `${item.fields.length} field${item.fields.length === 1 ? '' : 's'} changed` : 'Object ' + item.type}</small></span><span class="status ${item.type}">${item.type.toUpperCase()}</span></button>`).join('') : `<p class="list-empty">${result.changes.length ? 'No changes match this filter.' : result.gaps.length ? 'No confirmed changes in the available evidence. Missing collections prevent an all-clear conclusion.' : 'No configuration differences in these three collections. Runtime counters are excluded.'}</p>`;
  for (const button of $('change-list').querySelectorAll('button')) button.addEventListener('click', () => { selectedKey = button.dataset.key; renderChanges(); $('change-list').querySelector(`[data-key="${CSS.escape(selectedKey)}"]`)?.focus({ preventScroll: true }); });
  const selected = visible.find(item => changeId(item) === selectedKey);
  $('inspector').innerHTML = selected ? `<p class="eyebrow">OBJECT DETAIL</p><h2>${esc(selected.name)}</h2><div class="detail-meta">${LABELS[selected.section]} · ${esc(selected.key)} · ${selected.type}</div>${selected.fields.map(field => `<section class="field-diff"><h3>${esc(field.field)}</h3><div class="field-values"><div><small>BEFORE</small><code>${esc(displayValue(field.before, field.hadBefore))}</code></div><div><small>AFTER</small><code>${esc(displayValue(field.after, field.hasAfter))}</code></div></div></section>`).join('')}<p>Observed configuration difference. Review intent and impact before taking action in IRIS.</p>` : '<p class="eyebrow">OBJECT DETAIL</p><h2>Nothing selected.</h2><p>Select an object in the ledger to see its exact before and after values.</p>';
}
function renderRuntime(after) {
  const runtime = after.runtime;
  if (!runtime || runtime.status !== 'ok') { $('runtime').textContent = runtime?.reason || 'Runtime context was not captured.'; return; }
  const data = runtime.data;
  $('runtime').innerHTML = `<div class="runtime-grid">${Object.entries(data).flatMap(([group, fields]) => Object.entries(fields).map(([key, value]) => `<div>${esc(group)} · ${esc(key)}<strong>${esc(value)}</strong></div>`)).join('')}</div><p>${esc(after.source.version)}</p>`;
}
function download(name, content, type) {
  const blob = new Blob([content], { type }); const url = URL.createObjectURL(blob);
  const link = document.createElement('a'); link.href = url; link.download = name; link.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
$('capture-form').addEventListener('submit', async event => {
  event.preventDefault(); if (running) return;
  running = true; $('capture').disabled = true; $('capture').textContent = 'Reading IRIS…';
  notice('Capturing three configuration collections and runtime context…');
  try {
    const response = await fetch('./api/capture', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ label: $('capture-label').value }) });
    const data = await response.json(); if (!response.ok) throw new Error(data.error || 'Capture failed.');
    addCaptures([data]); const complete = Object.values(data.sections).filter(item => item.status === 'ok').length;
    notice(`Captured “${data.label}”. ${complete}/3 collections available.${complete < 3 ? ' Review evidence gaps before drawing conclusions.' : ''}${captures.filter(item => item.source.kind === 'live').length === 1 ? ' Capture again after your change to begin the review.' : ''}`, complete < 3);
    $('capture-label').value = '';
  } catch (error) { notice(error.message, true); }
  finally { running = false; $('capture').disabled = false; $('capture').textContent = 'Capture now +'; }
});
$('baseline').addEventListener('change', render); $('current').addEventListener('change', render);
$('swap').addEventListener('click', () => { const old = $('baseline').value; $('baseline').value = $('current').value; $('current').value = old; render(); });
$('search').addEventListener('input', renderChanges);
for (const button of document.querySelectorAll('[data-section]')) button.addEventListener('click', () => { filter = button.dataset.section; for (const item of document.querySelectorAll('[data-section]')) item.setAttribute('aria-pressed', String(item === button)); renderChanges(); });
$('example').addEventListener('click', async () => {
  try { const response = await fetch('./example.json'); if (!response.ok) throw new Error('Recorded example is unavailable.'); const bundle = await response.json(); addCaptures(bundle.snapshots); $('baseline').value = bundle.snapshots[0].id; $('current').value = bundle.snapshots[1].id; render(); notice('Recorded example: two real captures from a disposable local IRIS instance, with a controlled demonstration change. This is not your live instance.'); }
  catch (error) { notice(error.message, true); }
});
$('import').addEventListener('click', () => $('file').click());
$('file').addEventListener('change', async () => {
  try {
    const file = $('file').files[0]; if (!file) return;
    if (file.size > 8 * 1024 * 1024) throw new Error('File exceeds the 8 MiB import limit.');
    const input = JSON.parse(await file.text());
    const incoming = input.schema === SCHEMA ? [input] : input.atlasBundle === 1 && Array.isArray(input.snapshots) && input.snapshots.length <= 20 ? input.snapshots : null;
    if (!incoming?.length) throw new Error('Choose an Atlas snapshot or capture bundle.');
    addCaptures(incoming); incoming.forEach(item => importedIds.add(item.id)); render(); notice(`Imported ${incoming.length} capture${incoming.length === 1 ? '' : 's'}. Source labels are supplied by the file; imported evidence is not independently authenticated.`);
  } catch (error) { notice(error instanceof SyntaxError ? 'That file is not valid JSON.' : error.message, true); }
  finally { $('file').value = ''; }
});
$('export-captures').addEventListener('click', () => { download('iris-atlas-captures.json', JSON.stringify({ atlasBundle: 1, snapshots: captures }, null, 2), 'application/json'); notice('Capture bundle saved. It contains configuration metadata; review it before sharing.'); });
$('export-report').addEventListener('click', () => { if (!result) return; download('iris-atlas-review.md', markdownReport(result, $('note').value), 'text/markdown'); notice('Review exported with field changes, evidence gaps, and your note.'); });
function offline(message) { $('connection').textContent = 'Offline review · recorded example'; $('capture').disabled = true; $('capture-label').disabled = true; notice(message); }
if (!['localhost', '127.0.0.1', '[::1]'].includes(location.hostname)) offline('Public demo: explore the recorded example or import local captures. Run the local server to connect to your own IRIS instance.');
else {
  try { const data = await (await fetch('./api/connection')).json(); $('connection').textContent = data.configured ? `${data.label} · configured` : 'Offline review available'; if (!data.configured) offline(data.message + ' You can still explore the example or import captures.'); }
  catch { offline('Local connection unavailable. Recorded examples and imported captures work offline.'); }
}
