import { dateToIso } from '@proteus/http-schemas/common'
import { i18n } from '@proteus/utils'
import { z } from 'zod'

/** Backend-only: no storefront form shares it, so it lives beside the route that reads it. */
export const FixtureCreateNoteBody = z
  .object({
    title: z.string().min(3, i18n.t('A fixture note needs a title of at least three characters')),
    coreProductId: z.string().nullish(),
  })
  .openapi('FixtureCreateNoteBody')

const FixtureNote = z
  .object({
    id: z.string(),
    title: z.string(),
    coreProductId: z.string().nullable(),
    createdAt: dateToIso,
  })
  .openapi('FixtureNote')

export const FixtureNoteResponse = z.object({ note: FixtureNote }).openapi('FixtureNoteResponse')

export const FixtureNoteListResponse = z.object({ notes: z.array(FixtureNote) }).openapi('FixtureNoteListResponse')

export const FixtureNoteParams = z.object({ id: z.string() })
