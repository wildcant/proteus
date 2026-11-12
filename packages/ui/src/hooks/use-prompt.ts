import { createPromptHook } from '@proteus/ui-core'
import { type PromptProps, RenderPrompt } from '#/components/ui/prompt.tsx'

export const usePrompt = createPromptHook<PromptProps>(RenderPrompt)
