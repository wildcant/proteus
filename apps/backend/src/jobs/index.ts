import type { JobDefinition } from '../core/types/scheduler.js'
import { config as heartbeat } from './heartbeat.js'

export const jobs: JobDefinition[] = [heartbeat]
