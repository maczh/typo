import { test } from 'node:test'
import assert from 'node:assert/strict'
import { mkdtempSync, writeFileSync, readFileSync, rmSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { join } from 'node:path'
import { execFileSync } from 'node:child_process'

test('Linux install is idempotent and uninstall restores existing MIME defaults',()=>{
 const dir=mkdtempSync(join(tmpdir(),'typo-mime-'))
 try {
  const file=join(dir,'mimeapps.list')
  const original='[Default Applications]\ntext/markdown=other.desktop;\nimage/png=viewer.desktop;\n[Added Associations]\ntext/markdown=extra.desktop;\n'
  writeFileSync(file,original)
  const env={...process.env,TYPO_MIME_CONFIG_DIR:dir}
  const run=script=>execFileSync('sh',[`src-tauri/installer/${script}.sh`],{env})
  run('linux-postinstall');const installed=readFileSync(file,'utf8');run('linux-postinstall')
  assert.equal(readFileSync(file,'utf8'),installed)
  assert.match(installed,/text\/markdown=Typo.desktop;other.desktop;/)
  run('linux-postremove')
  assert.equal(readFileSync(file,'utf8'),original)
 } finally {rmSync(dir,{recursive:true,force:true})}
})
test('Linux first installation creates defaults in an empty configuration',()=>{
 const dir=mkdtempSync(join(tmpdir(),'typo-mime-'))
 try{execFileSync('sh',['src-tauri/installer/linux-postinstall.sh'],{env:{...process.env,TYPO_MIME_CONFIG_DIR:dir}});assert.match(readFileSync(join(dir,'mimeapps.list'),'utf8'),/\[Default Applications\]\ntext\/markdown=Typo.desktop;/)}finally{rmSync(dir,{recursive:true,force:true})}
})
