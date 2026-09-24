// Applies only to the disposable contest container created for this project.
import { randomBytes } from 'node:crypto';
import { mkdir, writeFile, readFile } from 'node:fs/promises';
import { spawnSync } from 'node:child_process';
const container = 'xinmi-iris-change-atlas';
await mkdir('.local', { recursive: true });
let existing;
try { existing = JSON.parse(await readFile('.local/iris.json', 'utf8')); }
catch (error) { if (error.code !== 'ENOENT') throw error; }
if (existing && !process.argv.includes('--reuse-for-new-container')) throw new Error('Local credentials already exist. Refusing to replace them.');
const check = spawnSync('docker', ['inspect', container, '--format', '{{index .Config.Labels "xinmi.project"}}'], { encoding: 'utf8' });
if (check.status !== 0 || check.stdout.trim() !== 'iris-change-atlas') throw new Error('Expected project-owned container is not available.');
const password = existing?.password || `Atlas!${randomBytes(24).toString('hex')}`;
const program = `set p("Password")="${password.replaceAll('"', '""')}"\nset sc=##class(Security.Users).Modify("_SYSTEM",.p)\nwrite !,"ATLAS_PASSWORD_STATUS=",sc,!\nhalt\n`;
const result = spawnSync('docker', ['exec', '-i', container, 'iris', 'session', 'IRIS', '-U', '%SYS'], { input: program, encoding: 'utf8', timeout: 20000 });
// Terminal output can echo input, so never print it or include it in thrown errors.
if (result.status !== 0 || !result.stdout.includes('ATLAS_PASSWORD_STATUS=1')) throw new Error('Password setup did not return success; raw terminal output withheld.');
if (!existing) await writeFile('.local/iris.json', JSON.stringify({ baseUrl: 'http://127.0.0.1:52774', username: '_SYSTEM', password }, null, 2), { mode: 0o600, flag: 'wx' });
console.log('Disposable container password changed. Local credentials saved in ignored .local/iris.json.');
