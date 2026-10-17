import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createPinia, setActivePinia } from 'pinia'
import { useEditorStore } from '../src/stores/editor'
import { rewriteImageReferences, documentImageRoot, localImageFiles } from '../src/utils/images'

test('saved revision does not clear later edits and undo returns to clean state', () => {
  setActivePinia(createPinia())
  const editor = useEditorStore()
  editor.loadFromText('original', '/tmp/note.md')
  editor.updateContent('original')
  assert.equal(editor.doc.dirty, false)
  editor.updateContent('saved snapshot')
  editor.updateContent('new edit while saving')
  editor.markSaved('saved snapshot')
  assert.equal(editor.doc.dirty, true)
  editor.updateContent('saved snapshot')
  assert.equal(editor.doc.dirty, false)
  editor.loadFromText('another', '/tmp/another.md')
  editor.updateContent('another')
  assert.equal(editor.doc.dirty, false)
})

test('image rewrites affect only image destinations, including balanced parentheses and references', () => {
  const md = 'photo.png ![a](photo.png "title") [link](photo.png) `![code](photo.png)`\n\n```md\n![fenced](photo.png)\n```\n\n![b](<photo.png>) ![c](folder/a(b).png)\n\n![ref][pic]\n\n[pic]: photo.png "caption"\n\n<img src="photo.png" alt="photo.png">'
  const result = rewriteImageReferences(md, new Map([['photo.png', 'new.png'], ['folder/a(b).png', 'balanced.png']]))
  assert.ok(result.startsWith('photo.png ![a](new.png "title") [link](photo.png) `![code](photo.png)`'))
  assert.ok(result.includes('![fenced](photo.png)'))
  assert.ok(result.includes('![b](<new.png>) ![c](balanced.png)'))
  assert.ok(result.includes('[pic]: new.png "caption"'))
  assert.ok(result.includes('<img src="new.png" alt="photo.png">'))
})

test('code examples are never treated as local image files', () => {
  assert.deepEqual(localImageFiles('`![code](a.png)`\n\n```\n![code](b.png)\n```', '/tmp/doc.md'), [])
})

test('invalid image-root metadata does not crash path resolution', () => {
  assert.equal(documentImageRoot('---\ntypora-root-url: "unterminated\n---\n', '/doc.md'), '/')
  assert.equal(documentImageRoot('---\ntypora-root-url: "images"\n---\n', '/doc.md'), '/images')
})


test('native paths normalize parent segments and preserve Windows and UNC roots', async () => {
  const { nativeJoin, normalizeFsPath } = await import('../src/utils/file')
  assert.equal(nativeJoin('/docs/notes', '../images/a.png'), '/docs/images/a.png')
  assert.equal(nativeJoin('/docs', '/other/a.png'), '/other/a.png')
  assert.equal(nativeJoin('C:\\docs', '..\\images\\a.png'), 'C:\\images\\a.png')
  assert.equal(normalizeFsPath('//server/share/../a.png'), '//server/share/a.png')
  assert.equal(nativeJoin('/', '../../a.png'), '/a.png')
})


test('recovery remains dirty until saved, even for an empty recovered document', () => {
  setActivePinia(createPinia())
  const editor = useEditorStore()
  editor.loadFromText('', '/tmp/recovered.md', 'recovered.md', true)
  editor.updateContent('')
  assert.equal(editor.doc.dirty, true)
  editor.markSaved()
  assert.equal(editor.doc.dirty, false)
})

test('HTML image destinations do not confuse data-src, alt text or quoted angle brackets', () => {
  const input = '<img data-src="a.png" alt="a > b" src="b.png">'
  assert.equal(rewriteImageReferences(input, new Map([['a.png', 'wrong.png'], ['b.png', 'right.png']])), '<img data-src="a.png" alt="a > b" src="right.png">')
})
