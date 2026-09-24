import { test } from 'node:test';
import assert from 'node:assert/strict';
import { SCHEMA, compare, validateSnapshot, normalizeRows, markdownReport } from '../public/atlas-core.mjs';
function snap(rows = [], override = {}) { return { schema: SCHEMA, id: 'a', label: 'Capture', capturedAt: '2026-09-24T13:00:00Z', source: { id: 'local', kind: 'live', label: 'Local' }, sections: { webapps: { status: 'ok', rows }, tasks: { status: 'ok', rows: [] }, namespaces: { status: 'ok', rows: [] } }, ...override }; }
test('addition, removal, and field edits preserve exact evidence', () => {
  const a = snap([{ Name: '/a', Enabled: true }, { Name: '/b', Enabled: false }]);
  const b = snap([{ Name: '/b', Enabled: true }, { Name: '/c', Enabled: false }]);
  const r = compare(a, b);
  assert.deepEqual(r.changes.map(item => item.type), ['removed', 'changed', 'added']);
  assert.deepEqual(r.changes[1].fields, [{ field: 'Enabled', before: false, after: true, hadBefore: true, hasAfter: true }]);
});
test('ordering of collections and authentication sets is irrelevant', () => {
  const a = snap([{ Name: '/a', AuthenticationMethods: ['Password', 'Kerberos'] }, { Name: '/b' }]);
  const b = snap([{ Name: '/b' }, { Name: '/a', AuthenticationMethods: ['Kerberos', 'Password'] }]);
  assert.equal(compare(a, b).changes.length, 0); assert.equal(compare(a, b).unchanged, 2);
});
test('missing evidence is never treated as removal', () => {
  const a = snap([{ Name: '/a' }]), b = snap(); b.sections.webapps = { status: 'unavailable', reason: 'Permission denied (403).' };
  const r = compare(a, b); assert.equal(r.changes.length, 0); assert.equal(r.gaps.length, 1); assert.equal(r.compared, 2);
  assert.match(markdownReport(r), /prevent an all-clear/);
});
test('a truncated collection is not compared even when it contains rows', () => {
  const a = snap([{ Name: '/a' }]), b = snap([{ Name: '/b' }]); b.sections.webapps.status = 'partial';
  assert.equal(compare(a, b).changes.length, 0); assert.equal(compare(a, b).gaps.length, 1);
});
test('source changes and example/live mixing block comparisons', () => {
  const a = snap([{ Name: '/a' }]), b = snap(); b.source.id = 'other'; assert.equal(compare(a, b).compared, 0);
  b.source.id = 'local'; b.source.kind = 'example'; assert.equal(compare(a, b).compared, 0);
});
test('task identity survives a rename and ignores moving execution timestamps', () => {
  const a = snap(), b = snap(); a.sections.tasks.rows = [{ Id: 7, Name: 'Old', LastFinished: '1' }]; b.sections.tasks.rows = [{ Id: 7, Name: 'New', LastFinished: '2' }];
  const r = compare(a, b); assert.equal(r.changes[0].type, 'changed'); assert.deepEqual(r.changes[0].fields.map(f => f.field), ['Name']);
});
test('duplicate or absent identities reject ambiguous snapshots', () => {
  assert.throws(() => normalizeRows('webapps', [{ Name: '/a' }, { Name: '/a' }]), /Duplicate/);
  assert.throws(() => normalizeRows('tasks', [{ Name: 'No ID' }]), /numeric ID/);
  assert.throws(() => normalizeRows('webapps', [{}]), /missing/);
});
test('empty, null, false, and missing values remain distinct', () => {
  const a = snap([{ Name: '/a', Resource: '', Enabled: false }]), b = snap([{ Name: '/a', Resource: null }]);
  const r = compare(a, b); assert.equal(r.changes[0].fields.length, 2); assert.match(markdownReport(r), /\(empty string\)/); assert.match(markdownReport(r), /Not present/);
});
test('unknown and credential-shaped fields are stripped from objects and runtime', () => {
  const a = snap([{ Name: '/a', Password: 'do-not-export', Token: 'secret' }], { runtime: { status: 'ok', data: { Password: 'secret', Status: { UpTime: '1m', Token: 'secret' } } } });
  const clean = JSON.stringify(validateSnapshot(a)); assert.ok(!clean.includes('secret')); assert.ok(!clean.includes('do-not-export')); assert.ok(clean.includes('1m'));
});
test('schema, source and bounds are validated before import', () => {
  assert.throws(() => validateSnapshot({}), /v1 snapshot/); assert.throws(() => validateSnapshot(snap([], { capturedAt: 'bad' })), /timestamp/);
  assert.throws(() => normalizeRows('webapps', [{ Name: '/a', Resource: {} }]), /type/);
  assert.throws(() => normalizeRows('webapps', [{ Name: 'x'.repeat(9000) }]), /limit/);
});
test('markdown export keeps tables intact with hostile-looking labels and notes', () => {
  const r = compare(snap(), snap([{ Name: '/a|<script>', Resource: 'a\nb' }])); const md = markdownReport(r, '<img> note|x\ny');
  assert.ok(!md.includes('<script>')); assert.ok(md.includes('\\|')); assert.ok(md.includes('&lt;img&gt;')); assert.ok(md.includes('a b'));
});
test('swapping direction reverses addition and removal', () => {
  const a = snap(), b = snap([{ Name: '/a' }]); assert.equal(compare(a, b).changes[0].type, 'added'); assert.equal(compare(b, a).changes[0].type, 'removed');
});
