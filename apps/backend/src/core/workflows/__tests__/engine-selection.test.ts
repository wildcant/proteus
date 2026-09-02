import { test } from '@tests/setup/test-extend.js'
import { resolveWorkflowEngineName } from '../engine-selection.js'

test.describe('resolveWorkflowEngineName', () => {
  test('gives workerd the simple adapter, because it cannot load Temporal', async ({ expect }) => {
    expect(resolveWorkflowEngineName({ configured: undefined, runtime: 'workerd' })).toBe('simple')
  })

  test('gives node the temporal adapter', async ({ expect }) => {
    expect(resolveWorkflowEngineName({ configured: undefined, runtime: 'node' })).toBe('temporal')
  })

  test.for([
    { runtime: 'node', configured: 'simple' },
    { runtime: 'workerd', configured: 'simple' },
    { runtime: 'node', configured: 'temporal' },
  ] as const)('a composition root that pins $configured on $runtime gets it', ({ runtime, configured }, { expect }) => {
    expect(resolveWorkflowEngineName({ configured, runtime })).toBe(configured)
  })
})
