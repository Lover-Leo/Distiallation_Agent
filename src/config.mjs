import {readFile} from 'node:fs/promises';
import {parseEnv} from 'node:util';

export async function loadLocalEnv(path = '.env', env = process.env) {
  try {
    const values = parseEnv(await readFile(path, 'utf8'));
    for (const name of ['DEEPSEEK_API_KEY', 'DEEPSEEK_MODEL', 'DEEPSEEK_TIMEOUT_MS']) {
      if (env[name] === undefined && values[name] !== undefined) env[name] = values[name];
    }
  } catch (error) {
    if (error.code !== 'ENOENT') throw error;
  }
  return env;
}

export function deepseekConfig(env = process.env) {
  const apiKey = (env.DEEPSEEK_API_KEY || '').trim();
  if (apiKey && !/^[a-zA-Z0-9._-]+$/.test(apiKey)) throw Error('DEEPSEEK_API_KEY 格式无效，请检查本机配置。');
  const model = env.DEEPSEEK_MODEL || 'deepseek-flash';
  if (!/^[a-zA-Z0-9._-]{1,100}$/.test(model)) throw Error('DEEPSEEK_MODEL 格式无效。');
  const timeoutMs = Number(env.DEEPSEEK_TIMEOUT_MS || 45000);
  if (!Number.isInteger(timeoutMs) || timeoutMs < 1000 || timeoutMs > 120000) throw Error('DeepSeek 超时须为 1000—120000 毫秒。');
  return {apiKey, model, timeoutMs};
}
