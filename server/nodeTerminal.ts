import { createHash } from 'crypto'
import path from 'path'
import { existsSync } from 'fs'
import { mkdir as fsMkdir, readFile as fsReadFile, writeFile as fsWriteFile } from 'fs/promises'
import { spawn as nodeSpawn } from 'child_process'

type ChildLike = ReturnType<typeof nodeSpawn>
type SpawnLike = (command: string, args: string[], options: Record<string, unknown>) => ChildLike

export interface NodeTerminalRequest {
  projectName?: string
  selectedNodeId?: string
  nodeId?: string
  nodeName?: string
  command: string
  files?: Record<string, string>
  requirements?: string[]
  installScript?: string
}

export interface NodeTerminalResult {
  success: true
  command: string
  exitCode: number
  stdout: string
  stderr: string
  cwd: string
  envPath: string
}

export interface NodeTerminalOptions {
  rootDir?: string
  exists?: (candidate: string) => boolean
  mkdir?: typeof fsMkdir
  writeFile?: typeof fsWriteFile
  readFile?: typeof fsReadFile
  spawn?: SpawnLike
  timeoutMs?: number
}

export function terminalRootDir(baseDir = process.cwd()): string {
  return path.resolve(baseDir, '.node-builder', 'terminal')
}

function slugPart(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 56) || 'pack'
}

export function terminalPathsForPack(rootDir: string, projectName: string) {
  const workspaceDir = path.join(rootDir, slugPart(projectName))
  const envDir = path.join(workspaceDir, '.venv')
  return {
    workspaceDir,
    envDir,
    requirementsPath: path.join(workspaceDir, 'requirements.txt'),
    requirementsHashPath: path.join(workspaceDir, '.requirements.hash'),
    pythonPath: process.platform === 'win32'
      ? path.join(envDir, 'Scripts', 'python.exe')
      : path.join(envDir, 'bin', 'python'),
    binDir: process.platform === 'win32'
      ? path.join(envDir, 'Scripts')
      : path.join(envDir, 'bin'),
  }
}

export function terminalPathsForNode(rootDir: string, nodeId: string, nodeName: string) {
  return terminalPathsForPack(rootDir, `${nodeName}-${nodeId}`)
}

export function isSafeTerminalFilePath(candidate: string): boolean {
  if (!candidate || path.isAbsolute(candidate) || candidate.includes('\\')) return false
  const normalized = path.posix.normalize(candidate)
  if (normalized === '.' || normalized.startsWith('../') || normalized === '..') return false
  return normalized.split('/').every(part => part.length > 0 && part !== '..')
}

function safeWorkspaceFile(workspaceDir: string, relativePath: string): string {
  if (!isSafeTerminalFilePath(relativePath)) {
    throw new Error(`Unsafe node terminal file path: ${relativePath}`)
  }
  const resolved = path.resolve(workspaceDir, relativePath)
  const workspaceRoot = `${path.resolve(workspaceDir)}${path.sep}`
  if (!resolved.startsWith(workspaceRoot)) {
    throw new Error(`Unsafe node terminal file path: ${relativePath}`)
  }
  return resolved
}

function requirementsText(request: NodeTerminalRequest): string {
  const explicit = (request.requirements ?? []).map(line => line.trim()).filter(Boolean)
  if (explicit.length > 0) return `${explicit.join('\n')}\n`
  return request.files?.['requirements.txt'] ?? ''
}

function hashText(value: string): string {
  return createHash('sha256').update(value).digest('hex')
}

function processEnvWithVenv(binDir: string): NodeJS.ProcessEnv {
  return {
    ...process.env,
    VIRTUAL_ENV: path.dirname(binDir),
    PATH: `${binDir}${path.delimiter}${process.env.PATH ?? ''}`,
  }
}

interface ProcessResult {
  exitCode: number
  stdout: string
  stderr: string
}

function runProcess(
  spawn: SpawnLike,
  command: string,
  args: string[],
  options: Record<string, unknown>,
  timeoutMs: number,
): Promise<ProcessResult> {
  return new Promise((resolve, reject) => {
    const child = spawn(command, args, options)
    let stdout = ''
    let stderr = ''
    let settled = false
    const timer = setTimeout(() => {
      if (settled) return
      settled = true
      child.kill?.()
      reject(new Error(`${command} timed out after ${timeoutMs}ms`))
    }, timeoutMs)

    child.stdout?.on('data', chunk => { stdout += String(chunk) })
    child.stderr?.on('data', chunk => { stderr += String(chunk) })
    child.on('error', err => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      reject(err)
    })
    child.on('close', code => {
      if (settled) return
      settled = true
      clearTimeout(timer)
      resolve({ exitCode: Number(code ?? 0), stdout, stderr })
    })
  })
}

async function runRequiredProcess(
  spawn: SpawnLike,
  command: string,
  args: string[],
  options: Record<string, unknown>,
  timeoutMs: number,
) {
  const result = await runProcess(spawn, command, args, options, timeoutMs)
  if (result.exitCode !== 0) {
    throw new Error(`${command} ${args.join(' ')} failed with exit code ${result.exitCode}.\n${result.stderr || result.stdout}`)
  }
  return result
}

function shellCommand(command: string): { command: string; args: string[] } {
  if (process.platform === 'win32') {
    return { command: process.env.ComSpec || 'cmd.exe', args: ['/d', '/s', '/c', command] }
  }
  return { command: process.env.SHELL || 'bash', args: ['-lc', command] }
}

export async function runNodeTerminalCommand(
  request: NodeTerminalRequest,
  options: NodeTerminalOptions = {},
): Promise<NodeTerminalResult> {
  const projectName = request.projectName ?? request.nodeName
  if (!projectName || !request.command?.trim()) {
    throw new Error('projectName and command are required')
  }

  const rootDir = options.rootDir ?? terminalRootDir()
  const exists = options.exists ?? existsSync
  const mkdir = options.mkdir ?? fsMkdir
  const writeFile = options.writeFile ?? fsWriteFile
  const readFile = options.readFile ?? fsReadFile
  const spawn = options.spawn ?? nodeSpawn
  const timeoutMs = options.timeoutMs ?? 120_000
  const paths = terminalPathsForPack(rootDir, projectName)

  await mkdir(paths.workspaceDir, { recursive: true })

  for (const [relativePath, content] of Object.entries(request.files ?? {})) {
    const destination = safeWorkspaceFile(paths.workspaceDir, relativePath)
    await mkdir(path.dirname(destination), { recursive: true })
    await writeFile(destination, content, 'utf8')
  }

  const reqText = requirementsText(request)
  await writeFile(paths.requirementsPath, reqText, 'utf8')

  if (!exists(paths.envDir)) {
    await runRequiredProcess(spawn, 'uv', ['venv', paths.envDir], { cwd: paths.workspaceDir }, timeoutMs)
  }

  if (reqText.trim()) {
    const nextHash = hashText(reqText)
    let previousHash = ''
    try {
      previousHash = String(await readFile(paths.requirementsHashPath, 'utf8')).trim()
    } catch {}
    if (previousHash !== nextHash) {
      await runRequiredProcess(spawn, 'uv', [
        'pip',
        'install',
        '--python',
        paths.pythonPath,
        '-r',
        paths.requirementsPath,
      ], { cwd: paths.workspaceDir }, timeoutMs)
      await writeFile(paths.requirementsHashPath, `${nextHash}\n`, 'utf8')
    }
  }

  const shell = shellCommand(request.command)
  const result = await runProcess(spawn, shell.command, shell.args, {
    cwd: paths.workspaceDir,
    env: processEnvWithVenv(paths.binDir),
  }, timeoutMs)

  return {
    success: true,
    command: request.command,
    exitCode: result.exitCode,
    stdout: result.stdout,
    stderr: result.stderr,
    cwd: paths.workspaceDir,
    envPath: paths.envDir,
  }
}
