/** The admin list endpoints' ceiling on `limit`, which is also the page a walk reads at a time. */
const MAX_PAGE_SIZE = 100

type PageRange = { offset: number; limit: number }

/**
 * Every row of a paginated list, read page by page until `count` is reached. For the small sets a
 * form offers whole — a shop's Types, Tags and Collections, a group's member ids — which are a
 * request or two.
 */
export async function listEveryPage<TPage extends { count: number }, TRow>(
  readPage: (range: PageRange) => Promise<TPage>,
  rowsOf: (page: TPage) => TRow[],
): Promise<TRow[]> {
  const rows: TRow[] = []
  for (let offset = 0; ; offset += MAX_PAGE_SIZE) {
    const page = await readPage({ offset, limit: MAX_PAGE_SIZE })
    rows.push(...rowsOf(page))
    if (offset + MAX_PAGE_SIZE >= page.count) return rows
  }
}
