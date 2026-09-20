import { faker } from '@faker-js/faker'
import { eq } from 'drizzle-orm'
import {
  actorRoleAssignmentTable,
  type CreateActorRoleAssignment,
  type CreateRole,
  roleTable,
} from '../../../src/schema.gen.js'
import { db } from '../../db/client.js'

export function generateRole(overrides?: Partial<CreateRole>): CreateRole {
  return {
    name: `${faker.word.adjective()} ${faker.word.noun()}`,
    description: null,
    isSuperAdmin: false,
    protected: false,
    featuresJson: [],
    ...overrides,
  }
}

export async function createRole(overrides?: Partial<CreateRole>) {
  const values = generateRole(overrides)
  const [role] = await db.insert(roleTable).values(values).returning()
  if (!role) throw new Error('Role insert returned no rows')

  return {
    ...role,
    [Symbol.asyncDispose]: async () => {
      await deleteRoleById(role.id)
    },
  }
}

export async function deleteRoleById(id: string) {
  await db.delete(actorRoleAssignmentTable).where(eq(actorRoleAssignmentTable.roleId, id))
  await db.delete(roleTable).where(eq(roleTable.id, id))
}

export function generateActorRoleAssignment(overrides?: Partial<CreateActorRoleAssignment>): CreateActorRoleAssignment {
  return {
    actorType: 'user',
    actorId: `usr_${faker.string.alphanumeric(32)}`,
    roleId: `role_${faker.string.alphanumeric(32)}`,
    ...overrides,
  }
}

export async function createActorRoleAssignment(overrides?: Partial<CreateActorRoleAssignment>) {
  const values = generateActorRoleAssignment(overrides)
  const [assignment] = await db.insert(actorRoleAssignmentTable).values(values).returning()
  if (!assignment) throw new Error('ActorRoleAssignment insert returned no rows')

  return {
    ...assignment,
    [Symbol.asyncDispose]: async () => {
      await deleteActorRoleAssignmentById(assignment.id)
    },
  }
}

export async function deleteActorRoleAssignmentById(id: string) {
  await db.delete(actorRoleAssignmentTable).where(eq(actorRoleAssignmentTable.id, id))
}
