import { test } from 'node:test'
import assert from 'node:assert/strict'

test('probe: alias + css stub + strip-types chain works', async () => {
  const results: Record<string, string> = {}

  try {
    await import('@/types')
    results['@/types (alias)'] = 'OK'
  } catch (e) {
    results['@/types (alias)'] = 'FAIL: ' + (e as Error).message
  }

  try {
    const m = await import('../src/utils/exporter/toHtml')
    results['toHtml (alias+css+remark)'] = typeof m.toHtml === 'function' ? 'OK' : 'no export'
  } catch (e) {
    results['toHtml (alias+css+remark)'] = 'FAIL: ' + (e as Error).message
  }

  try {
    const m = await import('../src/utils/exporter/toDocx')
    results['toDocx (docx)'] = typeof m.toDocx === 'function' ? 'OK' : 'no export'
  } catch (e) {
    results['toDocx (docx)'] = 'FAIL: ' + (e as Error).message
  }

  try {
    await import('../src/utils/file')
    results['file'] = 'OK'
  } catch (e) {
    results['file'] = 'FAIL: ' + (e as Error).message
  }

  try {
    await import('../src/utils/outline')
    results['outline'] = 'OK'
  } catch (e) {
    results['outline'] = 'FAIL: ' + (e as Error).message
  }

  try {
    await import('../src/utils/markdown')
    results['markdown'] = 'OK'
  } catch (e) {
    results['markdown'] = 'FAIL: ' + (e as Error).message
  }

  console.log('--- PROBE RESULTS ---')
  console.log(JSON.stringify(results, null, 2))
  // Fail the test only if the two most important modules can't load.
  assert.ok(results['toHtml (alias+css+remark)'] === 'OK', 'toHtml must load')
  assert.ok(results['toDocx (docx)'] === 'OK', 'toDocx must load')
})
