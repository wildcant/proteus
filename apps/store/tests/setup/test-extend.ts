import { createTest } from '@proteus/testing'
import type { FileRouteTypes } from '../../src/routeTree.gen'

export const { test, expect } = createTest<FileRouteTypes['to']>()
