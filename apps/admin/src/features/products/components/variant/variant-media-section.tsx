import { Card, CardAction, CardHeader, CardTitle, Tooltip, TooltipContent, TooltipTrigger } from '@proteus/ui'
import { ImageIcon, PencilIcon, StarIcon } from 'lucide-react'
import type { AdminProductVariantResponseVariant } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'

export function VariantMediaSection({ variant }: { variant: AdminProductVariantResponseVariant }) {
  const media = variant.images ?? []

  return (
    <Card className="gap-0 divide-y py-0">
      <CardHeader>
        <CardTitle>Media</CardTitle>
        <CardAction>
          <ActionMenu groups={[{ actions: [{ label: 'Edit Media', to: './media', icon: <PencilIcon /> }] }]} />
        </CardAction>
      </CardHeader>
      {media.length > 0 ? (
        <div className="grid grid-cols-[repeat(auto-fill,minmax(96px,1fr))] gap-4 px-6 py-4">
          {media.map((image) => (
            <div
              key={image.id}
              data-slot="media-tile"
              className="relative aspect-square size-full overflow-hidden rounded-lg border shadow-sm"
            >
              {image.url === variant.thumbnail && (
                <Tooltip>
                  <TooltipTrigger
                    render={
                      <button
                        type="button"
                        className="absolute top-2 left-2 z-10 cursor-default rounded-full bg-background p-1 text-foreground shadow-sm"
                      />
                    }
                  >
                    <StarIcon className="size-3.5 fill-current" />
                    <span className="sr-only">Thumbnail</span>
                  </TooltipTrigger>
                  <TooltipContent>Thumbnail</TooltipContent>
                </Tooltip>
              )}
              <img src={image.url} alt={`${variant.title} media`} className="size-full object-cover" />
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-y-4 px-6 pt-6 pb-8">
          <ImageIcon className="size-6 text-muted-foreground" />
          <div className="flex flex-col items-center gap-y-1 text-sm">
            <span className="font-medium">No media</span>
            <span className="text-muted-foreground">Assign product images to this variant.</span>
          </div>
        </div>
      )}
    </Card>
  )
}
