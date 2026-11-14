/**
 * Create a deployment's first admin: a super admin who can sign in to the admin and run
 * `catalog:import`.
 *
 * Usage: pnpm --filter backend run admin:create
 *
 * Asks for the name, email and password instead of taking them as arguments, so the password stays
 * out of shell history. Rerunning with the same email finishes a half-made admin and changes nothing
 * else; the password of an admin who already exists is left as it was.
 */

import { createInterface } from 'node:readline/promises'
import { Writable } from 'node:stream'
import type { IAuthModuleService } from '../src/core/types/auth/service.js'
import type { IUserModuleService } from '../src/core/types/user/service.js'
import { Modules } from '../src/core/utils/modules-definition.js'
import { container } from '../src/framework/runtime/container.node.js'
import type { AccessControlModuleService } from '../src/modules/access-control/services/access-control-module-service.js'
import { seedAdmin } from './seed/admin.js'

// One reader for every question, read as a stream of lines: `question()` drops a line that arrives
// before it is asked, which is every line when the answers are piped in. The terminal echoes what is
// typed to the output, so muting the output hides a password.
let muted = false
const output = new Writable({
  write: (chunk, _encoding, done) => {
    if (!muted) process.stdout.write(chunk)
    done()
  },
})
const prompt = createInterface({ input: process.stdin, output, terminal: true })
const lines = prompt[Symbol.asyncIterator]()

async function readLine() {
  const line = await lines.next()
  if (line.done) throw new Error('The input ended before every question was answered')
  return line.value
}

async function ask(question: string) {
  process.stdout.write(question)
  return (await readLine()).trim()
}

async function askHidden(question: string) {
  process.stdout.write(question)
  muted = true
  const answer = await readLine()
  muted = false
  process.stdout.write('\n')
  return answer
}

const name = await ask('Name: ')
const email = await ask('Email: ')
const password = await askHidden('Password: ')
const repeated = await askHidden('Repeat the password: ')
prompt.close()
if (password !== repeated) throw new Error('The passwords differ')
if (!name || !email || !password) throw new Error('Name, email and password are all required')

await seedAdmin(
  {
    authService: container.resolve<IAuthModuleService>(Modules.AUTH),
    userService: container.resolve<IUserModuleService>(Modules.USER),
    accessControlService: container.resolve<AccessControlModuleService>(Modules.ACCESS_CONTROL),
  },
  { name, email, password },
)

process.exit(0)
