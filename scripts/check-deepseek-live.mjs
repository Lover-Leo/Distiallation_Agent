import {spawn} from 'node:child_process';
import {mkdir, writeFile} from 'node:fs/promises';
if (!process.argv.includes('--live')) throw Error('此检查会调用 DeepSeek 并发送已授权的小量训练示例。执行时需显式传入 --live。');
const port = 18766;
const child = spawn(process.execPath, ['src/server.mjs'], {
  env: {...process.env, PORT: String(port), BASELINE_DIR: 'outputs/local-baseline-v1', CHAT_PROVIDER: 'deepseek'},
  stdio: ['ignore', 'pipe', 'pipe']
});
const report = {checkedAt: new Date().toISOString(), provider: 'DeepSeek', rounds: [], scope: '最多3个训练示例、统计画像及本次测试会话；按用户明确授权执行。'};
try {
  await new Promise((resolve, reject) => {
    child.stdout.once('data', resolve); child.once('error', reject); child.once('exit', () => reject(Error('本地服务退出。')));
    setTimeout(() => reject(Error('本地服务启动超时。')), 10000).unref();
  });
  async function api(path, method = 'GET', body) {
    const response = await fetch(`http://127.0.0.1:${port}${path}`, {method, headers: body ? {'Content-Type': 'application/json'} : {}, body: body ? JSON.stringify(body) : undefined, signal: AbortSignal.timeout(125000)});
    const data = await response.json();
    if (!response.ok) throw Error(`HTTP ${response.status}: ${data.code || 'request_failed'}`);
    return data;
  }
  const status = await api('/api/status');
  if (!status.ready) throw Error('missing_api_key');
  report.model = status.model;
  const session = await api('/api/sessions', 'POST');
  for (const [i, message] of ['今天晚饭吃什么？', '我想清淡一点，接着刚才的话说。'].entries()) {
    const started = performance.now();
    const result = await api('/api/generate', 'POST', {session_id: session.id, message});
    if (typeof result.reply !== 'string' || !result.reply.trim()) throw Error('empty_reply');
    report.rounds.push({round: i + 1, elapsedMs: Math.round(performance.now() - started), replyCharacters: result.reply.length, retrievedExamples: result.evidence.length, truncated: result.truncated});
    console.log(JSON.stringify(report.rounds.at(-1)));
  }
  if ((await api('/api/sessions/' + session.id)).messages.length !== 4) throw Error('history_failed');
  await api('/api/sessions/' + session.id + '/clear', 'POST');
  if ((await api('/api/sessions/' + session.id)).messages.length) throw Error('clear_failed');
  await api('/api/sessions/' + session.id, 'DELETE');
  report.status = 'passed';
} catch (error) {
  report.status = 'failed'; report.error = error.message;
  process.exitCode = 1;
} finally {
  child.kill();
  await mkdir('outputs/deepseek', {recursive: true});
  await writeFile('outputs/deepseek/live-check.json', JSON.stringify(report, null, 2));
  console.log(JSON.stringify(report));
}
