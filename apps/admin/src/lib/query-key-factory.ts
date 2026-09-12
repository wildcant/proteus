// biome-ignore lint/suspicious/noExplicitAny: query key factory needs flexible typing for arbitrary query shapes
type AnyQuery = any

type TQueryKey<TKey, TListQuery = AnyQuery, TDetailQuery = string> = {
  all: readonly [TKey]
  lists: () => readonly [...TQueryKey<TKey>['all'], 'list']
  list: (query?: TListQuery) => readonly [...ReturnType<TQueryKey<TKey>['lists']>, { query: TListQuery }]
  details: () => readonly [...TQueryKey<TKey>['all'], 'detail']
  detail: (
    id: TDetailQuery,
    query?: TListQuery,
  ) => readonly [...ReturnType<TQueryKey<TKey>['details']>, TDetailQuery, { query: TListQuery }]
}

export const queryKeysFactory = <T, TListQueryType = AnyQuery, TDetailQueryType = string>(globalKey: T) => {
  const queryKeyFactory: TQueryKey<T, TListQueryType, TDetailQueryType> = {
    all: [globalKey],
    lists: () => [...queryKeyFactory.all, 'list'],
    list: (query?: TListQueryType) =>
      [...queryKeyFactory.lists(), query ? { query } : undefined].filter((k) => !!k) as unknown as readonly [
        T,
        'list',
        { query: TListQueryType },
      ],
    details: () => [...queryKeyFactory.all, 'detail'],
    detail: (id: TDetailQueryType, query?: TListQueryType) =>
      [...queryKeyFactory.details(), id, query ? { query } : undefined].filter((k) => !!k) as unknown as readonly [
        T,
        'detail',
        TDetailQueryType,
        { query: TListQueryType },
      ],
  }
  return queryKeyFactory
}
