# Driving FigCraft

How an agent works in the Proteus FigCraft file. For what to draw, see `brand-rules.md` and `DESIGN.md`; for when it is done, `checklist.md`.

## The file and the servers

- **`~/designs/proteus/Proteus.figcraft`: the source of truth.** Every design change goes here. Pages (each created only when its first set needs it):
  - `Foundation`: the colour and type boards. Don't draw here.
  - `flows`: the navigation map, one section per flow (see "Flows: arrows and events").
  - `app/_main`, `app/_main/_authed`, `app/_auth`, `app/_checkout`: screen sets, mirroring the route groups in `apps/store/src/routes/`.
  - `components/ui`, `components/store`, `entities/<entity>`, `features/<feature>`: component sets, mirroring the code folders. The table and the rules are in `.claude/agents/designer.md`, "Structure mirrors the code".
  - `brand`: the favicon and touch icons (sections `sources`, `export`, `preview`); see `brand-marks.md`.
- FigCraft reads and writes only under `~/designs`. Backups, screenshots and the plan file live there too; nothing design-side goes into the repo except the exporters' committed snapshots.
- Machine paths (the design file, the CLI binary) live only in `packages/design/design.local.json`, which is gitignored. The committed `design.json` holds none.
- Variables: collection `Primitives` (mode `Value`: `palette/neutral|blue|red|green/*`, `font/sans`), collection `Theme` (flat `color/*` roles, modes `Light` and `Dark`), collection `Viewport` (modes `Mobile` and `Desktop`: `type/display|title|heading/size`). There are no `space/*` or `radius/*` variables yet: spacing is Tailwind's 4 px scale and the radius is 0. Roles and values: `colour.md`.
- Text styles: `type/display`, `type/title`, `type/heading`. Each style's description gives its use. Body (14 px) and meta (12 px) have no style yet.
- Fonts: Manrope (`~/designs/proteus/fonts/`).
- Two MCP servers run the same engine:
  - `figcraft-app` drives the running app (`~/bin/figcraft-app`, port 7979). Use this one for every drawing: the owner watches the canvas.
  - `figcraft` runs headless, without a window. Only for read-only checks of a saved file; never for design work.
- Exports run through FigCraft's headless CLI, not through either MCP server: `@proteus/design`'s `--export` scripts call `figcraft-cli run <steps.jsonl> --in <file>` with read roots on the file's folder (`packages/design/src/figcraft.ts`). They read only the saved file.
- The tools are deferred in Claude Code: load the ones you need with one ToolSearch call, e.g. `select:mcp__figcraft-app__inspect_document,mcp__figcraft-app__get_node,mcp__figcraft-app__create_node,mcp__figcraft-app__set_properties,mcp__figcraft-app__run_command,mcp__figcraft-app__batch,mcp__figcraft-app__list_commands,mcp__figcraft-app__screenshot,mcp__figcraft-app__save_file,mcp__figcraft-app__open_file`.

## Safety

- Back up before the first change: `mkdir -p ~/designs/proteus/backups && cp ~/designs/proteus/Proteus.figcraft ~/designs/proteus/backups/"Proteus $(date +%Y-%m-%d-%H%M).figcraft"`.
- **Open the file, then list and select the page, before every write.** Other sessions share the app and can bring another file to the front, and FigCraft creates layers on the current page, which is whatever page was showing last. So before each write: `open_file` on `Proteus.figcraft`, check `inspect_document` (`name`, `path`), `page.list`, `page.select {id}`, and confirm `currentPage` at depth 1.
- Start every `batch` with a step that only succeeds in Proteus, such as `variable.update` on `palette/blue/700` with its current value (#004EBA), so a batch can never land in the wrong file.
- Others may edit the file while you work. Read the undo history in `inspect_document` before you save; leave changes that aren't yours alone and mention them in your report.
- `undo` / `redo` step through history; a `batch` is one undo step. `file.saveVersion {name}` snapshots the document before a risky change.
- Delete only by exact id, never by matching names.
- **Save with `save_file` after every step**: the wrapper, each filled section, each component, each fix batch. The app can close or reload the file from disk mid-task, and unsaved work is lost.
- If a save fails, stop and report it; don't keep drawing on top of unsaved work.

## Reading

- `inspect_document` gives pages, styles, variable count, history and the current page's tree. Start with `depth: 1` or `2`; `app/*` and `flows` pages grow large.
- `get_node {id, depth}` reads one subtree deeply: fills, `boundVariables`, layout, sizing, text style, component links, overrides. This is the structural check. Pass `maxBytes` on big frames and read deeper one child at a time.
- `variable.list`, `style.list`, `component.list` (through `run_command`) before creating anything.
- `screenshot` with no ids renders the page with its background. With `ids` it renders those layers on white, which misjudges dark surfaces: use it for layout, not colour.
- Command docs: `list_commands {filter}` (e.g. `component`, `variable`, `layout`, `instance`), or the resource `figcraft://command/<id>` for one command. Read them instead of guessing parameters.

## Writing

- `create_node {type, parent, name, props}` makes one layer; `props` takes any `set_properties` key (`layout`, `gap`, `padding`, `sizingH`, `fill`, ...). x and y are relative to the parent; inside an auto-layout frame the layout places the child.
- `set_properties {ids, props}` changes layers.
- `run_command {command, params}` runs any command.
- `batch {commands, label}` runs several commands as one undo step and rolls all of them back if one fails. Name a step with `"as": "row"` and refer to its id later with `{"$ref": "row"}` (`"field": "ids/0"` for another part of its result). Use it for each section of a frame, with the Proteus guard step first.

## Commands by task

| Task | Commands |
|---|---|
| Screen state | `frame.create {preset, name}` (`frame.presets` lists them), then a variant of the screen set (see "Screen sets") |
| Auto layout | `set_properties` with `layout`, `gap`, `padding`, `mainAlign`, `crossAlign`, `sizingH`, `sizingV`; `layout.add` / `layout.remove` |
| Bind a token | `variable.bind {ids, field, variable}`; fields `fill`, `stroke`, `fills/<i>/color`, `gap`, `paddingHorizontal`, `cornerRadius`, `width`, `height`, `opacity`, ... |
| Set a mode on a frame | the frame's `Theme` mode (`Light`, `Dark`) and `Viewport` mode (`Mobile`, `Desktop`); find the command with `list_commands {filter: "mode"}` |
| Text style | `style.apply {ids, style: "type/heading"}` |
| Use a component | `instance.create {component, parent}`; `instance.setProperties {ids, properties}` for variants, text and booleans; `instance.swap`; `instance.slotInsert` for slots |
| Make a component | `component.create`, `component.addProperty`, `component.bindProperty`, `component.combineVariants`, `component.addVariant` |
| Try a component | `component.playground {id, properties, language: "react"}` renders a copy with those props and its code, without changing the document |
| Duplicate, move | `edit.duplicate`, `node.reparent`, `node.reorder`, `object.rename` |
| Notes for handoff | `annotation.add {id, label, properties, category}` |
| Icons, marks | `file.import` an SVG, `vector.flatten` on the child ids; `node.create` with a vector `path` |

## Gotchas

Carried over from the sibling project's sessions on the same engine; each cost time once.

- New layers go to the current page, and opening a file shows the page that was open last. Create every layer with a `parent` (the flow's section, a frame or a component set).
- **Renaming a component, or adding or removing layers in it, breaks the scaled instances made before the change**: they render without their content. After such a change, screenshot every scaled instance of it and recreate the broken ones.
- `node.create` for a `vector` with a `path`: the given x/y is added to the path's own left/top. Pass the path in local coordinates and x/y = 0, or fix the position with `node.set` afterwards.
- `edit.duplicate` with several ids returns the copies sorted by id, not in the order you passed. Duplicate one id per command when each copy needs its own name or styling.
- `node.reparent` with several ids keeps their current stacking order. To set the order in an auto-layout frame, reparent one id per command, in the order you want.
- A text range can't hold a bound variable (`text.style` `textFills` stores a raw colour), so it won't follow a mode change. Build a two-colour line from two text layers.
- A paint's own opacity survives `variable.bind`: `fills: [{color, opacity: 0.8}]`, then bind `fills/0/color`, keeps the 80 % (the drawer scrim). List indices count from the bottom paint.
- Importing an SVG (`file.import`) gives a frame with one vector per path. `vector.flatten` on the frame itself mangles the paths; flatten the child ids instead.
- A component created with `parent` set to a component set becomes a new variant.
- `HUG` works only on auto-layout frames and their text children; `FILL` only on children of an auto-layout frame, so append the child before setting it. Text that should wrap needs a fixed or fill width.
- Combined variants can land on top of each other: lay the set out in a grid after `component.combineVariants`.
- `component.addProperty` of type `instanceSwap` resets the bound icon of instances of other variants to the property's default. After adding one, set the property on every existing instance that showed another icon.
- `edit.duplicate` on a main component makes an instance of it, not a second main. To turn one screen state into several, run `component.detach` and then `component.create` on each copy, or duplicate the state before it becomes a component.
- A nested component whose property shares a name with its container's shows the container's value in instances. Give the inner property its own name.
- `component.editProperty` (a rename) clears slot content in detached-then-recreated copies. Screenshot every state that fills a slot after the rename, and re-insert with `instance.slotInsert {replace: true}`.
- `node.create` of a component gives it a white fill; clear it with `fill: null` unless the component needs one.

## Screen sets

- A screen is a component set on its `app/<group>` page, one per route, named like the feature component the route renders. No screen branches on a mode: a route composes its screen from granular feature components on the feature page.
- Variants are `state × viewport`: `state=<state>` for each state the code produces (loading, empty, error, guest, signed in, validation, drawer open), `viewport=mobile` at 390 px and `viewport=lg` at 1440 px, plus `sm` (640) or `md` (768) only where the screen changes there. Each frame is set to the matching `Viewport` mode (`Mobile` for `mobile`, `Desktop` for `lg`; which mode an `sm` or `md` frame takes is an open question for the inventory, since the type sizes are fluid between the two).
- Draw in the `Light` theme only. Check dark by switching the frame's `Theme` mode to `Dark`, screenshotting, and switching back; never keep a dark copy.
- Drawers and sheets are states of the screen they cover (`Product`, `state=bagOpen`), not screens of their own.
- To extract a part from a screen: `edit.duplicate` the layer, `node.reparent` the copy to the target page's section, `component.create` it, add its text properties, then put an instance where the layer was (`instance.create`, `node.reparent {index}`, `sizingH: fill`) and delete the original. To turn existing frames into one set: `component.create {ids: [frame]}` on each frame, `object.rename` each to `state=<state>, viewport=<viewport>`, then `component.combineVariants {ids}` with the default first.
- Name the set like the screen component and set its description with `node.set {description}`: what it is, the route file, the component file, and "Screen set: not exported by components:export; source of flow:export".
- Move a set to another page with `page.select` and `node.reparent {ids, parent: <section on that page>}`, then set its x and y inside the section.

## Flows: arrows and events

The `flows` page is the source of `flow:export`, which generates the store's navigation map (`apps/store/src/navigation/`, created with the flows slice). FigCraft offers no usable connector in a design file:

- Prototype interactions (`proto.interaction.add`) hold a trigger and an action but no name or label, and one screen instance would need several interactions that can't be told apart. Not used.
- Connectors (`board.connector`) exist only on boards, not in a design file. Not available.
- So each arrow is drawn: a vector plus a label plate, grouped, named for the parser, with the same facts in `pluginData`.

How to draw one (all inside the flow's section, coordinates in the section's space):

1. The screens: `instance.create {component: <variant id>, parent: <section>}` of the `viewport=mobile` variant, then `node.set {x, y, name: "<Screen> · <state>"}`. Columns 650 apart (260 gap after a 390 frame); rows spaced by the tallest frame plus 520.
2. The line: `node.create {type: vector, parent: <section>, path: "M x1 y1 L x2 y2 …", x: 0, y: 0}` with the path in section coordinates (elbows are extra `L` points), `fill: null`, `endCap: triangleArrow`, `strokeJoin: miter`; bind `stroke` to `color/ink-muted`, weight 1.5. Start on the edge of the screen that fires the event and end on the edge of the screen it opens.
3. The label: a frame named `label` (vertical auto layout, hug, fill `color/surface`, padding 4 × 8, gap 4) with a text `event` (`color/ink`, the event in SCREAMING_SNAKE_CASE) and, when the transition is conditional, a text `condition` (`color/ink-muted`, fixed width 200, plain words: "when signed in"). Place it next to the line near its start, clear of other lines.
4. `object.group {ids: [line, label], name: "EVENT · From → To"}`, with From and To as `Screen/state` (`ADD_TO_BAG · Product/default → Product/bagOpen`).
5. `node.set` on the group: `pluginData: {kind: "flowEvent", event, from, to, condition, fromNode, toNode}` (`fromNode` and `toNode` are the instance ids, as strings; `condition` is "" when there is none).

Which states go on the map: the state the shopper lands on, plus every state where the flow branches; a variant whose ways in and out match another's stays off. Draw every way out the code has, `BACK` and `CLOSE` included. Header-level transitions (search, bag, account menu, market, theme) are drawn once, from a `Root` pseudo-screen, not on every screen.

How the exporter reads the map:

- Each section on page `flows` is one flow; its name is the flow's name (`Browse → Checkout`).
- Every `GROUP` child of a section whose `pluginData.kind` is `flowEvent` is one transition. `from` and `to` split on `/` into the screen set and its `state`.
- Fallback when `pluginData` is missing: parse the group name with `^([A-Z_]+) · (\w+)/(\w+) → (\w+)/(\w+)$`, and the condition from the child text `condition` inside `label`.
- Duplicated instances of one state are the same state; transitions deduplicate on (from, event, to, condition).
- `check:flow` fails when a target doesn't exist, a screen has no route in the screen table, or a leaf route doesn't use its own screen.

## Export quirks

What the exporters do with the file, so a design choice doesn't break an export.

- `tokens:export` needs both `Theme` modes, `Light` and `Dark`, and every `type/*` style's font bound to `font/*`. A `color/a/b` name would nest; keep role names flat and kebab-case. Details: `packages/design/README.md`.
- `type/*` styles with `case: upper` export as `text-transform: uppercase`. The text-style classes are emitted doubled (`.type-x.type-x`) so they beat a hardcoded `text-*`; the cost is that breakpoint variants (`lg:type-x`) don't work, so a responsive size goes through the `Viewport` collection instead.
- `components:export` skips screen sets (pages `app/*`, or "Screen set" at the start of the description) and the design-only sets on its not-exported list.
- A `viewport` property never becomes a `cva` prop: `mobile` values are the base classes, and each larger value emits only the classes that differ from the next value down, under `sm:`, `md:` or `lg:`. Draw `sm` or `md` only where the set changes there.
- Values with no token (spacing, the 0 radius, `shadow-xl`, the 80 % scrim) map only as far as the exporter knows them; a gap that stops an export is fixed in the design or the exporter, never in the generated file.

## FigCraft's built-in prompts

The server ships prompts (`mobile_screen`, `design_system`, `landing_page`, `prototype_flow`; slash commands `/mcp__figcraft-app__<name>`). They hardcode hex values, white fills and font sizes and create their own styles, so don't use them here. They are useful only as examples of command syntax.
