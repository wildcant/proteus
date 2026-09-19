import {
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarGroupContent,
  SidebarGroupLabel,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  TooltipProvider,
} from '@proteus/ui'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import { SettingsIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { Breadcrumbs } from './breadcrumbs'
import type { SidebarGroup as SidebarGroupType } from './nav'
import { ThemeToggle } from './theme-toggle'

type ShellProps = {
  sidebar: SidebarGroupType[]
  settingsSidebar?: SidebarGroupType[]
  topbarActions?: ReactNode
  sidebarFooter?: ReactNode
}

export function Shell({ sidebar, settingsSidebar, topbarActions, sidebarFooter }: ShellProps) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar sidebar={sidebar} settingsSidebar={settingsSidebar} footer={sidebarFooter} />
        <SidebarInset>
          <Topbar actions={topbarActions} />
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

function Topbar({ actions }: { actions?: ReactNode }) {
  return (
    <header className="flex h-12 shrink-0 items-center gap-2 border-b px-4">
      <SidebarTrigger className="-ml-1" />
      <Separator orientation="vertical" className="mr-2 h-4" />
      <Breadcrumbs />
      <div className="ml-auto flex items-center gap-1">
        <ThemeToggle />
        {actions}
      </div>
    </header>
  )
}

function AppSidebar({
  sidebar,
  settingsSidebar,
  footer,
}: {
  sidebar: SidebarGroupType[]
  settingsSidebar?: SidebarGroupType[]
  footer?: ReactNode
}) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })
  const firstSettingsRoute = settingsSidebar?.[0]?.items?.[0]?.to

  return (
    <Sidebar collapsible="icon">
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton size="lg" render={<Link to="/" />} tooltip="Proteus">
              <div className="flex aspect-square size-8 items-center justify-center rounded-lg bg-primary text-primary-foreground">
                <span className="font-bold text-sm">P</span>
              </div>
              <div className="grid flex-1 text-left text-sm leading-tight">
                <span className="truncate font-semibold">Proteus</span>
                <span className="truncate text-muted-foreground text-xs">Admin</span>
              </div>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        {sidebar.map((group) => (
          <SidebarGroup key={group.label}>
            <SidebarGroupLabel>{group.label}</SidebarGroupLabel>
            <SidebarGroupContent>
              <SidebarMenu>
                {group.items.map((item) => {
                  const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`)
                  return (
                    <SidebarMenuItem key={item.to}>
                      <SidebarMenuButton isActive={isActive} tooltip={item.label} render={<Link to={item.to} />}>
                        <span>{item.label}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  )
                })}
              </SidebarMenu>
            </SidebarGroupContent>
          </SidebarGroup>
        ))}
        {!!firstSettingsRoute && (
          <SidebarGroup className="mt-auto">
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  isActive={pathname.startsWith('/settings')}
                  tooltip="Settings"
                  render={<Link to={firstSettingsRoute} />}
                >
                  <SettingsIcon />
                  <span>Settings</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
        )}
      </SidebarContent>
      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
