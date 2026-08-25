import type { ForwardRefExoticComponent, RefAttributes, SVGProps } from 'react'

/**
 * The SVG elements an icon node may contain. Brand marks from simple-icons are single `path`
 * elements today; the rest are here so a future asset with a gradient or clip mask does not
 * require touching the generator.
 */
export type SVGElementType =
  | 'circle'
  | 'clipPath'
  | 'defs'
  | 'ellipse'
  | 'g'
  | 'line'
  | 'linearGradient'
  | 'mask'
  | 'path'
  | 'polygon'
  | 'polyline'
  | 'radialGradient'
  | 'rect'
  | 'stop'
  | 'use'

export type IconNode = [tag: SVGElementType, attributes: Record<string, string>, children?: IconNode][]

export type IconProps = Omit<SVGProps<SVGSVGElement>, 'ref'> & {
  size?: string | number
  /**
   * Accessible name. Supplying it renders a `<title>` and drops the default `aria-hidden`, which
   * turns a decorative mark into one screen readers announce.
   */
  title?: string
}

export type Icon = ForwardRefExoticComponent<IconProps & RefAttributes<SVGSVGElement>>
