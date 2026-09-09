type ToolbarHeadingProps = {
  heading?: string
  /** Explains what the list is for, under the heading. Most tables have nothing to add. */
  description?: string
}

/**
 * A table's title, and the sentence under it when the list needs one.
 *
 * The description is drawn only when it is given, and the heading-only branch returns exactly the
 * element `DataTable` returned before this existed — so adding the prop to one table cannot move
 * the dozen that do not pass it.
 *
 * Its own file, free of `@proteus/ui`, so the markup claim above can be asserted from the admin's
 * node-only unit suite rather than only in a browser.
 */
export function ToolbarHeading({ heading, description }: ToolbarHeadingProps) {
  if (!heading) return null
  if (!description) return <h1 className="font-semibold text-lg">{heading}</h1>

  return (
    <div className="flex flex-col gap-y-1">
      <h1 className="font-semibold text-lg">{heading}</h1>
      <p className="text-muted-foreground text-sm">{description}</p>
    </div>
  )
}
