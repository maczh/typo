import assert from 'node:assert/strict'
import { writeFileSync } from 'node:fs'
import puppeteer from 'puppeteer-core'

const browser = await puppeteer.launch({ executablePath: process.env.CHROME_PATH || '/usr/bin/google-chrome', headless: true, args: ['--no-sandbox'] })
const page = await browser.newPage()
const results = []
page.on('dialog', dialog => dialog.dismiss())
await page.goto('http://127.0.0.1:1420/?e2e=1', { waitUntil: 'networkidle2' })
await page.waitForFunction(() => window.__typo)
await page.evaluate(async () => {
  window.A = await import('/src/commands/actions.ts')
  window.E = (await import('/src/stores/editor.ts')).useEditorStore()
  window.F = (await import('/src/stores/files.ts')).useFilesStore()
  window.UI = (await import('/src/composables/useUI.ts')).useUI()
  window.calls = []
  window.pending = {}
  window.failDelete = false
  window.confirmResult = false
  window.__TAURI_INTERNALS__ = {
    metadata: { currentWindow: { label: 'main' }, currentWebview: { label: 'main' } },
    convertFileSrc: path => `asset://localhost/${encodeURIComponent(path)}`,
    invoke: async (cmd, args = {}) => {
      window.calls.push({ cmd, args })
      if (cmd === 'plugin:dialog|confirm') return window.confirmResult
      if (cmd === 'list_dir' || cmd === 'list_recent') return []
      if (cmd === 'pick_save') return '/tmp/save-as.md'
      if (cmd === 'delete_file' && window.failDelete) throw new Error('delete failed')
      if (cmd === 'open_file' && window.deferOpen) return new Promise(resolve => { window.pending[args.path] = resolve })
      if (cmd === 'save_file' || cmd === 'save_file_as') {
        if (window.deferSave) return new Promise(resolve => { window.pending.save = () => resolve({ path: args.path, name: 'saved.md' }) })
        return { path: args.path, name: 'saved.md' }
      }
      return null
    },
  }
  window.source = async (text, path = '/tmp/review.md') => {
    window.UI.sourceMode.value = true
    window.E.loadFromText(text, path, 'review.md')
    await new Promise(resolve => setTimeout(resolve, 50))
  }
})
async function check(name, fn) {
  console.log('checking', name)
  try { await fn(); results.push({ name, status: 'pass' }); console.log('pass', name) }
  catch (error) { results.push({ name, status: 'fail', error: error.message }) }
}
await check('source input immediately marks document dirty and autosave uses that source', async () => {
  const state = await page.evaluate(async () => {
    await window.source('old')
    const area = document.querySelector('.source-textarea')
    area.value = 'source edits'
    area.dispatchEvent(new Event('input', { bubbles: true }))
    const autosave = (await import('/src/composables/useAutosave.ts')).useAutosave()
    const settings = (await import('/src/stores/settings.ts')).useSettingsStore()
    settings.settings.autoSave = true
    window.calls = []
    await autosave.tick()
    return { dirty: window.E.doc.dirty, content: window.E.doc.content, backup: window.calls.find(c => c.cmd === 'autosave') }
  })
  assert.equal(state.dirty, true)
  assert.equal(state.content, 'source edits')
  assert.equal(state.backup.args.content, 'source edits')
  assert.equal(state.backup.args.docPath, '/tmp/review.md')
})
await check('cancelled new/open preserves unsaved content', async () => {
  const state = await page.evaluate(async () => {
    window.calls = []
    await window.F.newFile()
    await window.F.openFile('/tmp/other.md')
    return { content: window.E.doc.content, path: window.E.doc.path, calls: window.calls }
  })
  assert.equal(state.content, 'source edits')
  assert.equal(state.path, '/tmp/review.md')
  assert.ok(!state.calls.some(c => c.cmd === 'open_file'))
})
await check('edits made while saving remain dirty', async () => {
  const state = await page.evaluate(async () => {
    await window.source('before')
    window.E.updateContent('snapshot')
    window.deferSave = true
    const saving = window.A.saveFile()
    for (let i = 0; !window.pending.save; i++) { if (i > 600) throw new Error('save did not reach backend'); await new Promise(resolve => setTimeout(resolve, 5)) }
    window.E.updateContent('typed during save')
    window.pending.save()
    delete window.pending.save
    await saving
    window.deferSave = false
    return { ...window.E.doc }
  })
  assert.equal(state.content, 'typed during save')
  assert.equal(state.dirty, true)
})
await check('save-as completion cannot rename or mark a switched document saved', async () => {
  const state = await page.evaluate(async () => {
    await window.source('first', '/tmp/first.md')
    window.deferSave = true
    const saving = window.A.saveFileAs()
    for (let i = 0; !window.pending.save; i++) { if (i > 600) throw new Error('save did not reach backend'); await new Promise(resolve => setTimeout(resolve, 5)) }
    window.E.loadFromText('second', '/tmp/second.md', 'second.md')
    window.E.updateContent('second edits')
    window.pending.save()
    delete window.pending.save
    await saving
    window.deferSave = false
    return { ...window.E.doc }
  })
  assert.equal(state.path, '/tmp/second.md')
  assert.equal(state.name, 'second.md')
  assert.equal(state.content, 'second edits')
  assert.equal(state.dirty, true)
})
await check('late open response does not overwrite a newer open', async () => {
  const state = await page.evaluate(async () => {
    await window.source('start')
    window.deferOpen = true
    const first = window.F.openFile('/tmp/first.md')
    for (let i = 0; !window.pending['/tmp/first.md']; i++) { if (i > 600) throw new Error('open did not reach backend'); await new Promise(resolve => setTimeout(resolve, 5)) }
    const second = window.F.openFile('/tmp/second.md')
    for (let i = 0; !window.pending['/tmp/second.md']; i++) { if (i > 600) throw new Error('open did not reach backend'); await new Promise(resolve => setTimeout(resolve, 5)) }
    window.pending['/tmp/second.md']({ path: '/tmp/second.md', name: 'second.md', content: 'second' })
    await second
    window.pending['/tmp/first.md']({ path: '/tmp/first.md', name: 'first.md', content: 'first' })
    await first
    window.deferOpen = false
    return { ...window.E.doc }
  })
  assert.equal(state.path, '/tmp/second.md')
  assert.equal(state.content, 'second')
})
await check('typing while open is pending is preserved', async () => {
  const state = await page.evaluate(async () => {
    await window.source('start')
    window.deferOpen = true
    const opening = window.F.openFile('/tmp/pending.md')
    for (let i = 0; !window.pending['/tmp/pending.md']; i++) { if (i > 600) throw new Error('open did not reach backend'); await new Promise(resolve => setTimeout(resolve, 5)) }
    window.E.updateContent('new local input')
    window.pending['/tmp/pending.md']({ path: '/tmp/pending.md', name: 'pending.md', content: 'disk' })
    await opening
    window.deferOpen = false
    return { ...window.E.doc }
  })
  assert.equal(state.content, 'new local input')
  assert.equal(state.path, '/tmp/review.md')
})
await check('replace treats dollar substitutions literally', async () => {
  const content = await page.evaluate(async () => {
    await window.source('alpha alpha')
    const find = (await import('/src/composables/useFind.ts')).useFind()
    find.findText.value = 'alpha'
    find.replaceText.value = '$& $$ $1'
    await find.replaceAll()
    return window.E.doc.content
  })
  assert.equal(content, '$& $$ $1 $& $$ $1')
})
await check('failed delete preserves the current document', async () => {
  const state = await page.evaluate(async () => {
    await window.source('keep this document')
    window.confirmResult = true
    window.failDelete = true
    await window.A.deleteCurrentFile()
    window.confirmResult = false
    window.failDelete = false
    return { ...window.E.doc }
  })
  assert.equal(state.content, 'keep this document')
  assert.equal(state.path, '/tmp/review.md')
})
await check('queued saves cannot write out of order', async () => {
  const saved = await page.evaluate(async () => {
    await window.source('one')
    window.calls = []
    window.deferSave = true
    const first = window.A.saveFile()
    for (let i = 0; !window.pending.save; i++) { if (i > 600) throw new Error('first save not started'); await new Promise(resolve => setTimeout(resolve, 5)) }
    window.E.updateContent('two')
    const second = window.A.saveFile()
    await new Promise(resolve => setTimeout(resolve, 30))
    const before = window.calls.filter(c => c.cmd === 'save_file').length
    window.pending.save()
    delete window.pending.save
    await first
    for (let i = 0; !window.pending.save; i++) { if (i > 600) throw new Error('second save not started'); await new Promise(resolve => setTimeout(resolve, 5)) }
    window.pending.save()
    delete window.pending.save
    await second
    window.deferSave = false
    return { before, writes: window.calls.filter(c => c.cmd === 'save_file').map(c => c.args.content), dirty: window.E.doc.dirty }
  })
  assert.equal(saved.before, 1)
  assert.deepEqual(saved.writes, ['one', 'two'])
  assert.equal(saved.dirty, false)
})
await check('PDF frame blocks scripts and contains one complete HTML document', async () => {
  const state = await page.evaluate(async () => {
    const { toHtml } = await import('/src/utils/exporter/toHtml.ts')
    const { toPdf } = await import('/src/utils/exporter/toPdf.ts')
    window.reviewPwned = false
    const html = await toHtml('<script>parent.reviewPwned=true</script>\n\n# Printable')
    const printing = toPdf(html)
    const frame = document.querySelector('iframe')
    let printed = false
    frame.contentWindow.print = () => { printed = true }
    await printing
    const state = { sandbox: frame.getAttribute('sandbox'), pwned: window.reviewPwned, scripts: frame.contentDocument.querySelectorAll('script').length, headings: frame.contentDocument.querySelectorAll('h1').length, printed }
    frame.contentWindow.dispatchEvent(new Event('afterprint'))
    return state
  })
  assert.equal(state.sandbox, 'allow-same-origin allow-modals')
  assert.equal(state.pwned, false)
  assert.equal(state.scripts, 0)
  assert.equal(state.headings, 1)
  assert.equal(state.printed, true)
})
await check('underline and bold survive Markdown round-trip', async () => {
  const state = await page.evaluate(async () => {
    window.UI.sourceMode.value = false
    await new Promise(resolve => setTimeout(resolve, 50))
    window.E.loadFromText('<u>**bold** and plain</u>')
    await new Promise(resolve => setTimeout(resolve, 100))
    const markdown = await window.__typo.getMarkdown()
    return { markdown, html: document.querySelector('.milkdown .ProseMirror').innerHTML }
  })
  assert.match(state.markdown, /\*\*<u>bold<\/u>\*\*|<u>\*\*bold\*\*<\/u>/)
  assert.match(state.html, /<u[^>]*><strong>bold<\/strong>|<strong><u[^>]*>bold<\/u>/)
})
await check('opening and returning to unchanged source leaves the document clean', async () => {
  const state = await page.evaluate(async () => {
    window.UI.sourceMode.value = false
    window.E.loadFromText('plain original', '/tmp/clean.md', 'clean.md')
    await new Promise(resolve => setTimeout(resolve, 100))
    const loaded = window.E.doc.dirty
    window.A.toggleSourceMode()
    await new Promise(resolve => setTimeout(resolve, 60))
    window.A.toggleSourceMode()
    await new Promise(resolve => setTimeout(resolve, 100))
    return { loaded, dirty: window.E.doc.dirty }
  })
  assert.equal(state.loaded, false)
  assert.equal(state.dirty, false)
})
await page.evaluate(() => delete window.__TAURI_INTERNALS__)
await browser.close()
writeFileSync('tests/review-results.json', JSON.stringify(results, null, 2) + '\n')
console.log(results)
if (results.some(result => result.status === 'fail')) process.exitCode = 1
