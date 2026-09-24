import type { MessageDescriptor } from '@lingui/core'
import { msg } from '@lingui/core/macro'
import { useLingui } from '@lingui/react/macro'
import { Tooltip, TooltipContent, TooltipTrigger } from '@proteus/ui'
import type { LucideIcon } from 'lucide-react'
import { MonitorIcon, MoonIcon, SunIcon } from 'lucide-react'
import { useEffect, useState } from 'react'
import { applyThemeMode, getStoredThemeMode, storeThemeMode, type ThemeMode } from '#/lib/theme'

const NEXT_MODE: Record<ThemeMode, ThemeMode> = { light: 'dark', dark: 'auto', auto: 'light' }
const ICON: Record<ThemeMode, LucideIcon> = { light: SunIcon, dark: MoonIcon, auto: MonitorIcon }
const LABEL: Record<ThemeMode, MessageDescriptor> = { light: msg`Light`, dark: msg`Dark`, auto: msg`System` }

export function ThemeToggle() {
  const [mode, setMode] = useState<ThemeMode>(getStoredThemeMode)
  const { t, i18n } = useLingui()

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
  const current = i18n._(LABEL[mode])
  const next = i18n._(LABEL[NEXT_MODE[mode]]).toLowerCase()
  const label = t`Theme: ${current}. Switch to ${next}.`

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
