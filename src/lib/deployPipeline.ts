import type { DeployManagedPackResult, InstallManagedDependenciesResult } from './writeToFilesystem'

export interface DeployPipelineDeps {
  deploy: () => Promise<DeployManagedPackResult>
  installDependencies: () => Promise<InstallManagedDependenciesResult>
  restart: () => Promise<void>
  waitForRestart: () => Promise<boolean>
  onStep?: (step: DeployPipelineStep) => void
}

export type DeployPipelineStep =
  | 'deploying'
  | 'installing-dependencies'
  | 'skipping-dependencies'
  | 'requesting-restart'
  | 'waiting-for-restart'
  | 'done'

export interface DeployPipelineResult {
  deployResult: DeployManagedPackResult
  dependencyResult: InstallManagedDependenciesResult | null
  installedDependencies: boolean
  backOnline: boolean
}

function hasDependencyFiles(filesWritten: string[]): boolean {
  return filesWritten.includes('requirements.txt') || filesWritten.includes('install.py')
}

export async function runDeployPipeline(deps: DeployPipelineDeps): Promise<DeployPipelineResult> {
  deps.onStep?.('deploying')
  const deployResult = await deps.deploy()

  let dependencyResult: InstallManagedDependenciesResult | null = null
  if (hasDependencyFiles(deployResult.filesWritten)) {
    deps.onStep?.('installing-dependencies')
    dependencyResult = await deps.installDependencies()
  } else {
    deps.onStep?.('skipping-dependencies')
  }

  deps.onStep?.('requesting-restart')
  await deps.restart()

  deps.onStep?.('waiting-for-restart')
  const backOnline = await deps.waitForRestart()
  deps.onStep?.('done')

  return {
    deployResult,
    dependencyResult,
    installedDependencies: dependencyResult !== null,
    backOnline,
  }
}
