// Optional local browser check. playwright-core is installed only in ignored outputs/ui-tools.
let browserTools;
try {browserTools = await import('../outputs/ui-tools/node_modules/playwright-core/index.mjs');}
catch (error) {if(error.code!=='ERR_MODULE_NOT_FOUND')throw error;browserTools = await import('../outputs/ui-tools/package/index.mjs');}
const {chromium} = browserTools;
import {readFile, mkdir, writeFile} from 'node:fs/promises';
import assert from 'node:assert/strict';
const html = await readFile(new URL('../src/web/chat.html', import.meta.url), 'utf8');
const browser = await chromium.launch({executablePath: 'C:/Program Files/Google/Chrome/Application/chrome.exe', headless: true});
const reports = [];
await mkdir('outputs/ui-check', {recursive: true});
try {
  for (const viewport of [{width:1440,height:900},{width:1280,height:720},{width:390,height:844},{width:360,height:640},{width:800,height:450}]) {
    const page = await browser.newPage({viewport});
    const errors = []; page.on('pageerror', e => errors.push(e.message));
    const id = '11111111-1111-4111-8111-111111111111';
    const messages = Array.from({length:80}, (_,i) => ({role:i%2?'assistant':'user', content:i%2?`虚构回复 ${i}：今天就轻松一点，慢慢聊。`:`虚构问题 ${i}：接下来有什么安排？`}));
    let generations = 0, release;
    await page.route('**/*', async route => {
      const path = new URL(route.request().url()).pathname;
      let data;
      if (path === '/') {await route.fulfill({contentType:'text/html; charset=utf-8', body:html});return;}
      if (path === '/api/status') data = {provider:'DeepSeek', ready:true, model:'fictional-model'};
      else if (path === '/api/sessions') data = [{id, title:'虚构长标题：我们今天想聊的一些日常安排'}];
      else if (path === '/api/sessions/'+id) data = {id, messages};
      else if (path === '/api/generate') {
        generations++;
        const {message} = route.request().postDataJSON();
        await new Promise(resolve => {release = resolve;});
        messages.push({role:'user',content:message},{role:'assistant',content:'虚构的新回复。'});
        data = {reply:'虚构的新回复。',evidence:[],truncated:false,contextLimited:false};
      } else {await route.fulfill({status:404,body:'{}'});return;}
      await route.fulfill({contentType:'application/json',body:JSON.stringify(data)});
    });
    await page.goto('http://127.0.0.1:19876/');
    await page.waitForFunction(() => !document.querySelector('#send').disabled);
    const measure = () => page.evaluate(() => {
      const send=document.querySelector('#send').getBoundingClientRect(), history=document.querySelector('#history');
      return {height:innerHeight,bodyHeight:document.documentElement.scrollHeight,width:innerWidth,bodyWidth:document.documentElement.scrollWidth,sendRight:send.right,sendBottom:send.bottom,sendTop:send.top,historyHeight:history.clientHeight,scrollable:history.scrollHeight>history.clientHeight};
    });
    const initial = await measure();
    assert.ok(initial.bodyHeight<=viewport.height+1 && initial.bodyWidth<=viewport.width+1, 'Outer page must not scroll');
    assert.ok(initial.sendTop>=0 && initial.sendBottom<=viewport.height, 'Send button must stay visible');
    assert.ok(initial.sendRight<=viewport.width,'Send button must fit horizontally');
    assert.ok(initial.scrollable && initial.historyHeight>=100, 'History must scroll independently');
    await page.evaluate(() => {window.originalMessage=document.querySelector('.message');});
    await page.locator('textarea').fill('虚构消息：测试发送');
    await page.locator('textarea').press('Enter');
    await page.waitForSelector('.pending');
    while (!release) await new Promise(resolve => setTimeout(resolve, 10));
    release();
    await page.waitForFunction(() => !document.querySelector('.pending') && !document.querySelector('#send').disabled);
    assert.equal(await page.evaluate(() => window.originalMessage.isConnected),true,'Sending should not rebuild previous messages');
    assert.equal(generations,1);
    await page.locator('textarea').fill('第一行');
    await page.locator('textarea').press('Shift+Enter');
    assert.match(await page.locator('textarea').inputValue(),/\n/);
    assert.equal(generations,1,'Shift+Enter must not send');
    release=null;
    await page.locator('textarea').fill('虚构消息：滚动期间回复');
    await page.locator('textarea').press('Enter');
    await page.waitForSelector('.pending');
    while(!release) await new Promise(resolve => setTimeout(resolve,10));
    await page.locator('#history').evaluate(el => {el.scrollTop=0;});
    release();
    await page.waitForFunction(() => !document.querySelector('.pending') && !document.querySelector('#send').disabled);
    assert.ok(await page.locator('#history').evaluate(el => el.scrollTop<50),'Reading old messages must not jump to latest');
    assert.ok(await page.locator('#jump').isVisible());
    await page.locator('#jump').click();
    await page.locator('#about').click();
    assert.ok(await page.locator('#about-dialog').isVisible());
    await page.locator('#about-dialog [data-close]').click();
    const final=await measure();assert.ok(final.sendBottom<=viewport.height && final.bodyHeight<=viewport.height+1);
    await page.screenshot({path:`outputs/ui-check/chat-${viewport.width}x${viewport.height}.png`});
    assert.deepEqual(errors,[]);
    reports.push({...viewport,...initial,generations,oldMessagesPreserved:true,readingPositionPreserved:true,errors});
    await page.close();
  }
  await writeFile('outputs/ui-check/report.json',JSON.stringify(reports,null,2));
  console.log(JSON.stringify(reports));
} finally {await browser.close();}
