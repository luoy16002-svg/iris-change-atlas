export const SCHEMA = 'iris-change-atlas/v1';
export const SECTIONS = ['webapps', 'tasks', 'namespaces'];
export const LABELS = { webapps: 'Web applications', tasks: 'Scheduled tasks', namespaces: 'Namespaces' };
export const FIELDS = {
  webapps: ['Name', 'Namespace', 'NamespaceDefault', 'Enabled', 'Type', 'Resource', 'AuthenticationMethods', 'IsSystemApp', 'DispatchClass'],
  tasks: ['Id', 'Name', 'Namespace', 'Type', 'Description', 'Suspended'],
  namespaces: ['Name', 'Globals', 'Routines', 'SysGlobals', 'SysRoutines', 'Library', 'TempGlobals']
};

export function canonical(value) {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map(key => `${JSON.stringify(key)}:${canonical(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}
export function identity(section, row) {
  if (section === 'tasks') {
    if (!Number.isSafeInteger(row.Id) || row.Id < 0) throw new Error('A task is missing its numeric ID.');
    return String(row.Id);
  }
  if (typeof row.Name !== 'string' || !row.Name.trim()) throw new Error('An object is missing its name.');
  return row.Name;
}
export function normalizeRows(section, rows) {
  if (!FIELDS[section] || !Array.isArray(rows)) throw new Error('Expected a supported collection.');
  if (rows.length > 10000) throw new Error('Collection exceeds the supported limit.');
  const keys = new Set();
  return rows.map(row => {
    if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error('Invalid object in collection.');
    const projected = {};
    for (const field of FIELDS[section]) {
      if (!Object.hasOwn(row, field)) continue;
      const value = row[field];
      if (field === 'AuthenticationMethods') {
        if (!Array.isArray(value) || value.length > 30 || value.some(item => typeof item !== 'string' || item.length > 100)) throw new Error('Invalid authentication method list.');
        projected[field] = [...new Set(value)].sort();
      } else {
        if (value !== null && !['string', 'boolean', 'number'].includes(typeof value)) throw new Error('Unexpected field type.');
        if (typeof value === 'string' && value.length > 8192) throw new Error('Field exceeds the supported limit.');
        projected[field] = value;
      }
    }
    const key = identity(section, projected);
    if (keys.has(key)) throw new Error('Duplicate object identities; comparison would be ambiguous.');
    keys.add(key);
    return projected;
  }).sort((a, b) => identity(section, a).localeCompare(identity(section, b)));
}

function shortText(value, max = 300) { return typeof value === 'string' ? value.slice(0, max) : ''; }
export function projectRuntime(data) {
  const fields = { Status: ['UpTime', 'LastBackup', 'SystemMonitor'], Alerts: ['SeriousAlerts', 'ApplicationErrors'], Licensing: ['LicenseLimit', 'LicenseUse'], SystemUsage: ['DatabaseSpace', 'JournalSpace', 'LockTable', 'Processes', 'CSPSessions'] };
  const output = {};
  for (const [group, keys] of Object.entries(fields)) {
    output[group] = {};
    for (const key of keys) if (['string', 'number', 'boolean'].includes(typeof data?.[group]?.[key])) output[group][key] = typeof data[group][key] === 'string' ? data[group][key].slice(0, 300) : data[group][key];
  }
  return output;
}
export function validateSnapshot(input) {
  if (!input || input.schema !== SCHEMA) throw new Error('This is not an IRIS Change Atlas v1 snapshot.');
  if (typeof input.id !== 'string' || !input.id || input.id.length > 100) throw new Error('Snapshot ID is missing or too long.');
  if (!input.source || typeof input.source.id !== 'string' || !input.source.id || input.source.id.length > 300 || typeof input.capturedAt !== 'string' || !Number.isFinite(Date.parse(input.capturedAt))) throw new Error('Snapshot source or timestamp is missing.');
  if (!['live', 'example'].includes(input.source.kind)) throw new Error('Snapshot source kind must be live or example.');
  const snapshot = {
    schema: SCHEMA, id: shortText(input.id, 100), capturedAt: input.capturedAt,
    label: shortText(input.label, 100),
    source: { id: shortText(input.source.id), label: shortText(input.source.label), version: shortText(input.source.version, 500), kind: input.source.kind === 'live' ? 'live' : 'example' },
    sections: {}, runtime: input.runtime?.status === 'ok' ? { status: 'ok', data: projectRuntime(input.runtime.data) } : { status: 'unavailable', reason: shortText(input.runtime?.reason) }
  };
  for (const section of SECTIONS) {
    const data = input.sections?.[section];
    if (!data || !['ok', 'partial', 'unavailable'].includes(data.status)) throw new Error(`Missing evidence status for ${LABELS[section]}.`);
    snapshot.sections[section] = {
      status: data.status,
      reason: shortText(data.reason),
      rows: data.status === 'unavailable' ? [] : normalizeRows(section, data.rows),
      capturedAt: shortText(data.capturedAt, 50)
    };
  }
  return snapshot;
}

export function compare(beforeInput, afterInput) {
  const before = validateSnapshot(beforeInput), after = validateSnapshot(afterInput);
  const sourceMismatch = before.source.id !== after.source.id || before.source.kind !== after.source.kind;
  const result = { before, after, sourceMismatch, changes: [], gaps: [], unchanged: 0, compared: 0, total: 0 };
  for (const section of SECTIONS) {
    const left = before.sections[section], right = after.sections[section];
    if (sourceMismatch || left.status !== 'ok' || right.status !== 'ok') {
      result.gaps.push({ section, before: left.status, after: right.status, reason: sourceMismatch ? 'Different sources. Choose two captures from the same instance.' : `${left.reason || left.status} → ${right.reason || right.status}` });
      continue;
    }
    result.compared++;
    const a = new Map(left.rows.map(row => [identity(section, row), row]));
    const b = new Map(right.rows.map(row => [identity(section, row), row]));
    for (const key of [...new Set([...a.keys(), ...b.keys()])].sort()) {
      result.total++;
      const old = a.get(key), next = b.get(key);
      const type = !old ? 'added' : !next ? 'removed' : canonical(old) !== canonical(next) ? 'changed' : 'unchanged';
      if (type === 'unchanged') { result.unchanged++; continue; }
      const fields = [...new Set([...Object.keys(old || {}), ...Object.keys(next || {})])]
        .filter(field => canonical(old?.[field]) !== canonical(next?.[field]))
        .map(field => ({ field, before: old?.[field], after: next?.[field], hadBefore: !!old && Object.hasOwn(old, field), hasAfter: !!next && Object.hasOwn(next, field) }));
      result.changes.push({ section, key, name: next?.Name || old?.Name || key, type, fields, before: old ?? null, after: next ?? null });
    }
  }
  return result;
}

export function displayValue(value, exists = true) {
  if (!exists) return 'Not present';
  if (value === '') return '(empty string)';
  if (value === null) return 'null';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '(empty list)';
  return String(value);
}
const md = value => String(value).replaceAll('\\', '\\\\').replaceAll('|', '\\|').replace(/[\r\n]/g, ' ').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
export function markdownReport(result, note = '') {
  const { before, after } = result;
  const lines = ['# IRIS Change Atlas — change review', '', `Source: ${md(after.source.label)} (${md(after.source.kind)})`, `Before: ${md(before.label)} — ${before.capturedAt}`, `After: ${md(after.label)} — ${after.capturedAt}`, '', `${result.changes.length} changed objects; ${result.unchanged} unchanged; ${result.compared}/3 collections comparable.`, '', 'These sequential reads are not an atomic database snapshot. Runtime counters are context, not configuration changes. No writes or remediation were performed by this tool.', ''];
  if (note.trim()) lines.push('## Reviewer note', '', md(note.trim().slice(0, 2000)), '');
  for (const gap of result.gaps) lines.push(`**Evidence gap — ${LABELS[gap.section]}:** ${md(gap.reason)}. Additions/removals are not inferred for this collection.`, '');
  for (const change of result.changes) {
    lines.push(`## ${change.type.toUpperCase()} · ${md(change.name)}`, '', `${LABELS[change.section]} · identity ${md(change.key)}`, '', '| Field | Before | After |', '| --- | --- | --- |');
    for (const field of change.fields) lines.push(`| ${md(field.field)} | ${md(displayValue(field.before, field.hadBefore))} | ${md(displayValue(field.after, field.hasAfter))} |`);
    lines.push('');
  }
  if (!result.changes.length) lines.push(result.gaps.length ? 'No confirmed changes within comparable evidence. Unavailable collections prevent an all-clear conclusion.' : 'No configuration differences in the three captured collections. This is not a whole-system compliance or health verdict.');
  lines.push('', 'Export contains configuration metadata. Review it before sharing. Authentication credentials are not included.');
  return lines.join('\n');
}
