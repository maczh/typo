// IPC contract checks use a mock backend. They do not replace OS installer tests.
import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'
const browser=await puppeteer.launch({executablePath:process.env.CHROME_PATH||'/usr/bin/google-chrome',headless:true,args:['--no-sandbox']})
const page=await browser.newPage()
await page.goto('http://127.0.0.1:1420/?e2e=1',{waitUntil:'networkidle2'})
await page.waitForFunction(()=>window.__typo)
await page.evaluate(async()=>{
 window.A=await import('/src/commands/actions.ts')
 window.F=(await import('/src/stores/files.ts')).useFilesStore()
 window.E=(await import('/src/stores/editor.ts')).useEditorStore()
 window.calls=[]
 window.__TAURI_INTERNALS__={
  metadata:{currentWindow:{label:'main'},currentWebview:{label:'main'}},
  convertFileSrc:path=>`asset://localhost/${encodeURIComponent(path)}`,
  invoke:async(cmd,args={})=>{
   window.calls.push({cmd,args})
   if(cmd==='pick_open')return '/tmp/example.md'
   if(cmd==='pick_dir')return '/tmp/images'
   if(cmd==='pick_save')return `/tmp/${args.defaultName}`
   if(cmd==='open_file')return {path:args.path,name:'example.md',content:'# Opened',kind:'markdown'}
   if(cmd==='save_file_as')return {path:args.path,name:'saved.md',content:args.content,kind:'markdown'}
   if(cmd==='save_file'){if(window.failSave)throw new Error('save failed');return {path:args.path}}
   if(cmd==='list_dir'||cmd==='list_recent')return []
   if(cmd==='copy_image_files')return args.paths.map((_,i)=>`/tmp/images/${i}.png`)
   if(cmd.endsWith('is_fullscreen'))return false
   if(cmd==='plugin:clipboard-manager|read_text')return 'clipboard text'
   return null
  }
 }
})
const results=[]
async function check(name,action,expected){
 try{
  const calls=await page.evaluate(async action=>{window.calls=[];window.E.loadFromText('alpha','/tmp/example.md','example.md');await new Promise(r=>setTimeout(r,30));await window.A[action]();await new Promise(r=>setTimeout(r,50));return window.calls},action)
  for(const cmd of expected)assert.ok(calls.some(c=>c.cmd===cmd),JSON.stringify(calls))
  results.push({name,status:'pass',commands:calls.map(c=>c.cmd)})
 }catch(e){results.push({name,status:'fail',error:e.message})}
}
await check('open file route','openFileDialog',['pick_open','open_file'])
await check('open folder route','openFolderDialog',['pick_dir','list_dir'])
await check('save route','saveFile',['save_file'])
await check('save as route','saveFileAs',['pick_save','save_file_as'])
await check('new window route','newWindow',['new_window'])
await check('close native window route','closeWindow',['plugin:window|close'])
await check('native fullscreen route','toggleFullscreen',['plugin:window|is_fullscreen','plugin:window|set_fullscreen'])
for(const format of ['markdown','html']){
 const name=`export ${format} route`
 try{const calls=await page.evaluate(async format=>{window.calls=[];await window.A.exportAs(format);return window.calls},format);assert.ok(calls.some(c=>c.cmd==='save_file_as'));assert.ok(calls.find(c=>c.cmd==='save_file_as').args.content.length);results.push({name,status:'pass'})}catch(e){results.push({name,status:'fail',error:e.message})}
}
try {
 await page.evaluate(async()=>{window.calls=[];await window.A.toggleSourceMode();await new Promise(r=>setTimeout(r,100));const area=document.querySelector('.source-textarea');area.value='# Unsaved source';area.dispatchEvent(new Event('input',{bubbles:true}));await window.A.saveFile();await window.A.exportAs('markdown')})
 const contents=await page.evaluate(()=>window.calls.filter(c=>['save_file','save_file_as'].includes(c.cmd)).map(c=>c.args.content))
 assert.ok(contents.length===2&&contents.every(c=>c.includes('Unsaved source')),JSON.stringify(contents))
 results.push({name:'source mode save/export uses current source',status:'pass'})
}catch(e){results.push({name:'source mode save/export uses current source',status:'fail',error:e.message})}
try {
 await page.evaluate(async()=>{const ui=(await import('/src/composables/useUI.ts')).useUI();ui.sourceMode.value=false;await new Promise(r=>setTimeout(r,50));window.__typo.loadMarkdown('alpha');await window.A.setImageRoot()})
 assert.match(await page.evaluate(()=>window.__typo.getMarkdown()),/typora-root-url: "\/tmp\/images"/)
 const root=await page.evaluate(async()=>{const images=await import('/src/utils/images.ts');return images.documentImageRoot('---\ntypora-root-url: "C:\\\\Pictures"\n---\n','C:\\notes\\file.md')})
 assert.equal(root,'C:\\Pictures')
 results.push({name:'image root chooser persists document metadata',status:'pass'})
}catch(e){results.push({name:'image root chooser persists document metadata',status:'fail',error:e.message})}

for(const move of [false,true]){
 const name=move?'batch image move saves references before deleting originals':'batch image copy updates references'
 try{
  const data=await page.evaluate(async move=>{window.calls=[];window.E.loadFromText('![x](./x.png)','/tmp/example.md','example.md');await new Promise(r=>setTimeout(r,40));await window.A[move?'moveAllImages':'copyAllImages']();return {calls:window.calls,md:await window.__typo.getMarkdown()}},move)
  assert.ok(data.calls.some(c=>c.cmd==='copy_image_files'))
  assert.match(data.md,/images/)
  if(move){const cmds=data.calls.map(c=>c.cmd);assert.ok(cmds.indexOf('delete_file')>cmds.indexOf('save_file'))}
  results.push({name,status:'pass'})
 }catch(e){results.push({name,status:'fail',error:e.message})}
}
try{
 const cmds=await page.evaluate(async()=>{window.calls=[];window.failSave=true;window.E.loadFromText('![x](./x.png)','/tmp/example.md','example.md');await new Promise(r=>setTimeout(r,40));try{await window.A.moveAllImages()}catch{}finally{window.failSave=false}return window.calls.map(c=>c.cmd)})
 assert.ok(cmds.includes('save_file')&&!cmds.includes('delete_file'))
 results.push({name:'failed save retains original images during move',status:'pass'})
}catch(e){results.push({name:'failed save retains original images during move',status:'fail',error:e.message})}
try {
 const state=await page.evaluate(async()=>{await window.A.toggleSourceMode();await new Promise(r=>setTimeout(r,80));const area=document.querySelector('.source-textarea');area.value='source';area.dispatchEvent(new Event('input',{bubbles:true}));area.focus();area.setSelectionRange(6,6);await window.A.pasteAsPlainText();const pasted=area.value;window.A.undo();return {pasted,undone:area.value}})
 assert.equal(state.pasted,'sourceclipboard text');assert.equal(state.undone,'source')
 results.push({name:'source paste participates in undo history',status:'pass'})
}catch(e){results.push({name:'source paste participates in undo history',status:'fail',error:e.message})}
await page.evaluate(()=>delete window.__TAURI_INTERNALS__)
writeFileSync('tests/native-contract-results.json',JSON.stringify(results,null,2)+'\n')
console.log(results)
await browser.close()
if(results.some(r=>r.status==='fail'))process.exitCode=1
