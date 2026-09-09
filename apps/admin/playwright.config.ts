import { defineE2eConfig } from '@proteus/testing/playwright'

export default defineE2eConfig({ app: 'admin', appPort: 3012, backendPort: 3015, workerHealthPort: 3018 })
