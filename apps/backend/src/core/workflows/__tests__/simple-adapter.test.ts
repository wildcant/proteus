import { ErrorTypes } from '@core/errors/app-error.js'
import { test } from '@tests/setup/test-extend.js'
import { asValue, createContainer } from 'awilix'
import { vi } from 'vitest'
import { createSimpleWorkflowEngine } from '../simple-adapter.js'
import { createWorkflow, WorkflowTerminalError } from '../types.js'

function makeContainer() {
  const container = createContainer()
  container.register({ greeting: asValue('hello') })
  return container
}

test.describe('simple workflow engine', () => {
  test('executes steps in order and returns the final output', async ({ expect }) => {
    const workflow = createWorkflow<{ x: number }, number>('add-ten', async (ctx, input) => {
      const a = await ctx.step('add-five', async () => input.x + 5)
      const b = await ctx.step('add-five-more', async () => a + 5)
      return b
    })

    const engine = createSimpleWorkflowEngine()
    const result = await engine.run(workflow, { x: 1 }, { container: makeContainer() })
    expect(result).toBe(11)
  })

  test('passes the container to step actions', async ({ expect }) => {
    const workflow = createWorkflow<void, string>('resolve-greeting', async (ctx) => {
      return ctx.step('greet', async ({ container }) => {
        return container.resolve('greeting') as string
      })
    })

    const engine = createSimpleWorkflowEngine()
    const result = await engine.run(workflow, undefined, { container: makeContainer() })
    expect(result).toBe('hello')
  })

  test('runs compensations in reverse order on WorkflowTerminalError', async ({ expect }) => {
    const order: string[] = []

    const workflow = createWorkflow<void, void>('compensate-test', async (ctx) => {
      await ctx.step(
        'step-1',
        async () => {
          order.push('action-1')
          return 'result-1'
        },
        async (output) => {
          order.push(`compensate-1:${output}`)
        },
      )

      await ctx.step(
        'step-2',
        async () => {
          order.push('action-2')
          return 'result-2'
        },
        async (output) => {
          order.push(`compensate-2:${output}`)
        },
      )

      await ctx.step('step-3', async () => {
        order.push('action-3-fail')
        throw new WorkflowTerminalError({
          type: ErrorTypes.INVALID_DATA,
          message: 'Insufficient stock for SKU-001',
        })
      })
    })

    const engine = createSimpleWorkflowEngine()
    await expect(engine.run(workflow, undefined, { container: makeContainer() })).rejects.toThrow(
      'Insufficient stock for SKU-001',
    )

    expect(order).toEqual(['action-1', 'action-2', 'action-3-fail', 'compensate-2:result-2', 'compensate-1:result-1'])
  })

  test('treats regular errors as terminal in the simple adapter', async ({ expect }) => {
    const compensated = vi.fn()

    const workflow = createWorkflow<void, void>('regular-error', async (ctx) => {
      await ctx.step('step-1', async () => 'done', compensated)

      await ctx.step('step-2', async () => {
        throw new Error('regular error')
      })
    })

    const engine = createSimpleWorkflowEngine()
    await expect(engine.run(workflow, undefined, { container: makeContainer() })).rejects.toThrow('regular error')

    expect(compensated).toHaveBeenCalledWith('done', expect.objectContaining({ container: expect.anything() }))
  })

  test('does not compensate a step whose action failed', async ({ expect }) => {
    const events: string[] = []

    const workflow = createWorkflow<void, void>('failed-step-no-compensate', async (ctx) => {
      await ctx.step(
        'only-step',
        async () => {
          events.push('action')
          throw new WorkflowTerminalError({
            type: ErrorTypes.NOT_FOUND,
            message: 'Cart not found',
          })
        },
        async () => {
          events.push('compensate')
        },
      )
    })

    const engine = createSimpleWorkflowEngine()
    await expect(engine.run(workflow, undefined, { container: makeContainer() })).rejects.toThrow()

    expect(events).toEqual(['action'])
  })

  test('continues compensating even if a compensation throws', async ({ expect }) => {
    const events: string[] = []

    const workflow = createWorkflow<void, void>('compensation-failure', async (ctx) => {
      await ctx.step(
        'step-1',
        async () => 'a',
        async () => {
          events.push('comp-1')
        },
      )
      await ctx.step(
        'step-2',
        async () => 'b',
        async () => {
          throw new Error('comp failed')
        },
      )
      await ctx.step('step-3', async () => {
        throw new Error('boom')
      })
    })

    const engine = createSimpleWorkflowEngine()
    await expect(engine.run(workflow, undefined, { container: makeContainer() })).rejects.toThrow('boom')
    expect(events).toContain('comp-1')
  })

  test('skips steps with no compensation during rollback', async ({ expect }) => {
    const compensated = vi.fn()

    const workflow = createWorkflow<void, void>('partial-compensation', async (ctx) => {
      await ctx.step('no-comp', async () => 'a')
      await ctx.step('has-comp', async () => 'b', compensated)
      await ctx.step('fail', async () => {
        throw new WorkflowTerminalError({
          type: ErrorTypes.UNEXPECTED_STATE,
          message: 'Card expired',
        })
      })
    })

    const engine = createSimpleWorkflowEngine()
    await expect(engine.run(workflow, undefined, { container: makeContainer() })).rejects.toThrow()
    expect(compensated).toHaveBeenCalledOnce()
  })
})
