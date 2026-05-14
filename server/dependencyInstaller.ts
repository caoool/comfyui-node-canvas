import { spawn as nodeSpawn } from 'child_process'
import { existsSync } from 'fs'
import path from 'path'
import { managedPackDirFor } from './managedProject.ts'

type ExistsFn = (candidate: string) => boolean
type SpawnResult = {
  stdout?: { on: (event: 'data', cb: (chunk: Buffer | string) => void) => unknown }
  stderr?: { on: (event: 'data', cb: (chunk: Buffer | string) => void) => unknown }
  on: (event: 'close' | 'error', cb: (value: number | Error | null) => void) => unknown
  kill?: () => void
}
type SpawnFn = (command: string, args: string[], options: { cwd: string; env: NodeJS.ProcessEnv }) => SpawnResult

class CommandFailedError extends Error {
  command: string
  args: string[]
  stdout: string
  stderr: string
  code: number | null

  constructor(
    message: string,
    command: string,
    args: string[],
    stdout: string,
    stderr: string,
    code: number | null,
  ) {
    super(message)
    this.command = command
    this.args = args
    this.stdout = stdout
    this.stderr = stderr
    this.code = code
  }
}

export interface InstallDependenciesOptions {
  exists?: ExistsFn
  spawn?: SpawnFn
  timeoutMs?: number
}

export interface InstallDependenciesResult {
  success: true
  python: string
  requirementsPath: string
  installScriptPath: string
  stdout: string
  stderr: string
}

export function requirementsPathFor(installPath: string, packName?: string): string {
  return path.join(managedPackDirFor(installPath, packName), 'requirements.txt')
}

export function installScriptPathFor(installPath: string, packName?: string): string {
  return path.join(managedPackDirFor(installPath, packName), 'install.py')
}

export function resolveComfyPython(installPath: string, exists: ExistsFn = existsSync): string | null {
  const candidates = [
    path.join(installPath, '.venv', 'bin', 'python'),
    path.join(installPath, 'venv', 'bin', 'python'),
    path.join(installPath, 'python_embeded', 'python.exe'),
    path.join(installPath, 'python.exe'),
  ]
  return candidates.find(candidate => exists(candidate)) ?? null
}

function appendChunk(current: string, chunk: Buffer | string): string {
  return current + String(chunk)
}

async function runCommand(command: string, args: string[], cwd: string, spawn: SpawnFn, timeoutMs: number) {
  return await new Promise<{ stdout: string; stderr: string }>((resolve, reject) => {
    let stdout = ''
    let stderr = ''
    const child = spawn(command, args, {
      cwd,
      env: {
        ...process.env,
        GIT_CEILING_DIRECTORIES: cwd,
        GIT_DISCOVERY_ACROSS_FILESYSTEM: '0',
      },
    })
    const timer = setTimeout(() => {
      child.kill?.()
      reject(new Error(`Dependency installation timed out after ${Math.round(timeoutMs / 1000)} seconds.`))
    }, timeoutMs)

    child.stdout?.on('data', chunk => { stdout = appendChunk(stdout, chunk) })
    child.stderr?.on('data', chunk => { stderr = appendChunk(stderr, chunk) })
    child.on('error', error => {
      clearTimeout(timer)
      reject(error instanceof Error ? error : new Error(String(error)))
    })
    child.on('close', code => {
      clearTimeout(timer)
      if (code === 0) {
        resolve({ stdout, stderr })
        return
      }
      reject(new CommandFailedError(
        `${command} ${args.join(' ')} failed with exit code ${code}.\n${stderr || stdout}`.trim(),
        command,
        args,
        stdout,
        stderr,
        typeof code === 'number' ? code : null,
      ))
    })
  })
}

function isMissingPip(error: unknown): boolean {
  if (!(error instanceof CommandFailedError)) return false
  return error.args[0] === '-m' && error.args[1] === 'pip' && error.args[2] === 'install' && error.args[3] === '-r' &&
    `${error.stderr}\n${error.stdout}\n${error.message}`.includes('No module named pip')
}

async function installRequirements(
  python: string,
  requirementsPath: string,
  cwd: string,
  spawn: SpawnFn,
  timeoutMs: number,
): Promise<{ stdout: string; stderr: string }> {
  try {
    return await runCommand(python, ['-m', 'pip', 'install', '-r', requirementsPath], cwd, spawn, timeoutMs)
  } catch (error) {
    if (!isMissingPip(error)) throw error
    return await runCommand(
      'uv',
      ['pip', 'install', '--python', python, '-r', requirementsPath],
      cwd,
      spawn,
      timeoutMs,
    )
  }
}

export async function installManagedPackDependencies(
  installPath: string,
  packNameOrOptions: string | InstallDependenciesOptions = {},
  maybeOptions: InstallDependenciesOptions = {},
): Promise<InstallDependenciesResult> {
  const packName = typeof packNameOrOptions === 'string' ? packNameOrOptions : undefined
  const options = typeof packNameOrOptions === 'string' ? maybeOptions : packNameOrOptions
  const exists = options.exists ?? existsSync
  const spawn = options.spawn ?? nodeSpawn as unknown as SpawnFn
  const timeoutMs = options.timeoutMs ?? 30 * 60 * 1000
  const packDir = managedPackDirFor(installPath, packName)
  const requirementsPath = requirementsPathFor(installPath, packName)
  const installScriptPath = installScriptPathFor(installPath, packName)
  const hasRequirements = exists(requirementsPath)
  const hasInstallScript = exists(installScriptPath)
  if (!hasRequirements && !hasInstallScript) {
    throw new Error(`No requirements.txt or install.py found in ${managedPackDirFor(installPath, packName)}. Deploy the pack first.`)
  }

  const python = resolveComfyPython(installPath, exists)
  if (!python) {
    throw new Error(`Could not find ComfyUI Python under ${installPath}. Expected .venv/bin/python, venv/bin/python, or python_embeded/python.exe.`)
  }

  const outputs: Array<{ stdout: string; stderr: string }> = []
  if (hasInstallScript) outputs.push(await runCommand(python, [installScriptPath], packDir, spawn, timeoutMs))
  if (hasRequirements) outputs.push(await installRequirements(python, requirementsPath, packDir, spawn, timeoutMs))

  return {
    success: true,
    python,
    requirementsPath,
    installScriptPath,
    stdout: outputs.map(output => output.stdout).filter(Boolean).join('\n'),
    stderr: outputs.map(output => output.stderr).filter(Boolean).join('\n'),
  }
}
