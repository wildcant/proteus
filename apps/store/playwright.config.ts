import { defineE2eConfig } from '@proteus/testing/playwright'

export default defineE2eConfig({ app: 'store', appPort: 3011, backendPort: 3013, workerHealthPort: 3017 })
