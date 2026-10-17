import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({executablePath:process.env.CHROME_PATH || '/usr/bin/google-chrome',headless:true,args:['--no-sandbox']})
const page = await browser.newPage()
await page.setViewport({width:1100,height:850})
const errors=[], results=[]
page.on('pageerror', error=>errors.push(error.message))
await page.goto(process.env.TYPO_URL || 'http://127.0.0.1:1420/?e2e=1',{waitUntil:'networkidle2'})
await page.waitForFunction(()=>window.__typo)
await page.evaluate(async()=>{
 window.P=await import('/src/commands/prose.ts')
 window.A=await import('/src/commands/actions.ts')
 window.Harness=await import('/tests/editor-harness.ts')
 window.M=(await import('/src/composables/useEditorMenu.ts')).useEditorMenu()
 window.T=(await import('/src/i18n/index.ts')).i18n.global.t
})
const pause=()=>new Promise(resolve=>setTimeout(resolve,100))
const json=()=>page.evaluate(()=>window.Harness.editorSnapshot())
const text=node=>node.text || (node.content || []).map(text).join('')
async function load(md){await page.evaluate(md=>{window.M.hide();window.__typo.loadMarkdown(md);window.P.setCaret(window.__typo.getEditor(),1)},md);await pause()}
async function handle(selector){
 const point=await page.$eval(selector,el=>{el.scrollIntoView({block:'center'});const r=el.getBoundingClientRect();return {x:r.left+Math.min(60,r.width/2),y:r.top+Math.min(r.height/2,14)}})
 await page.mouse.move(point.x,point.y)
 await new Promise(resolve=>setTimeout(resolve,160))
 await page.click('.milkdown-block-handle[data-show="true"] .operation-item:last-child')
 await page.waitForSelector('.ctx-menu',{timeout:2000})
}
async function choose(style){
 if(/^h[1-6]$/.test(style)||style==='paragraph'){
  await page.hover('.ctx-item.has-sub')
  const n=style==='paragraph'?0:Number(style.slice(1))
  await page.evaluate(n=>document.querySelectorAll('.ctx-submenu .ctx-row-item')[n].click(),n)
 }else await page.evaluate(key=>document.querySelector(`.ctx-menu button[aria-label="${window.T('ctx.'+key)}"]`).click(),style)
 await pause()
}
async function test(name,fn){try{await fn();results.push({name,status:'pass'})}catch(error){results.push({name,status:'fail',error:error.message});if(results.filter(r=>r.status==='fail').length<=4)console.log('FAIL',name,error.message)}}
const styles=['paragraph','h1','h2','h3','h4','h5','h6','quote','bulletList','orderedList','taskList']
for(const source of ['ordered_list','bullet_list'])for(const index of [0,1,2])for(const style of styles){
 await test(`${source} item ${index+1} → ${style}`,async()=>{
  const rows=['before','target','after'];rows[index]='selected'
  const md=rows.map((s,i)=>`${source==='ordered_list'?`${i+4}.`:'*'} **${s}** text`).join('\n')+'\n\nTail\n'
  await load(md)
  const original=await json()
  const tag=source==='ordered_list'?'ol':'ul'
  await handle(`.ProseMirror > ${tag} > .milkdown-list-item-block:nth-child(${index+1}) .content-dom > p:first-child`)
  await choose(style)
  const doc=await json()
  assert.equal(text(doc),text(original),'all text and its order must be retained')
  // The selected item becomes its own block, splitting only its original list.
  const targetIndex=index>0?1:0
  const converted=doc.content[targetIndex]
  const expected=style.startsWith('h')?'heading':style==='quote'?'blockquote':style==='taskList'?'bullet_list':style==='bulletList'?(source==='bullet_list'?'paragraph':'bullet_list'):style==='orderedList'?(source==='ordered_list'?'paragraph':'ordered_list'):'paragraph'
  assert.equal(converted.type,expected,JSON.stringify(doc))
  if(style.startsWith('h'))assert.equal(converted.attrs.level,Number(style.slice(1)))
  if(expected.endsWith('_list')){assert.equal(converted.content.length,1);assert.equal(converted.content[0].attrs?.checked??null,style==='taskList'?false:null)}
  assert.ok(JSON.stringify(converted).includes('strong'),'inline formatting must survive')
  if(index>0)assert.deepEqual(doc.content[0].content,original.content[0].content.slice(0,index))
  if(index<2){const rest=doc.content[targetIndex+1];assert.equal(rest.type,source);assert.deepEqual(rest.content,original.content[0].content.slice(index+1));if(source==='ordered_list')assert.equal(rest.attrs.order,4+index+1)}
  await page.evaluate(()=>window.A.undo())
  assert.deepEqual(await json(),original,'one undo must restore the complete original list')
 })
}
await test('nested list handle targets the child line',async()=>{
 await load('* parent\n  1. child one\n  2. **child two**\n  3. child three\n* sibling\n')
 const original=await json()
 await handle('.ProseMirror ol > .milkdown-list-item-block:nth-child(2) .content-dom > p:first-child')
 await choose('h2')
 const doc=await json()
 assert.equal(text(doc),text(original))
 assert.equal(doc.content[0].type,'bullet_list')
 const blocks=doc.content[0].content[0].content
 assert.equal(blocks[2].type,'heading');assert.equal(blocks[2].attrs.level,2)
 assert.equal(text(blocks[2]),'child two')
 assert.deepEqual(doc.content[0].content[1],original.content[0].content[1])
})
await test('converting a row retains its child list',async()=>{
 await load('1. before\n2. **target**\n   * child one\n   * child two\n3. after\n')
 const original=await json()
 await handle('.ProseMirror > ol > .milkdown-list-item-block:nth-child(2) .content-dom > p:first-child');await choose('h3')
 const doc=await json()
 assert.equal(text(doc),text(original))
 assert.equal(doc.content[1].type,'heading')
 assert.equal(doc.content[2].type,'bullet_list')
 assert.deepEqual(doc.content[2],original.content[0].content[1].content[1])
})
await test('no runtime errors',()=>assert.deepEqual(errors,[]))
writeFileSync('tests/list-style-results.json',JSON.stringify(results,null,2)+'\n')
console.log(`${results.filter(r=>r.status==='pass').length}/${results.length} passed`)
await browser.close()
if(results.some(r=>r.status==='fail'))process.exitCode=1
