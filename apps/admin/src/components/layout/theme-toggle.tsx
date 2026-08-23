import { Tooltip, TooltipContent, TooltipTrigger } from '@proteus/ui'
import type { LucideIcon } from 'lucide-react'
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { applyThemeMode, getStoredThemeMode, storeThemeMode, type ThemeMode } from '#/lib/theme'

const NEXT_MODE: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'auto', auto: 'light' }
const ICON: Record<ThemeMode, LucideIcon> = { light: SunIcon, dark: MoonIcon, auto: MonitorIcon }
const LABEL: Record<ThemeMode, string> = { light: 'Light', dark: 'Dark', auto: 'System' }

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(getStoredThemeMode)

  useEffect(() => {
    if (mode !== 'auto') {
      return
    }

    const media = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => applyThemeMode('auto')

    media.addEventListener('change', onChange)
    return () => {
      media.removeEventListener('change', onChange)
    }
  }, [mode])

  function toggleMode() {
    const nextMode = NEXT_MODE[mode]
    setMode(nextMode)
    applyThemeMode(nextMode)
    storeThemeMode(nextMode)
  }

  const Icon = ICON[mode]
  const label = `Theme: ${LABEL[mode]}. Switch to ${LABEL[NEXT_MODE[mode]].toLowerCase()}.`

  return (
    <Tooltip>
      <TooltipTrigger
        render={
          <button
            type="button"
            onClick={toggleMode}
            aria-label={label}
            className="flex size-7 items-center justify-center rounded-md text-muted-foreground hover:text-foreground"
          />
        }
      >
        <Icon className="size-4" />
      </TooltipTrigger>
      <TooltipContent side="bottom">{label}</TooltipContent>
    </Tooltip>
  )
}
