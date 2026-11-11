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
save and dialog.

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

1. Open `/products`. If the user asked to delete the old products: select all, choose
   "Eliminar productos" from the bulk actions, confirm, and wait until the list is empty.
2. Click "Importar", upload the CSV with `upload_file`, tick the overwrite option so products with
   the same handle are replaced, then start the import and confirm.
3. Shopify imports in the background and reports by email and a banner. Reload `/products` until
   the product count equals the CSV's distinct `URL handle` values.

Done when every CSV product is listed.

## 3. Apply the collections

Open `/collections` and list every collection by title. The manifest's titles are unique, so title is
the key; open a collection to read its handle.

- **Absent from the manifest:** list them to the user and delete only those they confirm. Delete at
  `/collections/<id>/delete`, then confirm "Eliminar colección".
- **In the manifest and in Shopify:** open it and make its title, handle, conditions and match type
  equal the manifest's.
- **In the manifest only:** create it.

Creating a collection:

1. Open `/collections/new`.
2. Click "Agregar título", then type the manifest `title`.
3. For a `rule`, keep the automated type, and for each tag in `rule.tags`:
   1. Click "Agregar condición" in the sidebar.
   2. Type `Etiqueta`, press Enter. The relation shows "incluye"; leave it.
   3. Press Tab three times to reach the tag value combobox.
   4. Type the tag, press Enter, then Escape.
4. With more than one condition, set "Tipo de coincidencia" to all for `applies: 'all'` and to any for
   `applies: 'any'`.
5. For `rule: null`, choose the manual type and add no condition.
6. Set the URL handle in the search engine listing section to the manifest `handle`.
7. Click "Guardar".

Done when `/collections` lists exactly the manifest's titles (plus any extras the user chose to keep),
each with the manifest's handle and conditions.

## 4. Rebuild the main menu

Open `/content/menus` and the main menu.

1. Delete every existing item. A row's delete button only works after you `hover` that row; click it,
   then confirm "Eliminar".
2. Add the manifest's items in order, nesting each `children` entry under its parent. Per item:
   1. Click "Agregar elemento del menú" (the parent's own one for a child).
   2. Type the item's `title` as the label.
   3. Click the "Enlace" field, type the collection's manifest title (the one whose `handle` is the
      item's `collectionHandle`), click the "Colecciones (n)" gridcell, then the collection.
   4. A link to every collection is "Todas las colecciones", which points at `/collections`.
3. Click "Guardar".

Done when the menu tree equals the manifest's `menu`, item for item and level for level.

## 5. Verify

1. Smart collection counts fill in asynchronously after a save. Reload `/collections` until no count
   is still changing, then compare each count with the number of CSV products whose tags satisfy the
   collection's rule.
2. Open the live storefront and check the header: its links and their nesting follow the menu, and
   each link opens its collection.

Done when every count matches and every header link lands on its collection.

## Report

Tell the user: collections created, updated and deleted; the menu applied; each count mismatch; each
`unsupported` collection with its reason; and anything skipped.
