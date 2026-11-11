---
name: shopify-sync
description: Apply the catalogue CSV and the structure file to a Shopify store through its admin in Chrome DevTools MCP. Use when the user wants the Shopify store synced, its products imported, or its collections or menu rebuilt from the structure file.
---

# Shopify sync

The store is defined by two versioned files: the product CSV (`apps/backend/scripts/seed/product-import.csv`
unless the user names another) and the structure file (`apps/backend/scripts/seed/catalog-structure.yaml`
unless the user names another). This runbook makes a Shopify store match them by driving its admin
with the Chrome DevTools MCP tools. The admin's language is Spanish; the labels below are its labels.

Work from a fresh `take_snapshot` before every click: element uids change after each navigation,
save and dialog. Snapshot uids reach every control. Many controls sit inside shadow roots, so
`evaluate_script` needs a deep query to find them (walk `element.shadowRoot` recursively). An option
cell's text lives in its slot, so read it from `cell.getRootNode().host.textContent`. Some buttons
expose their name as `textContent` rather than `aria-label`.

## Hard rules

- **Sidekick is off limits.** The admin carries an assistant textbox, "Trabaja con Sidekick". Type
  only into a field you have just identified in a snapshot as the one you mean. If text lands in
  Sidekick, clear it with `fill(uid, '')` and carry on; its "Enviar" button is never pressed.
- **Save with the "Guardar" button** from a fresh snapshot. Cmd+S does nothing.
- **Delete products only when the user asked for it** in this conversation.

## 1. Build the manifest

```bash
pnpm --filter backend exec tsx scripts/shopify/structure-manifest.ts [path/to/estructura.yaml]
```

It prints `{ collections, menu }`:

- `collections[]`: `{ title, handle, rule, unsupported? }`. `rule` is `{ applies: 'all' | 'any', tags }`,
  or `null` for a manual collection. `unsupported` explains a rule Shopify can't express; that
  collection is created manual, and its reason goes in the final report.
- `menu[]`: `{ title, collectionHandle, children }`, nested as the main menu must be.

A non-zero exit prints the structure file's errors; stop and show them to the user.

Done when the manifest JSON is in hand.

## 2. Import the products

The import dialog has no overwrite option: its preview says it will not overwrite existing products
with the same handle. A store that already holds the catalogue keeps its old tags unless those
products are deleted first. Ask the user before deleting.

1. Open `/products`. If the user agreed to delete the old products: tick "Seleccionar todos", open
   the bulk "Acciones" menu, choose "Eliminar productos" and confirm "Eliminar". Deletion runs in the
   background; reload until the empty state ("Agrega tus productos") shows.
2. Click "Importar", upload the CSV with `upload_file` on the "Subir archivo" button, then click the
   dialog's "Subir archivo". Check the preview's product and SKU counts, then click
   "Importar productos".
3. Shopify imports in the background. Reload `/products` until the product count equals the CSV's
   distinct `URL handle` values.

Done when every CSV product is listed.

## 3. Apply the collections

Open `/collections` and list every collection by title. The manifest's titles are unique, so title is
the key; open a collection to read its handle.

- **Absent from the manifest:** list them to the user and delete only those they confirm. "Home page"
  is the theme's default collection; recommend keeping it. Open `/collections/<id>/delete`, wait for
  the dialog "¿Eliminar <title>?", click "Eliminar colección", and wait for the redirect to
  `/collections` before opening the next one.
- **In the manifest and in Shopify:** open it and make its title, handle and tags equal the
  manifest's. Remove a wrong tag with its chip button "Eliminar <tag>", then add the right one in the
  "Valores de etiqueta" combobox.
- **In the manifest only:** create it.

A tag condition holds a list of tag values plus a match type, "Tipo de coincidencia actual: OR" by
default. One condition with all of `rule.tags` and the match type that fits `applies` expresses the
rule: AND for `all`, OR for `any`.

Creating a collection (set the condition before the title; once the title field has focus, typing
lands in it):

1. Open `/collections/new` and wait for "Agregar condición".
2. Click the sidebar's "Agregar condición" (the one marked expandable). The "Buscar atributos"
   search gets focus; type `Etiqueta` and press Enter. The relation shows "incluye"; leave it.
3. Focus the "Valores de etiqueta" combobox. For each tag in `rule.tags`, type it and press Enter.
   Then press Escape.
4. With more than one tag and `applies: 'all'`, open "Tipo de coincidencia actual: OR" and click the
   "AND" cell.
5. Read the product grid; it previews the members. Compare the count with the CSV.
6. For `rule: null`, add no condition and pick products manually instead.
7. Click "Agregar título" and type the manifest `title`. The handle follows the title ("Men › Tops"
   becomes `men-tops`); check it in the search engine listing, and edit it there if it differs from
   the manifest `handle`.
8. Click "Guardar". The page moves to `/collections/<id>`.

Done when `/collections` lists exactly the manifest's titles (plus any extras the user chose to keep),
each with the manifest's handle and conditions.

## 4. Rebuild the main menu

Open `/content/menus` and the main menu.

1. Delete every existing item the manifest doesn't have. A top-level item that already has the
   manifest's label and link can stay. A row's "Eliminar <label>" button only works after you `hover`
   that row's "Mover <label>" handle; click it, then confirm "Eliminar" in the dialog.
2. Add the manifest's items in order. Per item:
   1. Click "Agregar elemento del menú" for a top-level item, or "Agregar elemento del menú a
      <parent>" for a child. The "Etiqueta" field gets focus.
   2. Type the item's `title`, then press Tab to reach "Enlace".
   3. Type the title of the collection whose `handle` is the item's `collectionHandle`. When the
      result list shows the collection, click it. When it shows link categories instead, click
      "Colecciones" first.
   4. Click "Cerrar elemento del menú".
3. A parent shows "Agregar elemento del menú a <parent>" only once it has a child. Nest its first
   child by hand: add it as a top-level item, which lands last. Then use the keyboard:
   1. Focus its "Mover <label>" handle.
   2. Press Space, and press ArrowDown or ArrowUp until it sits right below the parent.
   3. Press ArrowRight, then Space. The live region announces "soltado ... bajo elemento del menú
      <parent>".
   Dragging the handle onto the parent's "Editar <parent>" button also nests it, but only some of
   the time; when it drops at a top-level position instead, use the keyboard.
4. Before saving, list the "Mover" handles: a child's handle sits further right than its parent's.
5. Click "Guardar".

Done when the menu tree equals the manifest's `menu`, item for item and level for level.

## 5. Verify

1. Smart collection counts fill in asynchronously after a save. Reload `/collections` until no count
   is still changing, then compare each count with the number of CSV products whose tags satisfy the
   collection's rule.
2. Open the live storefront and check the header: its links and their nesting follow the menu, and
   each link opens its collection. From a storefront page, `fetch('/collections/<handle>/products.json?limit=250')`
   returns each collection's live members, which checks every count in one script.

Done when every count matches and every header link lands on its collection.

## Report

Tell the user: collections created, updated and deleted; the menu applied; each count mismatch; each
`unsupported` collection with its reason; and anything skipped.
