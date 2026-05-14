import { EventEmitter } from 'node:events'
import { writeFile } from 'node:fs/promises'
import { PassThrough, Writable } from 'node:stream'
import { describe, expect, it, vi } from 'vitest'
import { checkCodexStatus, codexMessagesToPrompt, runCodexExec, streamCodexProvider, type CodexProcess, type CodexSpawn } from '../../server/codexProvider'

function fakeCodexSpawn(reply: string, capture: { args?: string[]; stdin: string }): CodexSpawn {
  return (_command, args) => {
    capture.args = args
    const child = new EventEmitter() as CodexProcess
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    if (args.includes('--version')) {
      queueMicrotask(() => {
        child.stdout.emit('data', 'codex-cli-exec 0.129.0')
        child.emit('close', 0, null)
      })
    }
    child.stdin = new Writable({
      write(chunk, _encoding, callback) {
        capture.stdin += String(chunk)
        callback()
      },
      final(callback) {
        const outputPath = args[args.indexOf('--output-last-message') + 1]
        void writeFile(outputPath, reply, 'utf8').then(() => {
          child.emit('close', 0, null)
        })
        callback()
      },
    })
    child.kill = vi.fn()
    return child
  }
}

function fakeStreamingCodexSpawn(
  reply: string,
  stdoutChunks: string[],
  capture: { args?: string[]; stdin: string },
): CodexSpawn {
  return (_command, args) => {
    capture.args = args
    const child = new EventEmitter() as CodexProcess
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    child.stdin = new Writable({
      write(chunk, _encoding, callback) {
        capture.stdin += String(chunk)
        callback()
      },
      final(callback) {
        const outputPath = args[args.indexOf('--output-last-message') + 1]
        void writeFile(outputPath, reply, 'utf8').then(() => {
          for (const chunk of stdoutChunks) child.stdout.write(chunk)
          child.stdout.end()
          child.emit('close', 0, null)
        })
        callback()
      },
    })
    child.kill = vi.fn()
    return child
  }
}

function fakeCodexAppServerSpawn(
  finalMessage: string,
  deltas: string[],
  capture: { args?: string[]; requests: unknown[] },
): CodexSpawn {
  return (_command, args) => {
    capture.args = args
    const child = new EventEmitter() as CodexProcess
    child.stdout = new PassThrough()
    child.stderr = new PassThrough()
    let stdinBuffer = ''

    function send(message: unknown) {
      child.stdout.write(`${JSON.stringify(message)}\n`)
    }

    function handleRequest(raw: string) {
      const request = JSON.parse(raw) as { id: number; method: string; params?: Record<string, unknown> }
      capture.requests.push(request)
      if (request.method === 'initialize') {
        send({ id: request.id, result: { userAgent: 'codex/0.129.0', codexHome: '/tmp/codex', platformFamily: 'unix', platformOs: 'linux' } })
        return
      }
      if (request.method === 'thread/start') {
        send({ id: request.id, result: { thread: { id: 'thread-1' } } })
        return
      }
      if (request.method === 'turn/start') {
        send({ id: request.id, result: { turn: { id: 'turn-1' } } })
        queueMicrotask(() => {
          deltas.forEach(delta => {
            send({ method: 'item/agentMessage/delta', params: { threadId: 'thread-1', turnId: 'turn-1', itemId: 'message-1', delta } })
          })
          send({ method: 'item/completed', params: { item: { type: 'agentMessage', id: 'message-1', text: finalMessage, phase: 'final_answer', memoryCitation: null }, threadId: 'thread-1', turnId: 'turn-1' } })
          send({ method: 'turn/completed', params: { threadId: 'thread-1', turn: { id: 'turn-1', status: 'completed' } } })
        })
      }
    }

    child.stdin = new Writable({
      write(chunk, _encoding, callback) {
        stdinBuffer += String(chunk)
        const lines = stdinBuffer.split(/\r?\n/)
        stdinBuffer = lines.pop() ?? ''
        for (const line of lines) {
          if (line.trim()) handleRequest(line)
        }
        callback()
      },
    })
    child.kill = vi.fn(() => {
      queueMicrotask(() => child.emit('close', 0, null))
      return true
    })
    return child
  }
}

describe('codexProvider', () => {
  it('turns chat messages into a local Codex prompt', () => {
    expect(codexMessagesToPrompt([
      { role: 'system', content: 'system instructions' },
      { role: 'user', content: 'build a node' },
    ])).toContain('## SYSTEM\nsystem instructions')
    expect(codexMessagesToPrompt([
      { role: 'user', content: 'build a node' },
    ])).toContain('Do not edit files directly')
  })

  it('runs codex exec through the local CLI and reads the final message file', async () => {
    const capture: { args?: string[]; stdin: string } = { stdin: '' }
    const result = await runCodexExec({
      model: '__codex_default__',
      messages: [{ role: 'user', content: 'hello' }],
    }, fakeCodexSpawn('local codex reply', capture))

    expect(result).toEqual({ message: 'local codex reply' })
    expect(capture.args).toEqual(expect.arrayContaining([
      'exec',
      '--sandbox',
      'read-only',
      '--output-last-message',
      '-',
    ]))
    expect(capture.args).not.toContain('--ask-for-approval')
    expect(capture.args).not.toContain('--model')
    expect(capture.stdin).toContain('## USER\nhello')
  })

  it('passes selected model and reasoning effort to codex exec', async () => {
    const capture: { args?: string[]; stdin: string } = { stdin: '' }
    await runCodexExec({
      model: 'gpt-5.5',
      reasoningEffort: 'high',
      messages: [{ role: 'user', content: 'hello' }],
    }, fakeCodexSpawn('local codex reply', capture))

    expect(capture.args).toEqual(expect.arrayContaining([
      '--model',
      'gpt-5.5',
      '-c',
      'model_reasoning_effort="high"',
    ]))
  })

  it('checks local Codex availability without running an agent', async () => {
    const status = await checkCodexStatus(fakeCodexSpawn('unused', { stdin: '' }))

    expect(status).toMatchObject({
      available: true,
      version: 'codex-cli-exec 0.129.0',
    })
  })

  it('streams local Codex token deltas through the app server protocol', async () => {
    const capture: { args?: string[]; requests: unknown[] } = { requests: [] }
    const events: Array<{ type: string; message?: string; content?: string }> = []

    const result = await streamCodexProvider({
      model: 'gpt-5.5',
      reasoningEffort: 'high',
      messages: [{ role: 'user', content: 'hello' }],
    }, event => events.push(event), fakeCodexAppServerSpawn('Hello', ['Hel', 'lo'], capture))

    expect(capture.args).toEqual(['app-server', '--listen', 'stdio://'])
    expect(capture.requests.map(request => (request as { method: string }).method)).toEqual([
      'initialize',
      'thread/start',
      'turn/start',
    ])
    expect(capture.requests[2]).toMatchObject({
      params: {
        model: 'gpt-5.5',
        effort: 'high',
        sandboxPolicy: { type: 'readOnly', networkAccess: false },
      },
    })
    expect(result).toEqual({ message: 'Hello' })
    expect(events).toEqual([
      { type: 'status', message: 'Starting local Codex stream...' },
      { type: 'delta', content: 'Hel' },
      { type: 'delta', content: 'lo' },
      { type: 'done', content: 'Hello' },
    ])
  })

  it('falls back to codex exec when the app server stream is unavailable', async () => {
    const events: Array<{ type: string; message?: string; content?: string }> = []
    const capture: { args?: string[]; stdin: string } = { stdin: '' }
    const spawnImpl: CodexSpawn = (_command, args, options) => {
      if (args[0] === 'app-server') {
        const child = new EventEmitter() as CodexProcess
        child.stdout = new PassThrough()
        child.stderr = new PassThrough()
        child.stdin = new Writable({ write(_chunk, _encoding, callback) { callback() } })
        child.kill = vi.fn()
        queueMicrotask(() => {
          child.stderr.write('app server failed')
          child.emit('close', 1, null)
        })
        return child
      }
      return fakeCodexSpawn('exec fallback reply', capture)(_command, args, options)
    }

    const result = await streamCodexProvider({
      messages: [{ role: 'user', content: 'hello' }],
    }, event => events.push(event), spawnImpl)

    expect(result).toEqual({ message: 'exec fallback reply' })
    expect(capture.args).toContain('exec')
    expect(events).toEqual([
      { type: 'status', message: 'Starting local Codex stream...' },
      { type: 'status', message: 'Local Codex live stream failed; using exec fallback...' },
      { type: 'status', message: 'Running local Codex...' },
      { type: 'delta', content: 'exec fallback reply' },
      { type: 'done', content: 'exec fallback reply' },
    ])
  })
})
