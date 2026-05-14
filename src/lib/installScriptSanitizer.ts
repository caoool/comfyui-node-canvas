export function sanitizeInstallScript(script: string): string {
  let nextScript = script
  if (/CosyVoice/i.test(nextScript) && /requirements\.txt/.test(nextScript)) {
    nextScript = nextScript
      .split('\n')
      .map(line => isUpstreamCosyVoiceRequirementsInstallLine(line)
        ? `${line.match(/^\s*/)?.[0] ?? ''}print("Skipping upstream CosyVoice requirements.txt; use this pack's curated requirements.txt instead.")`
        : line)
      .join('\n')
  }
  if (/CosyVoice/i.test(nextScript) && /(?:modelscope|iic\/CosyVoice3-0\.5B)/i.test(nextScript) && /snapshot_download/.test(nextScript)) {
    nextScript = sanitizeCosyVoiceModelPredownload(nextScript)
  }
  return nextScript
}

function sanitizeCosyVoiceModelPredownload(script: string): string {
  const lines = script
    .split('\n')
    .map(line => {
      if (/^\s*from\s+modelscope\s+import\s+snapshot_download/.test(line)) {
        return line.replace(/from\s+modelscope\s+import\s+snapshot_download/, 'from huggingface_hub import snapshot_download')
      }
      if (/^\s*DEFAULT_MODEL_ID\s*=/.test(line) && /iic\/CosyVoice3-0\.5B/.test(line)) {
        return `${line.match(/^\s*/)?.[0] ?? ''}DEFAULT_MODEL_ID = "FunAudioLLM/Fun-CosyVoice3-0.5B-2512"`
      }
      return line.replaceAll('iic/CosyVoice3-0.5B', 'FunAudioLLM/Fun-CosyVoice3-0.5B-2512')
    })

  const sanitized: string[] = []
  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index]
    if (isTryWrappingModelSnapshot(lines, index)) {
      const indent = line.match(/^\s*/)?.[0] ?? ''
      const innerIndent = `${indent}    `
      sanitized.push(
        `${indent}try:`,
        `${innerIndent}model_path = snapshot_download(DEFAULT_MODEL_ID)`,
        `${innerIndent}print("CosyVoice model cached at", model_path, flush=True)`,
        `${indent}except Exception as exc:`,
        `${innerIndent}print(f"Optional CosyVoice model predownload failed: {exc}", flush=True)`,
      )
      index = skipTryExceptBlock(lines, index)
      continue
    }
    if (/raise\s+RuntimeError\(/.test(line) && /(?:CosyVoice|ModelScope)/i.test(lines.slice(Math.max(0, index - 4), index + 4).join('\n'))) {
      sanitized.push(`${line.match(/^\s*/)?.[0] ?? ''}print(f"Optional CosyVoice model predownload failed: {exc}", flush=True)`)
      index = skipRuntimeErrorContinuation(lines, index)
      continue
    }
    sanitized.push(line)
  }
  return sanitized.join('\n')
}

function isUpstreamCosyVoiceRequirementsInstallLine(line: string): boolean {
  return /(?:_install_with_current_python|subprocess\.check_call|_run|run)\s*\(\s*\[/.test(line) &&
    /["']-r["']\s*,\s*requirements/.test(line)
}

function isTryWrappingModelSnapshot(lines: string[], index: number): boolean {
  if (lines[index].trim() !== 'try:') return false
  return lines.slice(index + 1, index + 8).some(line => /snapshot_download\(DEFAULT_MODEL_ID\)/.test(line))
}

function skipTryExceptBlock(lines: string[], tryIndex: number): number {
  const baseIndent = lines[tryIndex].match(/^\s*/)?.[0].length ?? 0
  let sawExcept = false
  for (let index = tryIndex + 1; index < lines.length; index += 1) {
    const line = lines[index]
    if (line.trim() === '') continue
    const indent = line.match(/^\s*/)?.[0].length ?? 0
    if (indent === baseIndent && line.trim().startsWith('except ')) {
      sawExcept = true
      continue
    }
    if (sawExcept && indent <= baseIndent) return index - 1
  }
  return lines.length - 1
}

function skipRuntimeErrorContinuation(lines: string[], startIndex: number): number {
  for (let index = startIndex; index < lines.length; index += 1) {
    if (/\)\s+from\s+exc\s*$/.test(lines[index]) || /from\s+exc\s*$/.test(lines[index])) return index
  }
  return startIndex
}
