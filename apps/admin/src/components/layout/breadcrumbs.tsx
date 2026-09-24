import { useLingui } from '@lingui/react'
import {
  Breadcrumb,
  BreadcrumbItem,
  BreadcrumbLink,
  BreadcrumbList,
  BreadcrumbPage,
  BreadcrumbSeparator,
} from '@proteus/ui'
import { Link, useMatches } from '@tanstack/react-router'
import { Fragment } from 'react'

export function Breadcrumbs() {
  const matches = useMatches()
  const { i18n } = useLingui()

  const crumbs = matches
    .filter((m) => m.staticData?.breadcrumb || (m.context as Record<string, unknown>)?.breadcrumb)
    .map((m) => ({
      // A context crumb is a record's own name, shown as stored; a static one is admin copy.
      label:
        ((m.context as Record<string, unknown>)?.breadcrumb as string) ??
        (m.staticData?.breadcrumb ? i18n._(m.staticData.breadcrumb) : ''),
      path: m.pathname,
    }))
    // Context propagates from parent to child — deduplicate consecutive crumbs
    // that share the same label (e.g. layout route + its index route).
    .filter((crumb, i, arr) => i === 0 || crumb.label !== arr[i - 1]?.label)

  if (crumbs.length === 0) return null

  return (
    <Breadcrumb>
      <BreadcrumbList>
        {crumbs.map((crumb, i) => {
          const isLast = i === crumbs.length - 1
          return (
            <Fragment key={crumb.path}>
              {i > 0 && <BreadcrumbSeparator />}
              <BreadcrumbItem>
                {isLast ? (
                  <BreadcrumbPage>{crumb.label}</BreadcrumbPage>
                ) : (
                  <BreadcrumbLink render={<Link to={crumb.path as '/'} />}>{crumb.label}</BreadcrumbLink>
                )}
              </BreadcrumbItem>
            </Fragment>
          )
        })}
      </BreadcrumbList>
    </Breadcrumb>
  )
}
