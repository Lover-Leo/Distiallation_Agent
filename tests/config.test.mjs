import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp, writeFile, rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {deepseekConfig, loadLocalEnv} from '../src/config.mjs';

test('只读取允许的本地模型配置，已有环境值优先', async t => {
  const dir = await mkdtemp(join(tmpdir(), 'style-agent-env-'));
  t.after(() => rm(dir, {recursive: true, force: true}));
  await writeFile(join(dir, '.env'), 'DEEPSEEK_API_KEY=fake-unit-test\nDEEPSEEK_MODEL=deepseek-flash\nNODE_OPTIONS=not-allowed\n');
  const env = {DEEPSEEK_MODEL: 'custom-model'};
  await loadLocalEnv(join(dir, '.env'), env);
  assert.equal(env.DEEPSEEK_API_KEY, 'fake-unit-test');
  assert.equal(env.DEEPSEEK_MODEL, 'custom-model');
  assert.equal(env.NODE_OPTIONS, undefined);
  assert.deepEqual(await loadLocalEnv(join(dir, 'missing'), {}), {});
});

test('配置限制超时并避免在错误中打印密钥', () => {
  assert.equal(deepseekConfig({}).model, 'deepseek-flash');
  assert.throws(() => deepseekConfig({DEEPSEEK_TIMEOUT_MS: '1'}));
  assert.throws(() => deepseekConfig({DEEPSEEK_API_KEY: 'invalid\r\nsecret'}), error => !error.message.includes('secret'));
});
