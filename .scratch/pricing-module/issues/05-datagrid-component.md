# 05 — DataGrid component

**What to build:** A standalone spreadsheet-style editable grid component for the admin app. The DataGrid is reused in at least two places: the variant price edit modal (ticket #6) and the create product form's variants step (future work). It should feel like a lightweight spreadsheet — click a cell to edit, tab/arrow keys to navigate, currency cells show a symbol prefix.

Research Medusa's DataGrid implementation as a reference for API design and UX patterns. Key reference file: `packages/admin/dashboard/src/routes/products/product-prices/pricing-edit.tsx` in the Medusa source.

Create the component at `apps/admin/src/components/data-grid/`.

Suggested column definition API:

```typescript
type DataGridColumn<T> = {
  header: string
  accessorKey: keyof T & string
  type: 'text' | 'checkbox' | 'currency'
  currencyCode?: string  // required when type is 'currency'
}
```

**Blocked by:** None — can start immediately.

**Status:** ready-for-agent

- [ ] DataGrid component created at `apps/admin/src/components/data-grid/`
- [ ] Supports column definitions with typed cell renderers: text (editable), checkbox, currency (editable with currency symbol prefix)
- [ ] Keyboard navigation: arrow keys move between cells, Tab moves forward, Enter activates edit mode, Escape cancels
- [ ] Controlled via a data array and an onChange callback (form-friendly — works with TanStack Form)
- [ ] Currency columns accept a currency code and display the appropriate symbol
- [ ] Renders cleanly in a `RouteFocusModal` context (full viewport)
- [ ] Visual style consistent with the existing admin design system (@proteus/ui)
