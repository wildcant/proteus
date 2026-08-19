import { Tooltip, TooltipContent, TooltipTrigger } from '@proteus/ui'
import type { ReactNode } from 'react'
import { useRef, useState } from 'react'

type TruncatedCellProps = {
  children: ReactNode
  disabled?: boolean
}

export function TruncatedCell({ children, disabled }: TruncatedCellProps) {
  const ref = useRef<HTMLDivElement>(null)
  const [overflows, setOverflows] = useState(false)

  const onMouseEnter = () => {
    if (ref.current) {
      setOverflows(ref.current.scrollWidth > ref.current.clientWidth)
    }
  }

  if (disabled) {
    return <div className="truncate">{children}</div>
  }

  return (
    <Tooltip>
      {/* biome-ignore lint/a11y/noStaticElementInteractions: base-ui's render prop delegates aria attributes to the rendered element */}
      <TooltipTrigger render={<div ref={ref} className="truncate" onMouseEnter={onMouseEnter} />}>
        {children}
      </TooltipTrigger>
      {!!overflows && <TooltipContent>{children}</TooltipContent>}
    </Tooltip>
  )
}
