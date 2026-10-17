import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox', '--disable-dev-shm-usage'] })
const page = await browser.newPage()
await page.setViewport({ width: 1024, height: 700 })
const results = [], errors = []
page.on('pageerror', e => errors.push(e.message))
await page.goto(process.env.TYPO_URL || 'http://127.0.0.1:1420/?e2e=1', { waitUntil: 'networkidle2' })
await page.waitForFunction(() => window.__typo)
await page.evaluate(async () => {
  window.A = await import('/src/commands/actions.ts')
  window.P = await import('/src/commands/prose.ts')
  window.H = await import('/src/composables/useHotkeys.ts')
  window.M = (await import('/src/composables/useEditorMenu.ts')).useEditorMenu()
  window.T = (await import('/src/i18n/index.ts')).i18n.global.t
  window.UI = (await import('/src/composables/useUI.ts')).useUI()
  window.core = await import('/node_modules/@milkdown/core/lib/index.js').catch(() => null)
})
const delay = () => new Promise(r => setTimeout(r, 100))
async function test(name, fn) {
  try { await fn(); results.push({ name, status: 'pass' }) }
  catch (e) { results.push({ name, status: 'fail', error: e.message }); console.log('FAIL', name, e.message) }
}
async function reset(md = 'alpha beta\n\nsecond\n') {
  await page.evaluate(async md => {
    window.M.hide()
    document.dispatchEvent(new KeyboardEvent('keydown',{key:'Escape',bubbles:true}))
    for (const key of ['findOpen','settingsOpen','commandPaletteOpen','quickOpenOpen','sourceMode']) window.UI[key].value = false
    await new Promise(resolve => setTimeout(resolve, 0))
    window.__typo.loadMarkdown(md)
    const e=window.__typo.getEditor()
    window.P.setSelectionRange(e, 1, Math.min(6, md.length))
  }, md)
  await delay()
}
const markdown = () => page.evaluate(() => window.__typo.getMarkdown())
async function menu(id) {
  // Open the relevant top level menu, then the ancestors of this leaf.
  const found = await page.evaluate(async id => {
    for (const title of document.querySelectorAll('.menu-title')) {
      title.click(); await new Promise(r => setTimeout(r, 0))
      for (let i=0;i<3;i++) {
        const leaf=document.querySelector(`.menu-item-btn[data-command="${id}"]`)
        if (leaf) { leaf.click(); return true }
        for(const item of document.querySelectorAll('.menu-dropdown .has-sub')) item.dispatchEvent(new MouseEvent('mouseenter'))
        await new Promise(r => setTimeout(r,0))
      }
    }
    return false
  }, id)
  assert.ok(found, `menu ${id} missing`)
  await delay()
}
async function tool(id) { await page.click(`.toolbar [data-command="${id}"]`); await delay() }
const cases = [
  ['h1', /^# alpha/m], ['h2', /^## alpha/m], ['h3', /^### alpha/m], ['h4', /^#### alpha/m], ['h5', /^##### alpha/m], ['h6', /^###### alpha/m],
  ['incHeading', /^###### alpha/m], ['decHeading', /^# alpha/m],
  ['bold', /\*\*alpha\*\*/], ['italic', /\*alpha\*/], ['underline', /<u>alpha<\/u>/], ['strike', /~~alpha~~/], ['inlineCode', /`alpha`/],
  ['link', /\[alpha\]\(/], ['quote', /^> alpha/m], ['orderedList', /^1\.\s+alpha/m], ['unorderedList', /^\*\s+alpha/m], ['taskList', /\[[ x]\]/],
  ['codeBlock', /```/], ['mathBlock', /\$\$/], ['inlineMath', /\$E = mc\^2\$/], ['table-insert', /\|/], ['horizontalRule', /(?:---|\*\*\*)/], ['toc', /TOC/i],
  ['footnote', /\[\^/], ['linkReference', /\[.*\]:/], ['comment', /<!--/], ['insertParaAbove', /alpha/], ['insertParaBelow', /alpha/],
  ...['note','tip','important','warning','caution'].map(x=>[`alert-${x}`, new RegExp(`\\[!${x.toUpperCase()}\\]`)]),
]
for (const [id, expected] of cases) await test(`menu:${id}`, async () => { await reset(); await menu(id); assert.match(await markdown(),expected) })
for(const [id,expected] of cases.filter(([id])=>['bold','italic','underline','strike','inlineCode','link','quote','orderedList','unorderedList','taskList','codeBlock','mathBlock'].includes(id))) {
 await test(`toolbar:${id}`,async()=>{ await reset(); await tool(id); assert.match(await markdown(),expected) })
}
await test('paragraph conversion',async()=>{await reset('# alpha beta');await menu('paragraph');assert.doesNotMatch(await markdown(),/^#/m)})
await test('clear formatting',async()=>{await reset('**alpha** beta');await menu('clearFormat');assert.doesNotMatch(await markdown(),/\*\*alpha/)})
await test('unique effective shortcuts',async()=>{assert.equal(await page.evaluate(()=>{const values=Object.values(window.H.getEffectiveHotkeys());return values.some((a,i)=>values.slice(i+1).some(b=>window.H.sameHotkey(a,b)))}),false)})
for(const [id,expected] of cases.filter(([id])=>['bold','italic','underline','strike','inlineCode','quote','orderedList','unorderedList','taskList','codeBlock'].includes(id))) {
 await test(`shortcut:${id}`,async()=>{await reset();await page.evaluate(id=>{const s=window.H.getHotkey(id);const code=s.code||(/^[a-z]$/.test(s.key)?`Key${s.key.toUpperCase()}`:s.key==='['?'BracketLeft':s.key===']'?'BracketRight':/^\d$/.test(s.key)?`Digit${s.key}`:'');const shifted={'5':'%','[':'{',']':'}','`':'~'};document.querySelector('.ProseMirror').dispatchEvent(new KeyboardEvent('keydown',{key:s.shift?(shifted[s.key]||s.key.toUpperCase()):s.key,code,ctrlKey:!!s.ctrl,shiftKey:!!s.shift,altKey:!!s.alt,bubbles:true,cancelable:true}))},id);await delay();assert.match(await markdown(),expected)})
}
await test('replace opens replacement controls',async()=>{await reset();await menu('replace');assert.ok(await page.$('.find-bar input[placeholder="替换为…"]') || await page.$$eval('.find-bar .fld', els=>els.length===2))})
for(const id of ['focusMode','typewriterMode','outline','fileTree','toggleSidebar','zoomIn','zoomOut','zoomActual','quickOpen','preferences','commandPalette','find','sourceMode']) await test(`view/dialog:${id}`,async()=>{await reset();await menu(id)})
for(const theme of ['github','gothic','newsprint','night','pixyll','whitey']) await test(`theme:${theme}`,async()=>{await reset();await menu(`theme-${theme}`);assert.equal(await page.evaluate(()=>document.documentElement.dataset.theme),theme)})
const tableMd='| A | B |\n| --- | --- |\n| C | D |\n| E | F |\n'
for(const id of ['table-row-above','table-row-below','table-col-left','table-col-right','table-move-row-up','table-move-row-down','table-move-col-left','table-move-col-right','table-del-row','table-del-col','table-copy','table-format','table-del']) await test(`table:${id}`,async()=>{await reset(tableMd);await page.click('.ProseMirror td');await menu(id);if(id==='table-del') assert.doesNotMatch(await markdown(),/\|/); else assert.ok((await markdown()).length>0)})
await test('context selected text bold',async()=>{await reset();await page.evaluate(()=>{const el=document.querySelector('.ProseMirror p');const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+15,clientY:r.top+10}))});await page.waitForSelector('.ctx-menu');await page.click('.ctx-menu button[aria-label="加粗"]');assert.match(await markdown(),/\*\*alpha\*\*/)})
await test('scrolling popup stays inside viewport',async()=>{await reset(tableMd);await page.setViewport({width:800,height:300});await page.evaluate(()=>{const el=document.querySelector('.ProseMirror td');const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+10,clientY:r.top+10}))});await page.waitForSelector('.ctx-menu');await page.hover('.ctx-item.has-sub');await delay();const metrics=await page.evaluate(()=>[...document.querySelectorAll('.ctx-menu,.ctx-submenu')].map(el=>{const r=el.getBoundingClientRect();el.scrollTop=el.scrollHeight;return {left:r.left,top:r.top,right:r.right,bottom:r.bottom,scroll:el.scrollTop,scrollable:el.scrollHeight>el.clientHeight}}));for(const m of metrics){assert.ok(m.left>=0&&m.top>=0&&m.right<=801&&m.bottom<=301,JSON.stringify(m))}assert.ok(metrics.some(m=>m.scrollable&&m.scroll>0));await page.setViewport({width:1024,height:700})})

for (const id of ['unorderedList','orderedList','taskList','quote']) await test(`toggle off:${id}`,async()=>{await reset();await menu(id);await menu(id);assert.match(await markdown(),/alpha beta/);assert.doesNotMatch(await markdown(),id==='taskList'?/\[[ x]\]/:/^([*>]|1\.)/m)})
await test('task list preserves selected text',async()=>{await reset();await menu('taskList');assert.match(await markdown(),/alpha beta/);assert.equal(await page.evaluate(()=>window.A.taskListActive()),true)})
await test('undo and redo',async()=>{await reset();await menu('bold');await menu('undo');assert.doesNotMatch(await markdown(),/\*\*alpha/);await menu('redo');assert.match(await markdown(),/\*\*alpha/)})
await test('toolbar heading dropdown follows current block',async()=>{await reset();await menu('h3');await page.evaluate(()=>document.dispatchEvent(new Event('selectionchange')));await delay();assert.equal(await page.$eval('.block-select',e=>e.value),'h3')})
await test('native editor aliases are removed',async()=>{await reset();await page.keyboard.down('Control');await page.keyboard.press('e');await page.keyboard.up('Control');assert.doesNotMatch(await markdown(),/`alpha`/)})
await test('shifted physical shortcuts',async()=>{await reset();await page.keyboard.down('Control');await page.keyboard.down('Shift');await page.keyboard.press('Digit1');await page.keyboard.up('Shift');await page.keyboard.up('Control');assert.equal(await page.evaluate(()=>window.UI.sidebarView.value),'outline')})
await test('shortcut recording canonicalizes shifted punctuation',async()=>{assert.equal(await page.evaluate(()=>window.H.specFromEvent(new KeyboardEvent('keydown',{key:'{',code:'BracketLeft',ctrlKey:true,shiftKey:true})).key),'[')})
await test('clipboard selected Markdown',async()=>{
  await browser.defaultBrowserContext().overridePermissions('http://127.0.0.1:1420',['clipboard-read','clipboard-sanitized-write'])
  await reset('**alpha** beta\n\nsecond');await menu('copyAsMarkdown');assert.equal((await page.evaluate(()=>navigator.clipboard.readText())).trim(),'**alpha**')
})
await test('clipboard copy and cut',async()=>{await reset();await menu('copy');assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'alpha');await menu('cut');assert.doesNotMatch(await markdown(),/alpha/)})
await test('paste plain text',async()=>{await reset();await page.evaluate(()=>navigator.clipboard.writeText('**literal**'));await menu('pastePlain');assert.match(await page.$eval('.ProseMirror',e=>e.textContent),/\*\*literal\*\*/);assert.equal(await page.$('.ProseMirror strong'),null)})
await test('paste Markdown',async()=>{await reset();await page.evaluate(()=>navigator.clipboard.writeText('**rich**'));await menu('paste');assert.match(await markdown(),/\*\*rich\*\*/)})
await test('replace all changes content',async()=>{await reset('alpha alpha');await menu('replace');await page.evaluate(async()=>{const f=(await import('/src/composables/useFind.ts')).useFind();f.findText.value='alpha';f.replaceText.value='omega';await f.replaceAll()});assert.match(await markdown(),/omega omega/)})
await test('reference survives reload',async()=>{await reset();await menu('linkReference');const md=await markdown();await reset(md);assert.match(await markdown(),/\[ref\]: https:\/\//)})
await test('block handle opens floating menu',async()=>{await reset();const box=await page.$eval('.ProseMirror p',e=>{const r=e.getBoundingClientRect();return{x:r.left+20,y:r.top+r.height/2}});await page.mouse.move(box.x,box.y);await new Promise(r=>setTimeout(r,400));const grip=await page.$('.milkdown-block-handle .operation-item:last-child');assert.ok(grip);await grip.click();await page.waitForSelector('.ctx-menu',{timeout:2000});assert.ok(await page.$('.ctx-menu'))})
await test('main dropdown stays below menu bar',async()=>{await page.keyboard.press('Escape');await page.click('.menu-title');await delay();const r=await page.$eval('.menu-dropdown',e=>{const r=e.getBoundingClientRect();return{top:r.top,bottom:r.bottom}});assert.ok(r.top<60&&r.bottom<=700,JSON.stringify(r));await page.keyboard.press('Escape')})
await test('local image toolbar opens file picker',async()=>{await reset();const chooser=page.waitForFileChooser();await tool('insertLocalImage');await (await chooser).cancel()})
for (const id of ['flowchart','sequence','class','state','er','gantt','pie','journey']) await test(`diagram:${id}`,async()=>{await reset();await page.click('.tb-dropdown > button');await page.evaluate(id=>{const ids=['flowchart','sequence','class','state','er','gantt','pie','journey'];document.querySelectorAll('.tb-menu-item')[ids.indexOf(id)].click()},id);await delay();assert.match(await markdown(),/```mermaid/)})
await test('context insert submenu scroll reaches final item',async()=>{await reset();await page.setViewport({width:800,height:300});await page.evaluate(()=>{const el=document.querySelector('.ProseMirror p');const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+10,clientY:r.top+10}))});await page.hover('.ctx-item.has-sub:last-child');await delay();await page.$eval('.ctx-submenu',el=>{el.scrollTop=el.scrollHeight});assert.ok(await page.$eval('.ctx-submenu',el=>{const last=el.lastElementChild.getBoundingClientRect(),r=el.getBoundingClientRect();return last.bottom<=r.bottom&&last.top>=r.top}));await page.screenshot({path:'tests/menu-viewport.png'});await page.setViewport({width:1024,height:700});await page.keyboard.press('Escape')})

async function context() {
  await page.evaluate(()=>{const el=document.querySelector('.ProseMirror p, .ProseMirror td');const r=el.getBoundingClientRect();el.dispatchEvent(new MouseEvent('contextmenu',{bubbles:true,cancelable:true,clientX:r.left+15,clientY:r.top+10}))})
  await page.waitForSelector('.ctx-menu')
}
for(const [key,expected] of [['bold',/\*\*alpha\*\*/],['italic',/\*alpha\*/],['inlineCode',/`alpha`/],['link',/\[alpha\]\(/],['strike',/~~alpha~~/],['quote',/^> alpha/m],['bulletList',/^\* alpha/m],['orderedList',/^1\. alpha/m],['taskList',/\[ \] alpha/]]) await test(`context format:${key}`,async()=>{await reset();await context();await page.evaluate(key=>document.querySelector(`.ctx-menu button[aria-label="${window.T('ctx.'+key)}"]`).click(),key);assert.match(await markdown(),expected)})
for(let n=1;n<=6;n++)await test(`context heading:${n}`,async()=>{await reset();await context();await page.hover('.ctx-item.has-sub');await page.evaluate(n=>{document.querySelectorAll('.ctx-row-item')[n].click()},n);assert.match(await markdown(),new RegExp(`^${'#'.repeat(n)} alpha`,'m'))})
for(const [key,expected] of [['horizontalRule',/(---|\*\*\*)/],['table',/\|/],['codeBlock',/```/],['mathBlock',/\$\$/],['footnote',/\[\^/],['linkRef',/\[ref\]:/],['toc',/toc/i],['yaml',/title: Untitled/],['paraAbove',/alpha/],['paraBelow',/alpha/]]) await test(`context insert:${key}`,async()=>{await reset();await context();await page.hover('.ctx-item.has-sub:last-child');await page.evaluate(key=>{const text=window.T('ctx.'+key);[...document.querySelectorAll('.ctx-row-item')].find(el=>el.querySelector('.lbl')?.textContent.trim()===text).click()},key);assert.match(await markdown(),expected)})
await test('shortcut customization updates every surface and removes original',async()=>{await reset();await page.evaluate(async()=>{const settings=(await import('/src/stores/settings.ts')).useSettingsStore();settings.update({hotkeys:{bold:{ctrl:true,alt:true,key:'b'}}})});assert.match(await page.$eval('.toolbar [data-command="bold"]',e=>e.title),/Alt/);await page.keyboard.down('Control');await page.keyboard.press('b');await page.keyboard.up('Control');assert.doesNotMatch(await markdown(),/\*\*alpha/);await page.keyboard.down('Control');await page.keyboard.down('Alt');await page.keyboard.press('b');await page.keyboard.up('Alt');await page.keyboard.up('Control');assert.match(await markdown(),/\*\*alpha/);await page.evaluate(async()=>{(await import('/src/stores/settings.ts')).useSettingsStore().update({hotkeys:{}})})})
await test('table row shortcut changes row count',async()=>{await reset(tableMd);await page.click('.ProseMirror td');const before=await page.$$eval('.ProseMirror tr',els=>els.length);await page.keyboard.down('Control');await page.keyboard.press('Enter');await page.keyboard.up('Control');assert.equal(await page.$$eval('.ProseMirror tr',els=>els.length),before+1)})

await test('YAML front matter is inserted at document start and survives reload',async()=>{await reset();await context();await page.hover('.ctx-item.has-sub:last-child');await page.evaluate(()=>[...document.querySelectorAll('.ctx-row-item')].find(e=>e.textContent.includes('YAML')).click());const md=await markdown();assert.match(md,/^---\ntitle: Untitled\ndate:/);assert.match(md,/alpha beta/);await reset(md);assert.match(await markdown(),/^---\ntitle: Untitled/);assert.ok(await page.$('[data-front-matter]'))})
await test('footnotes preserve selection and round trip with definitions',async()=>{await reset();await menu('footnote');const md=await markdown();assert.match(md,/alpha\[\^1\] beta/);assert.match(md,/\[\^1\]:/);await reset(md);assert.ok(await page.$('[data-footnote-reference="1"]'));assert.ok(await page.$('[data-footnote-definition="1"]'))})
for(const [id,expected]of [['task-selected',/\[x\]/],['task-unselected',/\[ \]/],['task-ignored',/\* alpha/]])await test(`task status:${id}`,async()=>{await reset('* [ ] alpha');await page.click('.ProseMirror p');await menu(id);assert.match(await markdown(),expected)})
for(const id of ['indent-selection','indent-block','copy-code'])await test(`code tools:${id}`,async()=>{await reset('```js\nconst a = 1\n```');await page.click('.cm-content');await menu(id);if(id==='copy-code')assert.match(await page.evaluate(()=>navigator.clipboard.readText()),/const a = 1/);else assert.match(await markdown(),/  const a = 1/)})
for(const id of ['link-copy','link-remove','link-edit'])await test(`link tools:${id}`,async()=>{await reset('[alpha](https://example.com) beta');if(id==='link-edit')page.once('dialog',dialog=>dialog.accept('https://edited.example.com'));await menu(id);if(id==='link-copy')assert.equal(await page.evaluate(()=>navigator.clipboard.readText()),'https://example.com');if(id==='link-remove')assert.doesNotMatch(await markdown(),/\[alpha\]/);if(id==='link-edit')assert.match(await markdown(),/edited.example.com/)})
await test('remote image insertion',async()=>{await reset();page.once('dialog',dialog=>dialog.accept('https://example.com/image.png'));await menu('image-remote');assert.match(await markdown(),/image.png/)})
await test('menu inventory',async()=>{const inventory=await page.evaluate(async()=>{const seen=new Map();for(const title of document.querySelectorAll('.menu-title')){title.click();await new Promise(r=>setTimeout(r,0));for(let i=0;i<4;i++){for(const item of document.querySelectorAll('.menu-dropdown .has-sub'))item.dispatchEvent(new MouseEvent('mouseenter'));await new Promise(r=>setTimeout(r,0));for(const item of document.querySelectorAll('.menu-dropdown .menu-item-btn'))if(item.dataset.command)seen.set(item.dataset.command,{id:item.dataset.command,label:item.querySelector('.label')?.textContent,disabled:item.disabled,shortcut:item.querySelector('.shortcut')?.textContent||''})}}return [...seen.values()]});writeFileSync('tests/menu-inventory.json',JSON.stringify(inventory,null,2)+'\n');assert.ok(inventory.length>80)})
await test('no runtime exceptions',()=>assert.deepEqual(errors,[]))
writeFileSync('tests/menu-results.json',JSON.stringify(results,null,2)+'\n')
console.log(`${results.filter(x=>x.status==='pass').length}/${results.length} passed`)
await browser.close()
if(results.some(x=>x.status==='fail'))process.exitCode=1
