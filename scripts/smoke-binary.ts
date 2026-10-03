import { chmod, mkdir, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve } from 'node:path';
import { version as packageVersion } from '../package.json';
import { ConfigStore } from '../src/storage/config.ts';
import { saveCredential } from '../src/storage/credentials.ts';
import { parseTasks } from '../src/storage/tasks.ts';
import { taskWorkflow } from '../tests/task-provider-fixture.ts';

const root = await mkdtemp(join(tmpdir(), 's42-binary-smoke-'));
const source = resolve(Bun.argv[2] ?? `dist/s42-agent-${packageVersion}-linux-x64`), binary = join(root, 's42-agent');
await Bun.write(binary, Bun.file(source)); await chmod(binary, 0o755);
await Bun.write(join(root, 'code.ts'), 'const value = 1;');
await mkdir(join(root, 'smoke'));
await Bun.write(join(root, 'smoke/SKILL.md'), '---\nname: smoke\ndescription: Smoke test coding\n---\nPreserve code and report checked results.');
let calls = 0, mcpEffects = 0, skillLoaded = false, output = '', cliMode = false, authenticated = 0, shellOutput = '';
const workflow = taskWorkflow(4);
const failedCalls = new Set<string>();
const stream = (delta: object, finishReason: string) => new Response(`data: ${JSON.stringify({ choices: [{ delta, finish_reason: finishReason }] })}\n\ndata: [DONE]\n\n`);
const mcp = Bun.serve({ port: 0, async fetch(req) {
  const p = await req.json() as any;
  return Response.json({ jsonrpc: '2.0', id: p.id, result: p.method === 'server/discover'
    ? { supportedVersions: ['2026-07-28'], capabilities: { tools: {} } }
    : p.method === 'tools/list' ? { tools: [{ name: 'check', description: 'Smoke check', inputSchema: { type: 'object', properties: {} } }] }
    : { content: [{ type: 'text', text: 'BINARY_MCP ' + (++mcpEffects) }] } });
} });
const llm = Bun.serve({ port: 0, async fetch(req) {
  if (req.headers.get('authorization') !== 'Bearer binary-sqlite-fixture') return new Response('Missing saved SQLite credential', { status: 401 });
  if (req.method !== 'POST') return new Response('Fixture has no discovery metadata', { status: 404 });
  authenticated++;
  const p = await req.json() as any;
  if (cliMode) return stream({ content: 'BINARY_CLI' }, 'stop');
  for (const message of p.messages.filter((m: any) => m.role === 'tool')) {
    const result = JSON.parse(message.content);
    if (result.failed && !failedCalls.has(message.tool_call_id)) { failedCalls.add(message.tool_call_id); console.error(JSON.stringify({ failedCall: message.tool_call_id, output: result.output })); }
    if (message.tool_call_id === 'smoke-4' && !result.failed) shellOutput = JSON.parse(result.output).stdout;
  }
  const flow = workflow(p); if (flow) return flow;
  calls++; skillLoaded = p.messages[0].content.includes('Preserve code');
  const mcpName = p.tools.find((t: any) => t.function.name.startsWith('mcp_')).function.name;
  const definitions = [
    { name: 'read', arguments: '{"path":"code.ts"}' }, { name: mcpName, arguments: '{}' },
    { name: 'edit', arguments: '{"path":"code.ts","oldText":"value = 1","newText":"value = 2"}' },
    { name: 'shell', arguments: '{"command":"pwd"}' },
  ];
  const call = definitions[calls - 1];
  return stream(call ? { tool_calls: [{ index: 0, id: 'smoke-' + calls, function: call }] } : { content: 'BINARY_COMPLETE' }, call ? 'tool_calls' : 'stop');
} });
const configPath = join(root, 'agent.sqlite'), store = await ConfigStore.load(configPath), config = store.value;
config.providers[0]!.baseUrl = `http://127.0.0.1:${llm.port}/v1`;
config.providers[0]!.models = [{ id: 'smoke', name: 'Smoke', manual: true, contextWindow: 32000, capabilities: { tools: true, images: false } }];
await saveCredential(config.providers[0]!, 'binary-sqlite-fixture', configPath);
config.defaults.modelId = 'smoke';
config.mcpServers = [{ id: 'mcp', name: 'Smoke', enabled: true, transport: 'http', url: `http://127.0.0.1:${mcp.port}` }];
config.skills = [{ id: 'smoke', name: 'smoke', path: join(root, 'smoke/SKILL.md'), enabled: true }];
await store.save(config);
const terminal = new Bun.Terminal({ cols: 80, rows: 24, data: (_, bytes) => output += new TextDecoder().decode(bytes) });
let child: Bun.Subprocess | undefined;
async function until(check: () => boolean) {
  const deadline = Date.now() + 5000;
  while (!check()) { if (Date.now() > deadline) throw new Error('Timeout smoke ' + output.slice(-1000)); await Bun.sleep(2); }
}
try {
  const env = { TERM: 'xterm-256color', PATH: '/nonexistent', DBUS_SESSION_BUS_ADDRESS: 'unix:path=/nonexistent-s42-keyring' };
  const versionProcess = Bun.spawn([binary, '--version'], { cwd: root, env, stdout: 'pipe', stderr: 'pipe' });
  const version = (await new Response(versionProcess.stdout).text()).trim();
  if (await versionProcess.exited !== 0 || version !== packageVersion) throw new Error('Version smoke failed');
  child = Bun.spawn([binary, '--config', configPath, '--cwd', root], { cwd: root, env, terminal });
  await until(() => output.includes('Prompt'));
  terminal.write('/skill smoke check coding\r');
  await until(() => output.includes('BINARY_COMPLETE') && output.includes('Listo · uso no reportado'));
  terminal.write('\x11'); if (await child.exited !== 0) throw new Error('Exit smoke failed');
  await until(() => output.includes('\x1b[?1049l'));
  const tasks = parseTasks(await Bun.file(join(root, 'TODO.md')).text()).tasks;
  if (!skillLoaded || mcpEffects !== 1 || shellOutput.trim() !== root || await Bun.file(join(root, 'code.ts')).text() !== 'const value = 2;'
    || tasks.length !== 1 || tasks[0]!.status !== 'done' || !tasks[0]!.acceptanceEvidence.length) throw new Error('Effects or task verification not verified');
  cliMode = true;
  const cli = Bun.spawn([binary, '--config', configPath, '--cwd', root, '--prompting', 'Read saved credential'], { cwd: root, env, stdout: 'pipe', stderr: 'pipe' });
  const [code, cliOutput, cliError] = await Promise.all([cli.exited, new Response(cli.stdout).text(), new Response(cli.stderr).text()]);
  if (code !== 0 || cliOutput.trim() !== 'BINARY_CLI' || (cliOutput + cliError + output).includes('binary-sqlite-fixture')) throw new Error('CLI credential reopen smoke failed');
  const result = {
    at: new Date().toISOString(), platform: process.platform, arch: process.arch, version,
    sha256: new Bun.CryptoHasher('sha256').update(await Bun.file(binary).arrayBuffer()).digest('hex'),
    calls, mcpEffects, skillLoaded, edited: true, shell: true, restored: true, planVerified: true, sqliteCredentials: true, cliReopened: true, authenticated,
    cwd: 'temporary outside checkout', PATH: '/nonexistent',
    limits: 'Host Bun exists for fixture/PTY driver; agent executable runs directly without Bun/Node or checkout files; LLM/MCP are external HTTP fixtures; no physical mouse/drop',
  };
  await Bun.write(resolve(import.meta.dir, '../dist/binary-smoke.json'), JSON.stringify(result, null, 2) + '\n');
  const manifestPath = resolve(import.meta.dir, '../dist/build-targets.json');
  if (await Bun.file(manifestPath).exists()) {
    const manifest = await Bun.file(manifestPath).json();
    const entry = manifest.entries.find((e: any) => e.sha256 === result.sha256);
    if (entry) { entry.runtimeValidated = true; entry.runtimeEvidence = 'binary-smoke.json'; await Bun.write(manifestPath, JSON.stringify(manifest, null, 2) + '\n'); }
  }
  console.log(JSON.stringify(result));
} finally { child?.kill(); terminal.close(); llm.stop(true); mcp.stop(true); await rm(root, { recursive: true, force: true }); }
