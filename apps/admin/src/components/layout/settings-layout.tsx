import { Trans, useLingui } from '@lingui/react/macro'
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarSeparator,
  SidebarTrigger,
  TooltipProvider,
} from '@proteus/ui'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { ArrowLeftIcon, ChevronDownIcon } from 'lucide-react'
import { Breadcrumbs } from './breadcrumbs'
import { useSidebarLabel } from './use-sidebar-label'

type SettingsNavItem = {
  label: string
  to: string
}

type SettingsNavGroup = {
  label: string
  items: SettingsNavItem[]
}

type SettingsLayoutProps = {
  groups: SettingsNavGroup[]
}

export function SettingsLayout({ groups }: SettingsLayoutProps) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <SettingsSidebar groups={groups} />
        <SidebarInset>
          <Topbar />
          <div className="flex-1 overflow-auto">
            <div className="mx-auto max-w-[1600px] p-4">
              <Outlet />
            </div>
          </div>
        </SidebarInset>
      </SidebarProvider>
    </TooltipProvider>
  )
}

function Topbar() {
  const { t } = useLingui()
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" label={t`Toggle Sidebar`} />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumbs />
    </header>
  )
}

function SettingsSidebar({ groups }: { groups: SettingsNavGroup[] }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const sidebarLabel = useSidebarLabel()

  return (
    <Sidebar>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton render={<Link to="/" />}>
              <ArrowLeftIcon />
              <span>
                <Trans>Settings</Trans>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <Separator />
      <SidebarContent>
        {groups.map((group, i) => (
          <div key={group.label}>
            {i > 0 && <SidebarSeparator className="border-dashed" />}
            <Collapsible defaultOpen>
              <SidebarGroup>
                {/* The label is the trigger, so it renders a real <button>: base-ui asks for one
                    here, and a section header that opens and closes is a button in any case. */}
                <CollapsibleTrigger
                  className="group/collapsible flex w-full items-center"
                  render={<SidebarGroupLabel render={<button type="button" />} />}
                >
                  {sidebarLabel(group.label)}
                  <ChevronDownIcon className="ml-auto transition-transform group-data-panel-open/collapsible:rotate-180" />
                </CollapsibleTrigger>
                <CollapsibleContent>
                  <SidebarGroupContent>
                    <SidebarMenu>
                      {group.items.map((item) => {
                        const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`)
                        return (
                          <SidebarMenuItem key={item.to}>
                            <SidebarMenuButton isActive={isActive} render={<Link to={item.to} />}>
                              <span>{sidebarLabel(item.label)}</span>
                            </SidebarMenuButton>
                          </SidebarMenuItem>
                        )
                      })}
                    </SidebarMenu>
                  </SidebarGroupContent>
                </CollapsibleContent>
              </SidebarGroup>
            </Collapsible>
          </div>
        ))}
      </SidebarContent>
    </Sidebar>
  )
}
