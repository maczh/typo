import { test } from 'node:test'
import assert from 'node:assert/strict'
import zlib from 'node:zlib'
import { toDocx } from '../src/utils/exporter/toDocx'

// Minimal reader for the docx (OOXML zip) central directory so we can assert on
// the actual document content without pulling in a zip library.
function readDocumentXml(buf: Buffer): string | null {
  // End Of Central Directory signature
  let eocd = -1
  for (let p = buf.length - 22; p >= 0; p--) {
    if (buf.readUInt32LE(p) === 0x06054b50) {
      eocd = p
      break
    }
  }
  if (eocd < 0) return null
  const cdStart = buf.readUInt32LE(eocd + 16)
  let p = cdStart
  while (p + 4 <= buf.length && buf.readUInt32LE(p) === 0x02014b50) {
    const method = buf.readUInt16LE(p + 10)
    const compSize = buf.readUInt32LE(p + 20)
    const uncompSize = buf.readUInt32LE(p + 24)
    const fnameLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const commentLen = buf.readUInt16LE(p + 32)
    const localOff = buf.readUInt32LE(p + 42)
    const name = buf.toString('utf8', p + 46, p + 46 + fnameLen)
    if (name === 'word/document.xml') {
      const lNameLen = buf.readUInt16LE(localOff + 26)
      const lExtraLen = buf.readUInt16LE(localOff + 28)
      const dataStart = localOff + 30 + lNameLen + lExtraLen
      const data = buf.subarray(dataStart, dataStart + compSize)
      if (method === 0) return buf.toString('utf8', dataStart, dataStart + uncompSize)
      return zlib.inflateRawSync(data).toString('utf8')
    }
    p += 46 + fnameLen + extraLen + commentLen
  }
  return null
}

// PRD REQ-P1-05: Word export must succeed and preserve heading levels + tables.
test('toDocx returns a non-empty .docx Blob', async () => {
  const blob = await toDocx('# Title\n\nSome body text.')
  assert.ok(blob instanceof Blob)
  assert.ok(blob.size > 0)
})

test('the produced file is a valid zip (docx) starting with PK', async () => {
  const blob = await toDocx('# Title')
  const ab = await blob.arrayBuffer()
  const buf = Buffer.from(ab)
  assert.equal(buf.readUInt16LE(0), 0x4b50) // 'PK'
})

test('word/document.xml contains the heading, paragraph and table content', async () => {
  const md = [
    '# Heading One',
    '',
    'A paragraph with **bold** words.',
    '',
    '| Col A | Col B |',
    '| --- | --- |',
    '| Apple | 10 |',
    '| Banana | 20 |',
  ].join('\n')
  const blob = await toDocx(md, 'My Document')
  const xml = readDocumentXml(Buffer.from(await blob.arrayBuffer()))
  assert.ok(xml, 'should find word/document.xml')
  assert.match(xml, /Heading One/)
  assert.match(xml, /bold/) // inline strong preserved
  assert.match(xml, /<w:tbl>/) // table preserved
  assert.match(xml, /Apple/)
  assert.match(xml, /Banana/)
})
