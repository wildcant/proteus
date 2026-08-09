/**
 * Converts a flat array of routes into a tree grouped by segment type,
 * then flattens back in priority order so static segments match before dynamic ones.
 *
 * Priority: global > wildcard > regex > static > params
 *
 * Tree structure for "/admin/products/:id":
 * ```
 * root.static.children.admin.static.children.products.params.routes = [route]
 * ```
 */

type SortableRoute = {
  matcher: string | RegExp
  method?: string
  methods?: string | string[]
}

type BranchKey = 'global' | 'regex' | 'wildcard' | 'static' | 'params'

type BranchNode<T extends SortableRoute> = {
  routes: T[]
  children?: Record<string, RoutesBranch<T>>
}

type RoutesBranch<T extends SortableRoute> = Record<BranchKey, BranchNode<T>>

export class RoutesSorter<T extends SortableRoute> {
  private orderBy: BranchKey[] = ['global', 'wildcard', 'regex', 'static', 'params']
  private routesToProcess: T[]
  private routesTree: Record<string, RoutesBranch<T>>

  constructor(routes: T[]) {
    this.routesToProcess = routes
    this.routesTree = { root: this.createBranch() }
  }

  private createBranch(): RoutesBranch<T> {
    return {
      global: { routes: [] },
      regex: { routes: [] },
      wildcard: { routes: [] },
      static: { routes: [] },
      params: { routes: [] },
    }
  }

  private processRoute(route: T): void {
    const root = this.routesTree.root
    if (!root) return

    if (route.matcher instanceof RegExp) {
      root.regex.routes.push(route)
      return
    }

    const segments = route.matcher.split('/').filter((s) => s.length)

    if (!segments.length) {
      const bucket: BranchKey = !route.methods && !route.method ? 'global' : 'static'
      root[bucket].routes.push(route)
      return
    }

    let current = root
    segments.forEach((segment, index) => {
      let bucket: BranchKey = 'static'

      if (!route.methods && !route.method) {
        bucket = 'global'
      } else if (segment.startsWith('*')) {
        bucket = 'wildcard'
      } else if (segment.startsWith(':')) {
        bucket = 'params'
      } else if (/[+*[\]()!]/.test(segment)) {
        bucket = 'regex'
      }

      if (index + 1 === segments.length) {
        current[bucket].routes.push(route)
        return
      }

      const node = current[bucket]
      if (!node.children) node.children = {}
      if (!node.children[segment]) node.children[segment] = this.createBranch()
      current = node.children[segment]
    })
  }

  private sortBranch(routeBranch: Record<string, RoutesBranch<T>>, orderBy: BranchKey[]): T[] {
    const buckets: Record<BranchKey, T[]> = {
      global: [],
      wildcard: [],
      regex: [],
      params: [],
      static: [],
    }

    for (const branchKey of Object.keys(routeBranch)) {
      const node = routeBranch[branchKey]
      if (!node) continue

      for (const key of Object.keys(buckets) as BranchKey[]) {
        buckets[key].push(...node[key].routes)
        if (node[key].children) {
          buckets[key].push(...this.sortBranch(node[key].children, orderBy))
        }
      }
    }

    return orderBy.flatMap((key) => buckets[key])
  }

  sort(orderBy?: BranchKey[]): T[] {
    for (const route of this.routesToProcess) {
      this.processRoute(route)
    }
    return this.sortBranch(this.routesTree, orderBy ?? this.orderBy)
  }
}
