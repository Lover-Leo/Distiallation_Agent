import {fileURLToPath} from 'node:url';
process.chdir(fileURLToPath(new URL('../', import.meta.url)));
process.env.BASELINE_DIR = 'outputs/local-baseline-v1';
process.env.CHAT_PROVIDER = 'deepseek';
await import('../src/server.mjs');
