import type { AppContainer } from '../../../src/core/types/container.js'
import type { ILinkService } from '../../../src/core/types/link/service.js'
import { ContainerRegistrationKeys } from '../../../src/core/utils/container.js'

type LinkRepoKey = Parameters<ILinkService['repo']>[0]

/**
 * A link repository, for the two things reads cannot cover: asserting on a link row, and
 * `vi.spyOn` when a test needs one link to fail mid-workflow.
 *
 * Typed off `ILinkService['repo']` rather than off the repository map, so the map stays private to
 * the port that uses it and the return type is still the repository the name selects.
 */
export function linkRepo<K extends LinkRepoKey>(container: AppContainer, name: K) {
  return container.resolve(ContainerRegistrationKeys.LINK).repo(name)
}
