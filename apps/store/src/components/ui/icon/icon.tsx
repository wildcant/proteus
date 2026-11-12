import { cn } from '@proteus/ui-core'
import { cloneElement, type SVGProps } from 'react'
import { glyphs, type IconName } from './icon.glyphs'

type IconProps = Omit<SVGProps<SVGSVGElement>, 'name'> & {
  name: IconName
  size?: number | string
}

/** An explicit `aria-*` or `role` from the caller means the icon is not decorative. */
const hasA11yProp = (props: object) => Object.keys(props).some((prop) => prop.startsWith('aria-') || prop === 'role')

/**
 * A glyph of the design file's Icon set in its 24 × 24 frame, coloured by the text colour. Each glyph
 * carries its own paint — a stroke and its width, or a fill — so the frame paints nothing: a stroke on
 * the frame would outline a filled glyph. A caller's `strokeWidth` is set on the glyph.
 */
export function Icon({ name, size = 24, strokeWidth, className, ...props }: IconProps) {
  const glyph = glyphs[name]

  return (
    // biome-ignore lint/a11y/noSvgWithoutTitle: decorative by default (aria-hidden); a meaningful icon takes the caller's aria-label.
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={size}
      height={size}
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden={hasA11yProp(props) ? undefined : true}
      className={cn(className)}
      {...props}
    >
      {strokeWidth === undefined ? glyph : cloneElement(glyph, { strokeWidth })}
    </svg>
  )
}
