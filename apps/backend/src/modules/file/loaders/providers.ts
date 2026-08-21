import type { AwilixContainer } from 'awilix'
import { asValue } from 'awilix'
import type { AbstractFileProviderService } from '../../../core/utils/abstract-file-provider.js'
import type { ModuleProviderExports } from '../../../core/utils/module-provider.js'
import { FILE_PROVIDER_REGISTRATION_PREFIX } from '../constants.js'
import { FileProviderService } from '../services/file-provider-service.js'

export type FileProviderConfig = {
  resolve: ModuleProviderExports
  id: string
  options?: Record<string, unknown>
}

export type FileModuleOptions = {
  providers?: FileProviderConfig[]
  maxFileSize?: number
}

// biome-ignore lint/suspicious/noExplicitAny: provider constructors accept varied dependency shapes
type ProviderConstructor = (new (...args: any[]) => AbstractFileProviderService) & { identifier: string }

export async function loadFileProviders({
  container,
  options,
}: {
  container: AwilixContainer
  options?: Record<string, unknown>
}): Promise<void> {
  const opts = options as FileModuleOptions | undefined

  if (opts?.providers) {
    for (const config of opts.providers) {
      const { resolve: providerExports, id, options: providerOptions } = config

      for (const ServiceClass of providerExports.services) {
        const Klass = ServiceClass as ProviderConstructor
        if (!Klass.identifier) {
          throw new Error(`File provider class ${Klass.name} is missing static "identifier" property.`)
        }
        const instance = new Klass(container.cradle, providerOptions ?? {})
        container.register({
          [`${FILE_PROVIDER_REGISTRATION_PREFIX}${Klass.identifier}_${id}`]: asValue(instance),
        })
      }
    }
  }

  const fileProviderService = new FileProviderService(container.cradle, opts?.maxFileSize)
  container.register({ fileProviderService: asValue(fileProviderService) })
}
