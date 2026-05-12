// Lightweight Python linter for the node "execute" body. Not a full parser —
// just catches the issues that bite this app the most:
//   - unbalanced brackets / parens / braces
//   - mixed tabs and spaces in indentation (would break Python parsing)
//   - lines that look like a block-opener but miss the trailing colon
//
// Returns one issue per problematic line, ready to map onto Monaco markers.

export type LintSeverity = 'error' | 'warning'

export interface LintIssue {
  line: number       // 1-based
  startCol: number   // 1-based
  endCol: number     // 1-based, exclusive
  severity: LintSeverity
  message: string
}

const BLOCK_OPENERS = /^\s*(def|class|if|elif|else|for|while|try|except|finally|with|async\s+def|async\s+for|async\s+with)\b.*$/

// Pre-pass: replace every char inside a string or comment with a space, while
// preserving line breaks so per-line analysis below keeps line numbers correct.
// Handles triple-quoted strings spanning lines, optional string prefixes
// (r/R/b/B/f/F/u/U combinations), and # comments.
function maskStringsAndComments(src: string): string {
  let out = ''
  let i = 0
  const n = src.length
  while (i < n) {
    const ch = src[i]
    if (ch === '#') {
      while (i < n && src[i] !== '\n') {
        out += ' '
        i++
      }
      continue
    }
    // Skip string prefix letters (kept as identifier-shaped tokens for the
    // bracket scanner to ignore — they're letters, not brackets).
    const prefixMatch = /^[rRbBfFuU]{1,3}(?=["'])/.exec(src.slice(i))
    if (prefixMatch) {
      out += src.slice(i, i + prefixMatch[0].length)
      i += prefixMatch[0].length
    }
    const ch2 = src[i]
    if (ch2 === '"' || ch2 === "'") {
      const quote = ch2
      const isTriple = src[i + 1] === quote && src[i + 2] === quote
      if (isTriple) {
        out += '   '
        i += 3
        while (i < n) {
          if (src[i] === '\n') { out += '\n'; i++; continue }
          if (src[i] === quote && src[i + 1] === quote && src[i + 2] === quote) {
            out += '   '; i += 3; break
          }
          out += ' '; i++
        }
        continue
      }
      out += ' '
      i++
      while (i < n && src[i] !== quote && src[i] !== '\n') {
        if (src[i] === '\\' && i + 1 < n) { out += '  '; i += 2; continue }
        out += ' '; i++
      }
      if (i < n && src[i] === quote) { out += ' '; i++ }
      continue
    }
    out += ch
    i++
  }
  return out
}

export function lintPython(code: string): LintIssue[] {
  const issues: LintIssue[] = []
  if (!code) return issues

  const masked = maskStringsAndComments(code)
  const rawLines = code.split('\n')
  const maskedLines = masked.split('\n')
  const stack: { ch: string; line: number; col: number }[] = []
  const closers: Record<string, string> = { ')': '(', ']': '[', '}': '{' }

  for (let i = 0; i < rawLines.length; i++) {
    const raw = rawLines[i]
    const stripped = maskedLines[i] ?? ''

    const indentMatch = raw.match(/^[\t ]+/)
    if (indentMatch) {
      const indent = indentMatch[0]
      if (indent.includes('\t') && indent.includes(' ')) {
        issues.push({
          line: i + 1,
          startCol: 1,
          endCol: indent.length + 1,
          severity: 'error',
          message: 'Mixed tabs and spaces in indentation.',
        })
      }
    }

    // Skip the colon check on lines that continue with a backslash.
    if (BLOCK_OPENERS.test(stripped) && !raw.replace(/\s+$/, '').endsWith('\\')) {
      const trimmed = stripped.replace(/\s+$/, '')
      if (!trimmed.endsWith(':')) {
        issues.push({
          line: i + 1,
          startCol: 1,
          endCol: raw.length + 1,
          severity: 'error',
          message: 'Block statement is missing a trailing colon.',
        })
      }
    }

    for (let c = 0; c < stripped.length; c++) {
      const ch = stripped[c]
      if (ch === '(' || ch === '[' || ch === '{') {
        stack.push({ ch, line: i + 1, col: c + 1 })
      } else if (ch === ')' || ch === ']' || ch === '}') {
        const top = stack.pop()
        if (!top || top.ch !== closers[ch]) {
          issues.push({
            line: i + 1,
            startCol: c + 1,
            endCol: c + 2,
            severity: 'error',
            message: `Unmatched closing '${ch}'.`,
          })
        }
      }
    }
  }

  for (const open of stack) {
    issues.push({
      line: open.line,
      startCol: open.col,
      endCol: open.col + 1,
      severity: 'error',
      message: `Unclosed '${open.ch}' from this line.`,
    })
  }

  return issues
}
