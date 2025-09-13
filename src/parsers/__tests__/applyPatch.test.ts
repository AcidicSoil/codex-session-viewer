import { describe, it, expect } from 'vitest'
import { extractApplyPatchText, parseApplyPatch, extractApplyPatchFromCommand } from '../applyPatch'
import * as fs from 'node:fs'

describe('applyPatch parser', () => {
  it('extracts patch text from FunctionCall.args string payload', () => {
    const raw = fs.readFileSync('docs/example-patch.json', 'utf8')
    const event = JSON.parse(raw)
    expect(event.type).toBe('FunctionCall')
    expect(event.name).toBe('shell')
    const patchText = extractApplyPatchText(event.args)
    expect(patchText).toBeTruthy()
    if (!patchText) return
    expect(patchText.startsWith('*** Begin Patch')).toBe(true)
    expect(patchText.includes('*** Update File: src/export/columns.ts')).toBe(true)
  })

  it('extracts patch text from result.output field', () => {
    const patch = ['*** Begin Patch', '*** Update File: a.txt', '@@', '-foo', '+bar', '*** End Patch', ''].join('\n')
    const res = { output: patch }
    const extracted = extractApplyPatchText(res)
    expect(extracted?.trim()).toBe(patch.trim())
  })

  it('extracts patch text from shell command here-doc', () => {
    const raw = fs.readFileSync('docs/example-patch.json', 'utf8')
    const event = JSON.parse(raw)
    const patchText = extractApplyPatchText(event.args)!
    const cmd = `apply_patch <<'PATCH'\n${patchText}\nPATCH`
    const extracted = extractApplyPatchFromCommand(cmd)
    expect(extracted?.trim()).toBe(patchText.trim())
  })

  it('parses Update File ops into minimal unified diffs', () => {
    const raw = fs.readFileSync('docs/example-patch.json', 'utf8')
    const event = JSON.parse(raw)
    const patchText = extractApplyPatchText(event.args)!
    const ops = parseApplyPatch(patchText)
    expect(ops.length).toBeGreaterThan(0)
    const first = ops[0]!
    expect(first.op).toBe('update')
    expect(first.path).toContain('src/export/columns.ts')
    expect(first.unifiedDiff).toContain('@@')
    // sanity: the change narrows return type to ColumnMeta[] per fixture
    expect(first.unifiedDiff).toContain('ColumnMeta[]')
  })

  it('reads result metadata from success example (for future pairing)', () => {
    const raw = fs.readFileSync('docs/example-success-patch.json', 'utf8')
    const ev = JSON.parse(raw)
    expect(ev.type).toBe('FunctionCall')
    expect(ev.name).toBe('function')
    expect(ev.result?.metadata?.exit_code ?? ev.result?.metadata?.exitCode).toBe(0)
  })
})
