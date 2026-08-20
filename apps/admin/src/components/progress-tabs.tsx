import { cn, Tabs, TabsContent, TabsList, TabsTrigger } from '@proteus/ui'
import { CircleCheck, CircleDot, CircleDotDashed } from 'lucide-react'

export type ProgressStatus = 'not-started' | 'in-progress' | 'completed'

const statusIcons: Record<ProgressStatus, React.ElementType> = {
  'not-started': CircleDotDashed,
  'in-progress': CircleDot,
  completed: CircleCheck,
}

function ProgressTabs(props: React.ComponentProps<typeof Tabs>) {
  return <Tabs {...props} />
}

function ProgressTabsList({ className, ...props }: React.ComponentProps<typeof TabsList>) {
  return (
    <TabsList
      className={cn(
        'flex flex-1 items-center justify-start rounded-none bg-muted/40 p-0 group-data-horizontal/tabs:h-13',
        '*:data-[slot=tabs-trigger]:border-r [&>[data-slot=tabs-trigger]:last-child]:border-r-0',
        className,
      )}
      {...props}
    />
  )
}

type ProgressTabsTriggerProps = React.ComponentProps<typeof TabsTrigger> & {
  status: ProgressStatus
}

function ProgressTabsTrigger({ status, children, className, ...props }: ProgressTabsTriggerProps) {
  const Icon = statusIcons[status]

  return (
    <TabsTrigger
      className={cn(
        'group/trigger h-full w-full max-w-50 flex-1 items-center justify-start gap-x-2 rounded-none border-r-border px-4 text-left text-muted-foreground',
        'hover:bg-muted/60',
        'data-active:bg-background data-active:text-foreground data-active:shadow-none',
        className,
      )}
      {...props}
    >
      <Icon
        className={cn(
          'size-5 text-muted-foreground',
          (status === 'in-progress' || status === 'completed') && 'group-data-active/trigger:text-primary',
        )}
      />
      {children}
    </TabsTrigger>
  )
}

ProgressTabs.List = ProgressTabsList
ProgressTabs.Trigger = ProgressTabsTrigger
ProgressTabs.Content = TabsContent

export { ProgressTabs }
