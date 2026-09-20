import type { AppContainer } from '../../../src/core/types/container.js'
import type { ILinkRepositoryMap } from '../../../src/core/types/link/service.js'
import { ContainerRegistrationKeys } from '../../../src/core/utils/container.js'

/**
 * A link repository, for the two things reads cannot cover: asserting on a link row, and
 * `vi.spyOn` when a test needs one link to fail mid-workflow.
 */
export function linkRepo<K extends keyof ILinkRepositoryMap>(container: AppContainer, name: K): ILinkRepositoryMap[K] {
  return container.resolve(ContainerRegistrationKeys.LINK).repo(name)
}
