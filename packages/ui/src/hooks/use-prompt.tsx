import * as React from 'react'
import { createRoot } from 'react-dom/client'
import { type PromptProps, RenderPrompt } from '#/components/ui/prompt.tsx'

export function usePrompt() {
  const currentPromptPromise = React.useRef<Promise<boolean> | null>(null)

  const prompt = async (props: PromptProps): Promise<boolean> => {
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

      mountRoot.render(<RenderPrompt open={open} onConfirm={onConfirm} onCancel={onCancel} {...props} />)
    })

    currentPromptPromise.current = promptPromise
    return promptPromise
  }

  return prompt
}
