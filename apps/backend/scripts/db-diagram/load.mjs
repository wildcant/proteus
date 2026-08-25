/**
 * biome-ignore-all lint/style/useNamingConvention: ChartDB's IndexedDB records and the Postgres
 * identifiers they carry are snake_case; renaming them would break the diagram.
 * biome-ignore-all lint/suspicious/noConsole: a CLI script; stdout is how it reports progress.
 */

// Drives ChartDB through its import dialog, then rewrites the diagram's layout so tables are
// grouped into one labelled area per module, with the link module centred.
//
// ChartDB is a static SPA — no server, no API — so a diagram only exists inside a browser's
// IndexedDB. That is why this needs a browser at all: it runs a persistent Chromium profile
// under tmp/, separate from your everyday Chrome.
//
// Invoked by run.sh; see there for the surrounding flow.

import { execFileSync, spawn } from 'node:child_process'
import { readFileSync } from 'node:fs'
import { dirname, resolve } from 'node:path'
import { fileURLToPath } from 'node:url'
import { chromium } from '@playwright/test'

const HERE = dirname(fileURLToPath(import.meta.url))
const BACKEND = resolve(HERE, '../..')

const [, , metadataPath, url, profileDir] = process.argv

// A table's rendered height is exactly 32px per visible field plus 48px of chrome, and ChartDB
// stops at 11 visible fields. Measured against every table in the diagram — do not switch this
// back to reading the DOM: react-flow virtualises offscreen nodes, so most reads come back wrong.
const FIELD_ROW = 32
const VISIBLE_FIELD_CAP = 11
const TABLE_CHROME = 48
const TABLE_WIDTH = 224

const COLORS = {
  product: '#b067e9',
  cart: '#8eb7ff',
  order: '#ff9f5a',
  payment: '#5ad19a',
  fulfillment: '#ffd166',
  inventory: '#6ee7d5',
  pricing: '#f2789f',
  customer: '#a3e635',
  auth: '#c084fc',
  user: '#94a3b8',
  notification: '#fb7185',
  link: '#e879f9',
}

// link at the centre, the modules its tables actually join around it, the rest pushed outward
const GRID = [
  [['product'], ['order'], ['payment']],
  [['inventory', 'pricing'], ['link'], ['cart', 'fulfillment']],
  [['auth'], ['user', 'customer'], ['notification']],
]

/** Which module owns each table, read from the source rather than hardcoded. */
const ownership = () => {
  const files = execFileSync(
    'sh',
    ['-c', `ls ${BACKEND}/src/modules/*/models/*.ts ${BACKEND}/src/link-modules/definitions/*.ts`],
    { encoding: 'utf8' },
  )
    .trim()
    .split('\n')

  const owners = {}
  for (const file of files) {
    const module = file.includes('/link-modules/') ? 'link' : file.match(/modules\/([^/]+)\//)?.[1]
    if (!module) continue
    for (const [, table] of readFileSync(file, 'utf8').matchAll(/pgTable\(\s*'([a-z_]+)'/g)) {
      owners[table] = module
    }
  }
  return owners
}

const main = async () => {
  const metadata = readFileSync(metadataPath, 'utf8')
  const owners = ownership()
  console.log(`  ${Object.keys(owners).length} tables mapped across ${new Set(Object.values(owners)).size} modules`)

  // headless for the automation; the finished diagram is handed back in a detached window below
  const browser = await chromium.launchPersistentContext(profileDir, {
    headless: true,
    viewport: { width: 1600, height: 1000 },
    permissions: ['clipboard-read', 'clipboard-write'],
  })
  const page = browser.pages()[0] ?? (await browser.newPage())
  await page.goto(url)

  // run.sh wipes the profile first, so ChartDB always opens on its first-run database picker
  const picker = page.locator('[role=radio]').filter({ has: page.locator('img[alt="PostgreSQL"]') })
  await picker.waitFor({ timeout: 30_000 })
  await picker.click()

  // older builds gate the next step behind Continue; newer ones skip straight past it
  const advance = page.getByRole('button', { name: 'Continue' })
  if (await advance.isEnabled({ timeout: 3_000 }).catch(() => false)) await advance.click()

  // Paste through the clipboard: filling a 273KB value into Monaco synthetically stalls it,
  // whereas a real paste is the path the editor is built for. Click the editor surface rather
  // than its hidden textarea, which the rendered .view-line elements sit on top of.
  await page.evaluate((text) => navigator.clipboard.writeText(text), metadata)
  await page.locator('.monaco-editor').last().click()
  await page.keyboard.press('ControlOrMeta+v')
  await page
    .getByRole('button', { name: 'Import', exact: true })
    .and(page.locator('button:not([disabled])'))
    .waitFor({ timeout: 60_000 })
  await page.getByRole('button', { name: 'Import', exact: true }).click({ timeout: 60_000 })

  // The picker opens with every schema ticked — bullmq and drizzle included. Clearing first is
  // what makes the "Select all <n>" button appear; it only shows when a filter is narrowing an
  // empty selection, so the order here matters.
  await page.getByRole('button', { name: 'Clear selection' }).click()
  await page.getByPlaceholder('Search tables...').fill('public.')
  await page.getByRole('button', { name: /^Select all/ }).click()
  await page.getByRole('button', { name: /^Import \d+ Tables$/ }).click()
  await page.waitForFunction(() => document.querySelectorAll('.react-flow__node-table').length > 0, { timeout: 60_000 })

  const report = await page.evaluate(applyLayout, {
    owners,
    colors: COLORS,
    grid: GRID,
    metrics: { FIELD_ROW, VISIBLE_FIELD_CAP, TABLE_CHROME, TABLE_WIDTH },
  })

  if (report.overlaps.length || report.escaped.length) {
    console.error(
      `error: layout is unsound — overlaps ${JSON.stringify(report.overlaps)}, escaped ${JSON.stringify(report.escaped)}`,
    )
    await browser.close()
    process.exit(1)
  }

  const diagramUrl = page.url()
  await browser.close()
  console.log(`  laid out ${report.tables} tables into ${report.areas} module areas, link centred`)

  // Release the profile lock first, then reopen it detached so the shell returns. Same binary
  // that just wrote the profile, so there is no version mismatch to migrate.
  const viewer = spawn(chromium.executablePath(), [`--user-data-dir=${profileDir}`, '--no-first-run', diagramUrl], {
    detached: true,
    stdio: 'ignore',
  })
  viewer.unref()
  console.log(`  opened ${diagramUrl}`)
}

/** Runs in the page: regroups the imported diagram and writes it back to IndexedDB. */
function applyLayout({ owners, colors, grid, metrics }) {
  const { FIELD_ROW, VISIBLE_FIELD_CAP, TABLE_CHROME, TABLE_WIDTH: W } = metrics
  const GAP = 40
  const PAD = 36
  const HEAD = 64
  const CELL_GAP = 200
  const STACK_GAP = 120
  const heightOf = (table) => FIELD_ROW * Math.min(table.fields.length, VISIBLE_FIELD_CAP) + TABLE_CHROME

  /** One block per module: its tables in a square-ish grid, and the size that implies. */
  function sizeBlocks(tables) {
    const groups = {}
    for (const table of tables) {
      const module = owners[table.name] ?? 'other'
      groups[module] = groups[module] ?? []
      groups[module].push(table)
    }

    const blocks = {}
    for (const [module, items] of Object.entries(groups)) {
      items.sort((a, b) => a.name.localeCompare(b.name))
      const columns = Math.min(4, Math.ceil(Math.sqrt(items.length)))
      const rows = []
      for (let i = 0; i < items.length; i += columns) rows.push(items.slice(i, i + columns))
      const rowHeights = rows.map((row) => Math.max(...row.map(heightOf)))
      blocks[module] = {
        module,
        items,
        rows,
        rowHeights,
        width: columns * W + (columns - 1) * GAP + PAD * 2,
        height: rowHeights.reduce((a, b) => a + b, 0) + (rows.length - 1) * GAP + HEAD + PAD,
      }
    }
    return blocks
  }

  /** Position every block on the macro grid, then its tables inside it. Returns the areas. */
  function placeBlocks(blocks, diagramId) {
    const cells = grid.map((row) => row.map((cell) => cell.filter((module) => blocks[module])))
    const widthOf = (cell) => (cell.length ? Math.max(...cell.map((m) => blocks[m].width)) : 0)
    const stackOf = (cell) =>
      cell.reduce((sum, m) => sum + blocks[m].height, 0) + Math.max(0, cell.length - 1) * STACK_GAP

    const columnWidths = cells[0].map((_, c) => Math.max(...cells.map((row) => widthOf(row[c]))))
    const rowHeights = cells.map((row) => Math.max(...row.map(stackOf)))
    const columnX = []
    const rowY = []
    columnWidths.reduce((x, width, c) => {
      columnX[c] = x
      return x + width + CELL_GAP
    }, 0)
    rowHeights.reduce((y, height, r) => {
      rowY[r] = y
      return y + height + CELL_GAP
    }, 0)

    const areas = []
    for (const [r, row] of cells.entries()) {
      for (const [c, cell] of row.entries()) {
        let y = rowY[r] + (rowHeights[r] - stackOf(cell)) / 2
        for (const module of cell) {
          const block = blocks[module]
          block.x = columnX[c] + (columnWidths[c] - block.width) / 2
          block.y = y
          y += block.height + STACK_GAP
          layTables(block)
          areas.push({
            id: `area_${module}`,
            name: module,
            x: block.x,
            y: block.y,
            width: block.width,
            height: block.height,
            color: colors[module] ?? '#64748b',
            diagramId,
          })
        }
      }
    }
    return areas
  }

  function layTables(block) {
    let y = block.y + HEAD
    for (const [r, row] of block.rows.entries()) {
      for (const [c, table] of row.entries()) {
        table.x = block.x + PAD + c * (W + GAP)
        table.y = y
      }
      y += block.rowHeights[r] + GAP
    }
  }

  /** Never trust the arithmetic: no block may collide, no table may leave its area. */
  function findFaults(blocks) {
    const placed = Object.values(blocks).filter((block) => block.x !== undefined)
    const overlaps = []
    for (const [i, a] of placed.entries()) {
      for (const b of placed.slice(i + 1)) {
        const hit = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height
        if (hit) overlaps.push(`${a.module}/${b.module}`)
      }
    }
    const escaped = []
    for (const block of placed) {
      for (const table of block.items) {
        const inside =
          table.x >= block.x &&
          table.x + W <= block.x + block.width &&
          table.y >= block.y &&
          table.y + heightOf(table) <= block.y + block.height
        if (!inside) escaped.push(table.name)
      }
    }
    return { overlaps, escaped }
  }

  const openDb = () =>
    new Promise((res, rej) => {
      const request = indexedDB.open('ChartDB')
      request.onsuccess = () => res(request.result)
      request.onerror = () => rej(request.error)
    })

  const readTables = (db) =>
    new Promise((res, rej) => {
      const request = db.transaction('db_tables', 'readonly').objectStore('db_tables').getAll()
      request.onsuccess = () => res(request.result)
      request.onerror = () => rej(request.error)
    })

  const commit = (db, tables, areas) =>
    new Promise((res, rej) => {
      const transaction = db.transaction(['db_tables', 'areas'], 'readwrite')
      const tableStore = transaction.objectStore('db_tables')
      const areaStore = transaction.objectStore('areas')
      for (const table of tables) tableStore.put({ ...table, color: colors[owners[table.name]] ?? table.color })
      areaStore.clear()
      for (const area of areas) areaStore.put(area)
      transaction.oncomplete = () => res()
      transaction.onerror = () => rej(transaction.error)
    })

  return openDb().then(async (db) => {
    const tables = await readTables(db)
    const blocks = sizeBlocks(tables)
    const areas = placeBlocks(blocks, tables[0].diagramId)
    const faults = findFaults(blocks)
    if (faults.overlaps.length || faults.escaped.length) return { ...faults, tables: 0, areas: 0 }
    await commit(db, tables, areas)
    return { ...faults, tables: tables.length, areas: areas.length }
  })
}

main().catch((error) => {
  console.error(`error: ${error.message}`)
  process.exit(1)
})
