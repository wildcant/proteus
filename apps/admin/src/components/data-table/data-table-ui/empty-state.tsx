type EmptyStateProps = {
  heading: string
  description?: string
}

export function EmptyState({ heading, description }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <h3 className="text-lg font-semibold">{heading}</h3>
      {!!description && <p className="mt-1 text-sm text-muted-foreground">{description}</p>}
    </div>
  )
}
