import { test } from '@tests/setup/test-extend.js'
import { parseSublineTemplate, renderSubline } from '../card-subline.js'

const render = (template: string, values: Record<string, string[]>, listSeparator = ', ') => {
  const parsed = parseSublineTemplate(template)
  if ('error' in parsed) throw new Error(parsed.error)
  return renderSubline(parsed.template, (key) => values[key] ?? [], listSeparator)
}

test.describe('renderSubline', () => {
  test('fills each placeholder, lower-cases on |lower and joins a field’s values with the separator', ({ expect }) => {
    const template = '{type} para {genero|lower} · {estilo}'
    expect(render(template, { type: ['Zapatillas'], genero: ['Mujer'], estilo: ['Clásicos'] })).toBe(
      'Zapatillas para mujer · Clásicos',
    )
    expect(render(template, { type: ['Zapatillas'], genero: ['Hombre', 'Mujer'], estilo: ['Clásicos'] }, ' y ')).toBe(
      'Zapatillas para hombre y mujer · Clásicos',
    )
  })

  test('drops a segment with an empty placeholder, and gives null when none is left', ({ expect }) => {
    const template = '{type} para {genero|lower} · {estilo} · {brand}'
    // No gender: "Zapatillas para" goes whole, and the separators close up.
    expect(render(template, { type: ['Zapatillas'], estilo: ['Clásicos'], brand: ['Nike'] })).toBe('Clásicos · Nike')
    expect(render(template, { type: ['Zapatillas'], genero: ['Mujer'] })).toBe('Zapatillas para mujer')
    expect(render(template, {})).toBeNull()
  })
})
