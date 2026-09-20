import { faker } from '@faker-js/faker'
import type { PermissionGrant } from '../../../src/core/types/access-control/common.js'
import type { AppContainer } from '../../../src/core/types/container.js'
import type { CreateUserDTO } from '../../../src/core/types/user/mutations.js'
import { Modules } from '../../../src/core/utils/modules-definition.js'
import { generateCreateUserDTO } from '../user-dto.js'

/**
 * A user who holds exactly the features named, through a role of their own.
 *
 * Operator alerts are addressed by permission, so a suite that asserts one lands has to put
 * somebody in the database who qualifies for it. The role is per-operator rather than shared so two
 * calls in one test describe two independent audiences.
 */
export async function createOperator(
  container: AppContainer,
  features: PermissionGrant[],
  overrides?: Partial<CreateUserDTO>,
) {
  const userService = container.resolve(Modules.USER)
  const accessControlService = container.resolve(Modules.ACCESS_CONTROL)

  const user = await userService.createUser(generateCreateUserDTO(overrides))
  const role = await accessControlService.createRole({ name: `Operator ${faker.string.alphanumeric(8)}`, features })
  await accessControlService.assignRolesToUser(user.id, [role.id])

  return user
}
