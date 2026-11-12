// A small design file, shared by the components and DESIGN.md tests: the token half of a snapshot and
// helpers for drawing component layers bound to it.

import type { Layer } from '../components/snapshot.ts'
import type { ComponentsConfig } from '../config.ts'
import type { Snapshot, TextStyle, Variable } from '../tokens/snapshot.ts'

const PRIMITIVES = 'VariableCollectionId:1'
const THEME = 'VariableCollectionId:2'

const rgb = (hex: string) => ({
  r: Number.parseInt(hex.slice(0, 2), 16) / 255,
  g: Number.parseInt(hex.slice(2, 4), 16) / 255,
  b: Number.parseInt(hex.slice(4, 6), 16) / 255,
  a: 1,
})

function primitive(id: string, name: string, value: number | string | ReturnType<typeof rgb>): Variable {
  const resolvedType = typeof value === 'number' ? 'FLOAT' : typeof value === 'string' ? 'STRING' : 'COLOR'
  return {
    id,
    name,
    description: '',
    resolvedType,
    variableCollectionId: PRIMITIVES,
    valuesByMode: { [`${PRIMITIVES}/1`]: value },
  }
}

function role(id: string, name: string, light: string, dark: string): Variable {
  return {
    id,
    name,
    description: '',
    resolvedType: 'COLOR',
    variableCollectionId: THEME,
    valuesByMode: { [`${THEME}/light`]: rgb(light), [`${THEME}/dark`]: rgb(dark) },
  }
}

const variables = [
  primitive('v:font', 'font/sans', 'Manrope'),
  primitive('s:2', 'space/2', 8),
  primitive('s:4', 'space/4', 16),
  primitive('s:6', 'space/6', 24),
  primitive('s:11', 'space/11', 44),
  primitive('r:full', 'radius/full', 9999),
  role('c:ink', 'color/ink', '0d1012', 'f4f5f6'),
  role('c:surface', 'color/surface', 'ffffff', '0d1012'),
  role('c:accent', 'color/accent', '004eba', '7aa9ff'),
  role('c:line', 'color/line', 'dee0e3', '2e3238'),
]

const textStyle = (name: string, size: number, fontStyle: string): TextStyle => ({
  id: `S:${name}`,
  name: `type/${name}`,
  description: '',
  bound: { fontFamily: 'v:font' },
  style: {
    fontFamily: 'Manrope',
    fontStyle,
    fontSize: size,
    case: 'original',
    letterSpacing: { unit: 'percent', value: 0 },
    lineHeight: { unit: 'pixels', value: size * 1.5 },
  },
})

export const tokenSnapshot: Snapshot = {
  collections: {
    [PRIMITIVES]: {
      id: PRIMITIVES,
      name: 'Primitives',
      defaultModeId: `${PRIMITIVES}/1`,
      modes: [{ modeId: `${PRIMITIVES}/1`, name: 'Value' }],
      variableIds: variables.filter((v) => v.variableCollectionId === PRIMITIVES).map((v) => v.id),
    },
    [THEME]: {
      id: THEME,
      name: 'Theme',
      defaultModeId: `${THEME}/light`,
      modes: [
        { modeId: `${THEME}/light`, name: 'Light' },
        { modeId: `${THEME}/dark`, name: 'Dark' },
      ],
      variableIds: variables.filter((v) => v.variableCollectionId === THEME).map((v) => v.id),
    },
  },
  variables: Object.fromEntries(variables.map((v) => [v.id, v])),
  textStyles: [textStyle('heading', 20, 'Bold'), textStyle('body', 16, 'Regular')],
}

export const componentsConfig: ComponentsConfig = {
  root: '/shop/src',
  notExported: { Icon: 'exported by the icons exporter' },
  skippedPages: [],
  notStyledLayers: {},
  runtimeSizes: {},
  runtimeFills: [],
}

/** A solid fill bound to a Theme role. */
export const fill = (roleId: string) => ({
  fills: [{ type: 'solid', color: '#000000' }],
  boundVariables: { fill: roleId },
})

/** An auto-layout frame, padding and gap bound to space tokens. */
export function frame(name: string, mode: 'horizontal' | 'vertical', extra: Partial<Layer> = {}): Layer {
  return { name, type: 'FRAME', layout: { mode, gap: 0, padding: [0, 0, 0, 0], strokesIncluded: true }, ...extra }
}

export function text(name: string, style: 'heading' | 'body', colorId: string, extra: Partial<Layer> = {}): Layer {
  return { name, type: 'TEXT', textStyle: `S:${style}`, ...fill(colorId), ...extra }
}
