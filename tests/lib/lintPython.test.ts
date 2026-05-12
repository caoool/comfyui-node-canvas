import { describe, it, expect } from 'vitest'
import { lintPython } from '../../src/lib/lintPython'

describe('lintPython', () => {
  it('returns no issues for empty input', () => {
    expect(lintPython('')).toEqual([])
  })

  it('returns no issues for valid code', () => {
    const code = [
      'result = a + b',
      'return (result,)',
    ].join('\n')
    expect(lintPython(code)).toEqual([])
  })

  it('flags unclosed parenthesis', () => {
    const issues = lintPython('return (a + b\n')
    expect(issues).toHaveLength(1)
    expect(issues[0].severity).toBe('error')
    expect(issues[0].message).toMatch(/Unclosed/)
    expect(issues[0].line).toBe(1)
  })

  it('flags unmatched closing brace', () => {
    const issues = lintPython('return a)\n')
    expect(issues.some(i => /Unmatched closing/.test(i.message))).toBe(true)
  })

  it('flags missing colon on block-opener', () => {
    const issues = lintPython('if x > 0\n    pass\n')
    expect(issues.some(i => /missing a trailing colon/.test(i.message))).toBe(true)
  })

  it('does not flag block-opener that does have a colon', () => {
    const issues = lintPython('if x > 0:\n    pass\n')
    expect(issues).toEqual([])
  })

  it('does not flag colons inside string literals', () => {
    const issues = lintPython('msg = "if you see this:"\n')
    expect(issues).toEqual([])
  })

  it('flags mixed tabs and spaces in indentation', () => {
    const issues = lintPython(' \tx = 1\n')
    expect(issues.some(i => /Mixed tabs and spaces/.test(i.message))).toBe(true)
  })

  it('ignores brackets inside strings and comments', () => {
    const code = [
      'msg = "(unclosed in string"',
      'x = 1  # ) trailing in comment',
    ].join('\n')
    expect(lintPython(code)).toEqual([])
  })

  it('ignores brackets inside multi-line triple-quoted strings', () => {
    const code = [
      'doc = """',
      'hello (',
      '"""',
    ].join('\n')
    expect(lintPython(code)).toEqual([])
  })

  it('handles f-strings and r-strings without false positives', () => {
    const code = [
      'a = f"value: {x}"',
      "b = r'\\n keeps backslash'",
      'c = rb"bytes"',
    ].join('\n')
    expect(lintPython(code)).toEqual([])
  })

  it('does not flag a block-opener whose colon is on the next line via backslash continuation', () => {
    const code = [
      'if x > 0 \\',
      '    and y > 0:',
      '    pass',
    ].join('\n')
    expect(lintPython(code)).toEqual([])
  })
})
