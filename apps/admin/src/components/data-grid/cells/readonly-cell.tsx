/** A value the grid shows but never lets the user change — a derived column, not an input. */
export function ReadonlyCell({ value }: { value: string }) {
  return <span className="block truncate text-muted-foreground">{value}</span>
}
