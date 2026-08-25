import { createElement, forwardRef, type ReactNode } from 'react'
import { defaultAttributes } from './default-attributes.ts'
import type { Icon, IconNode, IconProps } from './types.ts'

/** An explicit `aria-*` or `role` from the caller means the mark is not decorative. */
const hasA11yProp = (props: object) => Object.keys(props).some((prop) => prop.startsWith('aria-') || prop === 'role')

const renderNode = (key: string, [tag, attributes, children]: IconNode[number]): ReactNode =>
  createElement(
    tag,
    { key, ...attributes },
    children?.map((child, index) => renderNode(`${key}-${index}`, child)),
  )

/**
 * Build an icon component from a generated icon node. One implementation backs every mark, so
 * sizing and the a11y default are decided in a single place rather than in generated files.
 */
export const createIcon = (iconName: string, iconNode: IconNode): Icon => {
  const Component = forwardRef<SVGSVGElement, IconProps>(({ size = 24, title, children, ...rest }, ref) =>
    createElement(
      'svg',
      {
        ref,
        ...defaultAttributes,
        width: size,
        height: size,
        ...(!title && !hasA11yProp(rest) && { 'aria-hidden': 'true' }),
        ...rest,
      },
      [
        title ? createElement('title', { key: 'title' }, title) : null,
        ...iconNode.map((node, index) => renderNode(`${iconName}-${index}`, node)),
        children,
      ],
    ),
  )

  Component.displayName = iconName

  return Component
}
