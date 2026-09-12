import type { StepCompensation, WorkflowEngine } from '../../core/workflows/types.js'

interface CompensationEntry {
  name: string
  compensation: StepCompensation<unknown>
  output: unknown
}

export function createSimpleWorkflowEngine(): WorkflowEngine {
  return {
    async run(workflow, input, stepContext) {
      const compensations: CompensationEntry[] = []

      try {
        return await workflow.handler(
          {
            async step(name, action, compensation) {
              const result = await action(stepContext)

              // Track completed step for rollback (only successful steps have output to compensate)
              if (compensation) {
                compensations.push({
                  name,
                  compensation: compensation as StepCompensation<unknown>,
                  output: result,
                })
              }

              return result
            },
          },
          input,
        )
      } catch (error) {
        // Simple adapter treats all errors as terminal — run compensations in reverse
        for (const entry of compensations.reverse()) {
          try {
            await entry.compensation(entry.output, stepContext)
          } catch {
            // Compensation errors are swallowed — all compensations must attempt to run
          }
        }

        throw error
      }
    },
  }
}
