import type { AnyFormGroupApi } from '@tanstack/form-core'
import { useRef, useState } from 'react'
import type { ProgressStatus } from '#/components/progress-tabs'
import type { useCreateProductForm } from '../../hooks/use-create-product-form'
import { type GroupRefs, LAST_TAB, TABS, Tab } from './constants'

async function validateGroup(group: AnyFormGroupApi): Promise<boolean> {
  await group.validateAllFields('submit')
  if (!group.areRelatedFieldsValid()) return false
  await group.validate('submit', { skipRelatedFieldValidation: true })
  return group.areRelatedFieldsValid() && group.state.meta.isValid
}

export function useProgressCreateProductForm(form: ReturnType<typeof useCreateProductForm>['form']) {
  const [tab, setTab] = useState<Tab>(Tab.DETAILS)
  const [tabState, setTabState] = useState<Record<Tab, ProgressStatus>>({
    [Tab.DETAILS]: 'in-progress',
    [Tab.ORGANIZE]: 'not-started',
    [Tab.ATTRIBUTES]: 'not-started',
    [Tab.VARIANTS]: 'not-started',
  })

  const groupRefs = useRef<Partial<Record<Tab, AnyFormGroupApi>>>({}) as GroupRefs

  const validateTab = async (tabKey: Tab) => {
    const group = groupRefs.current[tabKey]
    if (!group) return true
    return validateGroup(group)
  }

  const validateAllTabs = async (): Promise<Tab | null> => {
    for (const t of TABS) {
      if (!(await validateTab(t))) return t
    }
    return null
  }

  const advanceTab = (from: Tab) => {
    const currentIndex = TABS.indexOf(from)
    const nextTab = TABS[currentIndex + 1]
    if (!nextTab) return

    setTabState((prev) => {
      const next = { ...prev }
      for (let i = 0; i <= currentIndex; i++) {
        const t = TABS[i]
        if (t) next[t] = 'completed'
      }
      next[nextTab] = 'in-progress'
      return next
    })
    setTab(nextTab)
  }

  const handleContinue = async () => {
    if (await validateTab(tab)) advanceTab(tab)
  }

  const handleSave = async (intent: 'draft' | 'publish') => {
    const firstInvalid = await validateAllTabs()
    if (firstInvalid) {
      setTab(firstInvalid)
      return
    }
    form.handleSubmit({ intent })
  }

  const handleTabChange = async (value: string | number | null) => {
    if (await validateTab(tab)) setTab(value as Tab)
  }

  const handleKeyDown = (e: React.KeyboardEvent<HTMLFormElement>) => {
    if (e.key === 'Enter') {
      if (e.target instanceof HTMLTextAreaElement && !(e.metaKey || e.ctrlKey)) return
      e.preventDefault()
      if (e.metaKey || e.ctrlKey) {
        if (tab !== LAST_TAB) {
          handleContinue()
        } else {
          handleSave('publish')
        }
      }
    }
  }

  const isLastTab = tab === LAST_TAB

  return { tab, tabState, groupRefs, isLastTab, handleTabChange, handleContinue, handleSave, handleKeyDown }
}
