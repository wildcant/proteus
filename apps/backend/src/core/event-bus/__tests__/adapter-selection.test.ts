import { test } from '@tests/setup/test-extend.js'
import { resolveEventBusAdapterName } from '../adapter-selection.js'

test.describe('resolveEventBusAdapterName', () => {
  test('gives workerd Cloudflare Queues, the only transport it has', async ({ expect }) => {
    expect(resolveEventBusAdapterName({ configured: undefined, runtime: 'workerd' })).toBe('cloudflare-queues')
  })

  test('gives node Temporal, which workerd cannot load', async ({ expect }) => {
    expect(resolveEventBusAdapterName({ configured: undefined, runtime: 'node' })).toBe('temporal')
  })

  test.for([
    { runtime: 'node', configured: 'inline' },
    { runtime: 'workerd', configured: 'inline' },
    { runtime: 'node', configured: 'temporal' },
    { runtime: 'workerd', configured: 'cloudflare-queues' },
  ] as const)('a composition root that pins $configured on $runtime gets it', ({ runtime, configured }, { expect }) => {
    expect(resolveEventBusAdapterName({ configured, runtime })).toBe(configured)
  })
})
