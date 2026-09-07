import { TestWorkflowEnvironment } from '@temporalio/testing'
import {
  installTemporalRuntime,
  installTypeScriptRequireHook,
  TEMPORAL_BOOT_TIMEOUT,
} from '@tests/setup/temporal-test-env.js'
import { PAYLOAD_CONVERTER_PATH } from '../../../../temporal/config.js'

/**
 * The workflow engine's own test server.
 *
 * The process-global installers moved to `tests/setup/temporal-test-env.ts` when the event bus
 * became a second subsystem that boots servers: the two may not import each other, so a Temporal
 * Runtime owned by this folder is one the bus cannot install. What stayed is the part that is
 * genuinely this engine's — time skipping, which its workflow tests need and standalone activities
 * have no use for.
 */
export { TEMPORAL_BOOT_TIMEOUT }

/**
 * A time-skipping test server whose client speaks the same tagged payload format as production —
 * without it a `BigNumber` step output would come back as its `{s,e,c}` internals and every
 * assertion about money would be testing the wrong thing.
 */
export async function createTemporalTestEnvironment(): Promise<TestWorkflowEnvironment> {
  installTypeScriptRequireHook()
  installTemporalRuntime()

  return TestWorkflowEnvironment.createTimeSkipping({
    client: { dataConverter: { payloadConverterPath: PAYLOAD_CONVERTER_PATH } },
  })
}
