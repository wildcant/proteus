import type { LinkOptions, RegisteredRouter } from '@tanstack/react-router'
import { flow } from '#/navigation/flow.gen'
import { type ScreenKey, screens } from '#/navigation/screens'

// One function per event drawn from a screen on the design file's flow map (flow.gen.ts), returning TanStack link
// options for where it leads (screens.ts). A route asks for its screen's and passes them to its feature as props,
// so a feature never knows the route tree and a transition that isn't on the map can't be wired:
//
//   const links = flowLinks('ProductListPage')
//   <ProductListPage productLink={links.PRODUCT} />          // the feature: <Link {...productLink({ params })}>
//   navigate(links.SIGNED_IN('AccountDetail'))               // after a mutation: the same options, to navigate
//
// Pure, so it runs the same during SSR, and a link is a real <a href>. Events that stay on their screen are kept:
// they change the URL (search params, a drawer's route). An event with one target takes the link's own options
// (params, search, replace…); one with several takes the target first. An event drawn to `./state` stays on the
// current route, whichever renders the screen, and takes the search params to change, merged over the current ones:
//
//   <ProductListPage links={{ sort: links.SORT }} />   // the feature: navigate(links.sort({ sort, offset }))

type Flow = typeof flow
/** A screen with a way out on the map. */
type FlowScreen = keyof Flow
type Transition = { readonly to: string; readonly state: string }
/** The target of a transition drawn to `./state`: the current route. */
type Stay = { readonly to: '.' }

/** The table entry a transition lands on: its state's own entry when the table has one, else its screen's. */
type EntryOf<T extends Transition> = T extends unknown
  ? `${T['to']}/${T['state']}` extends ScreenKey
    ? `${T['to']}/${T['state']}`
    : Extract<T['to'], ScreenKey>
  : never

type TargetsOf<S extends FlowScreen, E extends keyof Flow[S]> = Flow[S][E] extends readonly (infer T extends
  Transition)[]
  ? EntryOf<T>
  : never

type ToOf<K extends ScreenKey> = (typeof screens)[K] extends { readonly to: infer To extends string } ? To : never

/** Link options to one screen of the table: spread on `<Link>`, or passed to `navigate`. */
export type FlowLink<K extends ScreenKey> = LinkOptions<RegisteredRouter, string, ToOf<K>>
type Options<K extends ScreenKey> = Omit<FlowLink<K>, 'to'>
// biome-ignore lint/complexity/noBannedTypes: `{}` asks whether every option is optional
type OptionsArgument<K extends ScreenKey> = {} extends Options<K> ? [options?: Options<K>] : [options: Options<K>]

type IsUnion<T, U = T> = T extends unknown ? ([U] extends [T] ? false : true) : never

type Action<K extends ScreenKey> =
  true extends IsUnion<K>
    ? <Target extends K>(target: Target, ...options: OptionsArgument<Target>) => FlowLink<Target>
    : (...options: OptionsArgument<K>) => FlowLink<K>

/** Link options that stay on the current route and change its search. */
export type StayLink = LinkOptions<RegisteredRouter, string, '.'>
type StayAction = (search: Record<string, unknown>, options?: Omit<StayLink, 'to' | 'search'>) => StayLink

export type FlowLinks<S extends FlowScreen> = {
  [E in keyof Flow[S]]: Flow[S][E] extends readonly Stay[] ? StayAction : Action<TargetsOf<S, E>>
}

export function flowLinks<S extends FlowScreen>(screen: S): FlowLinks<S> {
  const events: Record<string, readonly Transition[]> = flow[screen]
  const actions = Object.entries(events).map(([event, transitions]) => {
    if (transitions.every(({ to }) => to === '.')) return [event, stayLink] as const
    const [only, ...others] = [...new Set(transitions.map(entryOf))]
    const action =
      others.length > 0 || !only
        ? (target: ScreenKey, options?: object) => linkTo(target, options)
        : (options?: object) => linkTo(only, options)
    return [event, action] as const
  })
  return Object.fromEntries(actions) as FlowLinks<S>
}

function stayLink(search: Record<string, unknown>, options: object = {}) {
  return { ...options, to: '.', search: (current: Record<string, unknown>) => ({ ...current, ...search }) }
}

function entryOf({ to, state }: Transition): ScreenKey {
  const key = `${to}/${state}`
  return (key in screens ? key : to) as ScreenKey
}

function linkTo(key: ScreenKey, options: object = {}) {
  const entry = screens[key]
  if (!('to' in entry)) throw new Error(`${key} has no link in the screen table`)
  // An overlay's state is a search param over whatever page is showing, so the page's own params stay.
  if (!('search' in entry)) return { ...options, to: entry.to }
  return { ...options, to: entry.to, search: (current: Record<string, unknown>) => ({ ...current, ...entry.search }) }
}
