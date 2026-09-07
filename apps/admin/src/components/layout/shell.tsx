import {
  Collapsible,
  CollapsibleContent,
  Separator,
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarGroup,
  SidebarHeader,
  SidebarInset,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
  SidebarMenuSub,
  SidebarMenuSubButton,
  SidebarMenuSubItem,
  SidebarProvider,
  SidebarRail,
  SidebarTrigger,
  TooltipProvider,
} from '@proteus/ui'
import { Link, Outlet, useRouterState } from '@tanstack/react-router'
import type { ReactNode } from 'react'
import { Breadcrumbs } from './breadcrumbs'
import { navItems, settingsItem } from './nav'
import { ThemeToggle } from './theme-toggle'

/**
 * The admin chrome: sidebar, topbar, and the outlet between them.
 *
 * The two slots exist because this file is shared-layer and the things that belong in them are
 * features — the notification bell reads the notifications API, the user menu reads auth. Shared
 * code may not reach up into a feature, so the route composes them instead. See
 * `routes/_authed/_shell/route.tsx`, and `packages/frontend-conventions` for the rule.
 */
type ShellProps = {
  /** Rendered at the end of the topbar, after the theme toggle. */
  topbarActions?: ReactNode
  /** Rendered in the sidebar footer. */
  sidebarFooter?: ReactNode
}

export function Shell({ topbarActions, sidebarFooter }: ShellProps) {
  return (
    <TooltipProvider>
      <SidebarProvider>
        <AppSidebar footer={sidebarFooter} />
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

function AppSidebar({ footer }: { footer?: ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname })

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
        <SidebarGroup>
          <SidebarMenu>
            {navItems.map((item) => {
              const isActive = pathname === item.to || pathname.startsWith(`${item.to}/`)

              if (!item.children?.length) {
                return (
                  <SidebarMenuItem key={item.to}>
                    <SidebarMenuButton isActive={isActive} tooltip={item.label} render={<Link to={item.to} />}>
                      {item.icon}
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                  </SidebarMenuItem>
                )
              }

              const isGroupActive =
                isActive || item.children.some((child) => pathname === child.to || pathname.startsWith(`${child.to}/`))

              return (
                <Collapsible key={item.to} open={isGroupActive}>
                  <SidebarMenuItem>
                    <SidebarMenuButton isActive={isActive} tooltip={item.label} render={<Link to={item.to} />}>
                      {item.icon}
                      <span>{item.label}</span>
                    </SidebarMenuButton>
                    <CollapsibleContent>
                      <SidebarMenuSub>
                        {item.children.map((child) => {
                          const isChildActive = pathname === child.to || pathname.startsWith(`${child.to}/`)
                          return (
                            <SidebarMenuSubItem key={child.to}>
                              <SidebarMenuSubButton isActive={isChildActive} render={<Link to={child.to} />}>
                                <span>{child.label}</span>
                              </SidebarMenuSubButton>
                            </SidebarMenuSubItem>
                          )
                        })}
                      </SidebarMenuSub>
                    </CollapsibleContent>
                  </SidebarMenuItem>
                </Collapsible>
              )
            })}
          </SidebarMenu>
        </SidebarGroup>
        <SidebarGroup className="mt-auto">
          <SidebarMenu>
            <SidebarMenuItem>
              <SidebarMenuButton
                isActive={pathname === settingsItem.to || pathname.startsWith(`${settingsItem.to}/`)}
                tooltip={settingsItem.label}
                render={<Link to={settingsItem.to} />}
              >
                {settingsItem.icon}
                <span>{settingsItem.label}</span>
              </SidebarMenuButton>
            </SidebarMenuItem>
          </SidebarMenu>
        </SidebarGroup>
      </SidebarContent>
      <SidebarFooter>{footer}</SidebarFooter>
      <SidebarRail />
    </Sidebar>
  )
}
