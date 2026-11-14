# 36. The Structure File Has English Keys

The structure file (`catalog-structure.yaml`) is the store's catalogue written as YAML: its fields,
Categories, Collections, menu, search and filters. Its keys were Spanish — `campos`,
`categorias`, `nombre`, `clave`, `regla`, `hijos`, `filtro` — because the first store written with it
was Spanish-speaking. The keys are now English (`fields`, `categories`, `name`, `key`, `rule`,
`children`, `filterable`), and the parser accepts no Spanish alias. The values stay in the shop's own
language: a Category is still `name: Hombre` in a Colombian store, a field key still `genero`.

The keys are the file's grammar, which Proteus owns and documents; the values are the shop's data.
Every other name Proteus gives — code, API fields, error paths, admin copy — is English, so a key in
another language was the one place a reader had to translate between the file and the code that reads
it, and every new key (`search`, `filters`) would have had to pick a side.

## Considered Options

**Keep the Spanish keys.** Rejected: it ties Proteus's grammar to one store's language, and a store in
any other language would read keys it does not speak.

**Accept English aliases beside the Spanish keys.** Rejected: two spellings of every key double what
the parser validates and what its errors name, and a file could mix them. There are no production
files to keep working (pre-release, one store), so the cost of a clean break is one migration of that
store's file.

## Consequences

- **Breaking for existing files.** A file with Spanish keys is refused key by key ("Unrecognized key"),
  so it is migrated once, by renaming its keys; no value changes.
- **Error paths are English** (`categories[0].children[1].handle`), as the admin preview shows them.
- **Key names follow the code's casing**, camelCase where a key has two words (`groupBy`).
