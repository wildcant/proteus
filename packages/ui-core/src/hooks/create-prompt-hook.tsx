import { type ComponentType, useRef } from 'react'
import { createRoot } from 'react-dom/client'

export type PromptRendererProps<TPromptProps> = TPromptProps & {
  open: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Builds a `usePrompt` hook over the app's own styled confirm dialog. The mounting and the
 * one-prompt-at-a-time promise are shared; the look is the renderer's.
 */
export function createPromptHook<TPromptProps extends object>(
  PromptRenderer: ComponentType<PromptRendererProps<TPromptProps>>,
) {
  return function usePrompt() {
    const currentPromptPromise = useRef<Promise<boolean> | null>(null)

    const prompt = async (props: TPromptProps): Promise<boolean> => {
      if (currentPromptPromise.current) {
        return currentPromptPromise.current
      }

      const promptPromise = new Promise<boolean>((resolve) => {
        let open = true
        const mountRoot = createRoot(document.createElement('div'))

        const onCancel = () => {
          open = false
          mountRoot.unmount()
          resolve(false)
          currentPromptPromise.current = null
        }

        const onConfirm = () => {
          open = false
          resolve(true)
          mountRoot.unmount()
          currentPromptPromise.current = null
        }

        mountRoot.render(<PromptRenderer {...props} open={open} onConfirm={onConfirm} onCancel={onCancel} />)
      })

      currentPromptPromise.current = promptPromise
      return promptPromise
    }

    return prompt
  }
}
