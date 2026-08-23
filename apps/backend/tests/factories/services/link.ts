import type { AwilixContainer } from 'awilix'
import type { ILinkRepositoryMap, ILinkService } from '../../../src/core/types/link/service.js'
import { ContainerRegistrationKeys } from '../../../src/core/utils/index.js'

/**
 * A link repository, for the two things reads cannot cover: asserting on a link row, and
 * `vi.spyOn` when a test needs one link to fail mid-workflow.
 */
export function linkRepo<K extends keyof ILinkRepositoryMap>(
  container: AwilixContainer,
  name: K,
): ILinkRepositoryMap[K] {
  return container.resolve<ILinkService>(ContainerRegistrationKeys.LINK).repo(name)
}
