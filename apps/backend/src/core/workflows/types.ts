import type { AwilixContainer } from 'awilix'
import { AppError, type ErrorTypes } from '../errors/app-error.js'

export type StepContext = { container: AwilixContainer }

export type StepAction<T> = (context: StepContext) => Promise<T>

export type StepCompensation<T> = (output: T, context: StepContext) => Promise<void>

export interface WorkflowContext {
  step<T>(name: string, action: StepAction<T>, compensation?: StepCompensation<T>): Promise<T>
}

export interface WorkflowConfig {
  name: string
  idempotent?: boolean
}

export interface WorkflowDefinition<TInput, TOutput> {
  name: string
  idempotent: boolean
  handler: (ctx: WorkflowContext, input: TInput) => Promise<TOutput>
}

export interface Workflow<TInput, TOutput> extends WorkflowDefinition<TInput, TOutput> {
  run(input: TInput): Promise<TOutput>
}

type TerminalErrorOptions = { type: ErrorTypes; message: string; code?: string }

export class WorkflowTerminalError extends Error {
  constructor(optionsOrError: TerminalErrorOptions | AppError) {
    const appError = AppError.isError(optionsOrError) ? optionsOrError : new AppError(optionsOrError)
    super(appError.message, { cause: appError })
    this.name = 'WorkflowTerminalError'
  }
}

export interface WorkflowEngine {
  run<TInput, TOutput>(
    workflow: WorkflowDefinition<TInput, TOutput>,
    input: TInput,
    context: StepContext,
  ): Promise<TOutput>
}

let globalEngine: WorkflowEngine | null = null
let globalContainer: AwilixContainer | null = null

export function setWorkflowEngine(engine: WorkflowEngine, container: AwilixContainer): void {
  globalEngine = engine
  globalContainer = container
}

export function createWorkflow<TInput, TOutput>(
  nameOrConfig: string | WorkflowConfig,
  handler: (ctx: WorkflowContext, input: TInput) => Promise<TOutput>,
): Workflow<TInput, TOutput> {
  const config = typeof nameOrConfig === 'string' ? { name: nameOrConfig } : nameOrConfig
  return {
    name: config.name,
    idempotent: config.idempotent ?? false,
    handler,
    run(input: TInput): Promise<TOutput> {
      if (!globalEngine || !globalContainer) {
        throw new Error('No workflow engine configured. Call setWorkflowEngine() first.')
      }
      return globalEngine.run(this, input, { container: globalContainer })
    },
  }
}
