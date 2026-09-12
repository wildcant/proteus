export type OperatorMap<T> = {
  $eq?: T
  $ne?: T
  $gt?: T
  $gte?: T
  $lt?: T
  $lte?: T
  $like?: string
  $ilike?: string
  $in?: T[]
  $nin?: T[]
  $is?: null
}

export type BaseFilterable<T> = {
  $and?: T[]
  $or?: T[]
}

export type FindConfig<Entity> = {
  select?: (keyof Entity)[]
  offset?: number
  limit?: number
  order?: Partial<Record<keyof Entity, 'ASC' | 'DESC'>>
  withDeleted?: boolean
}
