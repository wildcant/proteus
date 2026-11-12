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

It prints `{ metafields, collections, menu }`:

- `metafields[]`: `{ name, namespace, key, type }`, the product metafield definitions the rules read.
  `type` is always `list.single_line_text_field`.
- `collections[]`: `{ title, handle, rule, unsupported? }`. `rule` is
  `{ applies: 'all' | 'any', conditions: [{ metafield, value }] }` (`metafield` is `custom.<key>`),
  or `null` for a manual collection. `unsupported` explains a rule Shopify can't express; that
  collection is created manual, and its reason goes in the final report.
- `menu[]`: `{ title, collectionHandle, children }`, nested as the main menu must be.

A non-zero exit prints the structure file's errors; stop and show them to the user.

Done when the manifest JSON is in hand.

## 2. Create the metafield definitions

The CSV's metafield columns (`Género (product.metafields.custom.genero)`) only import into a
definition that already exists, so create the definitions before the import. A list cell holds one
value per line (a quoted multi-line cell); a comma, `;` or a JSON array imports as one literal value.

Open `/settings/custom_data/product/metafields` (Configuración › Metacampos y metaobjetos ›
Productos). For each manifest `metafields[]` entry whose name is not listed yet, open
`/settings/custom_data/product/metafields/create` and:

1. Click "Nombre" and type the entry's `name`. Shopify suggests standards ("Estándares sugeridos");
   ignore them. Check the button "Espacio de nombres y clave: custom.<key>" reads the manifest key.
2. Click the "Uno" button next to "Tipo" and choose "Lista de valores".
3. Open the "Tipo" combobox and pick "Texto de una sola línea". The type then reads "Lista ·
   Texto de una sola línea".
4. Tick the checkboxes "Activar filtro para la lista de producto en el admin o con la Admin API" and
   "Activar colecciones" (the "Usar como condición en colecciones" option).
5. Click "Guardar". The page moves to `/settings/custom_data/product/metafields/<id>`.

An existing definition whose type is not a single-line text list can't be changed in place; tell the
user rather than deleting it, since deleting it drops its values on every product.

Done when the definitions list shows every manifest name as "Texto de una sola línea".

## 3. Import the products

The import dialog has no overwrite option: its preview says it will not overwrite existing products
with the same handle. A store that already holds the catalogue keeps its old tags and metafields
unless those products are deleted first. Ask the user before deleting.

1. Open `/products`. If the user agreed to delete the old products: tick "Seleccionar todos", open
   the bulk "Acciones" menu, choose "Eliminar productos" and confirm "Eliminar". Deletion runs in the
   background; reload until the empty state ("Agrega tus productos") shows.
2. Click "Importar", upload the CSV with `upload_file` on the "Subir archivo" button, then click the
   dialog's "Subir archivo". Check the preview's product and SKU counts, then click
   "Importar productos".
3. Shopify imports in the background. Reload `/products` until the product count equals the CSV's
   distinct `URL handle` values.

Done when every CSV product is listed. Open one product and check that its Género, Tipo and
Colecciones metafields hold the CSV's values, one per line ("Metacampos del producto" shows each
value as its own chip).

Apply the collections only after the import has finished: a collection saved while products are
still arriving can keep a stale membership (a re-save of its condition fixes it).

## 4. Apply the collections

Open `/collections` and list every collection by title. The manifest's titles are unique, so title is
the key; open a collection to read its handle.

- **Absent from the manifest:** list them to the user and delete only those they confirm. "Home page"
  is the theme's default collection; recommend keeping it. Open `/collections/<id>/delete`, wait for
  the dialog "¿Eliminar <title>?", click "Eliminar colección", and wait for the redirect to
  `/collections` before opening the next one.
- **In the manifest and in Shopify:** open it and make its title, handle and conditions equal the
  manifest's. A collection still on "Etiqueta" conditions gets them removed and replaced by the
  metafield conditions.
- **In the manifest only:** create it.

The collection editor's sidebar holds the conditions. A condition reads "Atributo de condición: <x>",
"es igual a", then its values. `evaluate_script` reaches every control by `aria-label` (deep query
through shadow roots, visible elements only); snapshot uids work too.

- **Point a condition at a metafield:** click its "Atributo de condición: …" button, click the
  "Metacampo" cell, then the metafield's name cell ("Género"). The relation becomes "es igual a" and
  the old values clear. Click the condition's "Agregar" button (the one after that attribute); the
  "Valores de lista de cadenas del metacampo" box gets focus. Type `value` and press Enter.
- **Add a condition:** click the sidebar's "Agregar condición"; it opens the same attribute picker
  directly (no empty row first). Pick "Metacampo" › name, then the new row's "Agregar" and the value.
  Add the new conditions first, then retarget the existing one: retargeting first left the picker
  state confused once.
- **All or any:** with two or more conditions a "Cumplir [todas las | cualquier] condiciones" switch
  appears above them ("Tipo de coincidencia de inclusión"). "todas las" is the default; pick
  "cualquier" for `applies: 'any'`.
- A collection still on "Etiqueta" conditions shows "Valor seleccionado: <tag>" buttons; retargeting
  its first condition to the metafield replaces them.

Creating a collection: open `/collections/new`, set the conditions as above, then click
"Agregar título" and type the manifest `title`. The handle follows the title ("Men › Tops" becomes
`men-tops`); check it in the search engine listing. For `rule: null`, add no condition and pick
products manually. Click "Guardar".

Deleting a collection also removes the menu items that link to it.

Done when `/collections` lists exactly the manifest's titles (plus any extras the user chose to keep),
each with the manifest's handle and conditions.

## 5. Rebuild the main menu

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

## 6. Add the storefront filters

The Search & Discovery app (`/apps/search-and-discovery/filters`) holds the storefront's collection
filters. Its pages render inside an iframe; snapshots reach into it.

Add one filter per manifest `metafields[]` entry with `filter: true`, in manifest order, skipping any
already listed.

1. Open `/apps/search-and-discovery/filters/new`.
2. Click "Seleccionar fuente". A dialog lists the sources, each as a button "<name>, n de m, botón"
   with its kind ("Metacampo de producto", "Opción de producto", or "Brand · Origen: Proveedor ·
   Estándar" for Vendor). Click the entry's name ("Género").
3. "Etiqueta del filtro" fills with the metafield name; keep it. Keep "Condición OR" (a shopper's
   selections widen the list). Click "Guardar".
4. Repeat for every other manifest `metafields[]` entry with `filter: true`, in manifest order. An
   entry with `filter: false` (Colecciones) is not a filter; it only builds collections.

Done when a collection page on the live storefront shows each `filter: true` entry ("Género", "Tipo")
as a separate filter.

## 7. Verify

1. Smart collection counts fill in asynchronously after a save. Reload `/collections` until no count
   is still changing, then compare each count with the number of CSV products whose metafields satisfy
   the collection's rule.
2. Open the live storefront and check the header: its links and their nesting follow the menu, and
   each link opens its collection. From a storefront page, `fetch('/collections/<handle>/products.json?limit=250')`
   returns each collection's live members, which checks every count in one script.

Done when every count matches and every header link lands on its collection.

## Report

Tell the user: metafield definitions created; collections created, updated and deleted; the menu applied; the filters added; each count mismatch; each
`unsupported` collection with its reason; and anything skipped.
