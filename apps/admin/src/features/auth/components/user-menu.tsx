import { useLingui } from '@lingui/react/macro'
import {
  Avatar,
  AvatarFallback,
  Badge,
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuGroup,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuRadioGroup,
  DropdownMenuRadioItem,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from '@proteus/ui'
import { EllipsisIcon, LanguagesIcon, LogOutIcon } from 'lucide-react'
import { useLogout, useMe, useUpdateLocale } from '#/features/auth/api/auth'
import { activeLocale } from '#/lib/i18n/locale'

function UserAvatar({ name }: { name: string }) {
  return (
    <Avatar className="size-8 rounded-lg">
      <AvatarFallback className="rounded-lg">{name.charAt(0).toUpperCase()}</AvatarFallback>
    </Avatar>
  )
}

/**
 * The staff member's own Locale, one per sellable market plus `en-US`. Each is named in the language
 * the admin renders in now — `español (Colombia)` for an English reader, `inglés (Estados Unidos)`
 * for a Spanish one — so the list reads as one sentence would.
 */
function LanguageMenu({ locale, locales }: { locale: string; locales: ReadonlyArray<string> }) {
  const { t } = useLingui()
  const updateLocale = useUpdateLocale()
  const names = new Intl.DisplayNames([activeLocale()], { type: 'language' })

  return (
    <DropdownMenuSub>
      <DropdownMenuSubTrigger>
        <LanguagesIcon />
        {t`Language`}
      </DropdownMenuSubTrigger>
      <DropdownMenuSubContent>
        <DropdownMenuRadioGroup
          value={locale}
          onValueChange={(value: string) => {
            if (value !== locale) updateLocale.mutate(value)
          }}
        >
          {locales.map((code) => (
            <DropdownMenuRadioItem key={code} value={code} disabled={updateLocale.isPending}>
              {names.of(code) ?? code}
            </DropdownMenuRadioItem>
          ))}
        </DropdownMenuRadioGroup>
      </DropdownMenuSubContent>
    </DropdownMenuSub>
  )
}

export function UserMenu() {
  const { t } = useLingui()
  const { user, locales } = useMe()
  const logout = useLogout()

  if (!user) return null

  const roleNames = user.roles?.map((r) => r.name) ?? []

  return (
    <SidebarMenu>
      <SidebarMenuItem>
        <DropdownMenu>
          <DropdownMenuTrigger render={<SidebarMenuButton size="lg" />}>
            <UserAvatar name={user.name} />
            <div className="grid flex-1 text-left text-sm leading-tight">
              <span className="truncate font-semibold">{user.name}</span>
              {roleNames.length > 0 && (
                <span className="truncate text-muted-foreground text-xs">{roleNames.join(', ')}</span>
              )}
            </div>
            <EllipsisIcon className="ml-auto size-4" />
          </DropdownMenuTrigger>
          <DropdownMenuContent
            side="top"
            align="start"
            sideOffset={4}
            className="w-(--anchor-width) min-w-56 rounded-lg"
          >
            <DropdownMenuGroup>
              <DropdownMenuLabel className="p-0 font-normal">
                <div className="flex items-center gap-2 px-1 py-1.5 text-left text-sm">
                  <UserAvatar name={user.name} />
                  <div className="grid flex-1 text-left text-sm leading-tight">
                    <span className="truncate font-semibold">{user.name}</span>
                    <span className="truncate text-muted-foreground text-xs">{user.email}</span>
                  </div>
                </div>
                {roleNames.length > 0 && (
                  <div className="flex flex-wrap gap-1 px-1 pb-1.5">
                    {roleNames.map((name) => (
                      <Badge key={name} variant="secondary" className="text-xs">
                        {name}
                      </Badge>
                    ))}
                  </div>
                )}
              </DropdownMenuLabel>
            </DropdownMenuGroup>
            <DropdownMenuSeparator />
            <LanguageMenu locale={user.locale} locales={locales ?? [user.locale]} />
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={logout}>
              <LogOutIcon />
              {t`Log out`}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </SidebarMenuItem>
    </SidebarMenu>
  )
}
