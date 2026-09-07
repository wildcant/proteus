import {
  Button,
  Card,
  CardAction,
  CardHeader,
  CardTitle,
  Checkbox,
  CommandBar,
  CommandBarCommand,
  CommandBarSeparator,
  CommandBarValue,
  cn,
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  usePrompt,
} from '@proteus/ui'
import { Link, useNavigate } from '@tanstack/react-router'
import { ImageIcon, PencilIcon, StarIcon } from 'lucide-react'
import { useState } from 'react'
import type { AdminProductResponseProduct } from '#/api/generated/model'
import { ActionMenu } from '#/components/common/action-menu'
import { useUpdateProduct } from '#/features/products/api/products'
import { getProductMedia } from '#/features/products/utils/media'

export function ProductMediaSection({ product }: { product: AdminProductResponseProduct }) {
  const navigate = useNavigate()
  const prompt = usePrompt()
  const [selection, setSelection] = useState<Record<string, boolean>>({})
  const { mutateAsync: updateProduct } = useUpdateProduct(product.id)

  const media = getProductMedia(product)
  const selectedKeys = Object.keys(selection)

  // A thumbnail that is not part of the images collection has no image row to link variants to,
  // so it carries no `id` and the command stays hidden for it.
  const selectedImageId = selectedKeys.length === 1 ? media.find((item) => item.key === selectedKeys[0])?.id : undefined

  const toggleSelected = (key: string) => {
    setSelection((prev) => {
      const { [key]: isSelected, ...rest } = prev
      return isSelected ? rest : { ...prev, [key]: true }
    })
  }

  const handleDelete = async () => {
    const removingThumbnail = selectedKeys.some((key) => media.find((item) => item.key === key)?.isThumbnail)

    const confirmed = await prompt({
      title: 'Delete media',
      description: removingThumbnail
        ? `Are you sure you want to delete ${selectedKeys.length} image(s)? This includes the product thumbnail.`
        : `Are you sure you want to delete ${selectedKeys.length} image(s)?`,
      confirmText: 'Delete',
    })

    if (!confirmed) {
      return
    }

    const imagesToKeep = (product.images ?? [])
      .filter((image) => !selectedKeys.includes(image.id))
      .map((image) => ({ id: image.id, url: image.url }))

    // The backend re-derives the thumbnail whenever an `images` collection is sent, so the
    // current one has to be echoed back unless it is the thing being deleted.
    await updateProduct(
      { images: imagesToKeep, thumbnail: removingThumbnail ? null : product.thumbnail },
      { onSuccess: () => setSelection({}) },
    )
  }

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
          {media.map((item) => (
            <div
              key={item.key}
              data-slot="media-tile"
              className="group relative aspect-square size-full overflow-hidden rounded-lg border shadow-sm transition-shadow hover:shadow-md"
            >
              <div
                className={cn(
                  'invisible absolute top-2 right-2 z-10 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100',
                  selection[item.key] && 'visible opacity-100',
                )}
              >
                <Checkbox
                  checked={selection[item.key] ?? false}
                  onCheckedChange={() => toggleSelected(item.key)}
                  aria-label="Select image"
                  className="bg-background"
                />
              </div>
              {!!item.isThumbnail && (
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
              <Link to="/products/$id/media" params={{ id: product.id }} className="block size-full">
                <img src={item.url} alt={`${product.title} media`} className="size-full object-cover" />
              </Link>
            </div>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center gap-y-4 px-6 pt-6 pb-8">
          <ImageIcon className="size-6 text-muted-foreground" />
          <div className="flex flex-col items-center gap-y-1 text-sm">
            <span className="font-medium">No media</span>
            <span className="text-muted-foreground">Add media to showcase this product in your storefront.</span>
          </div>
          <Button
            size="sm"
            variant="outline"
            nativeButton={false}
            render={<Link to="/products/$id/media" params={{ id: product.id }} />}
          >
            Add media
          </Button>
        </div>
      )}
      <CommandBar open={selectedKeys.length > 0}>
        <CommandBarValue>{selectedKeys.length} selected</CommandBarValue>
        <CommandBarSeparator />
        {!!selectedImageId && (
          <>
            <CommandBarCommand
              action={() =>
                navigate({
                  to: '/products/$id/images/$imageId/variants',
                  params: { id: product.id, imageId: selectedImageId },
                })
              }
              label="Manage associated variants"
              shortcut="m"
            />
            <CommandBarSeparator />
          </>
        )}
        <CommandBarCommand action={handleDelete} label="Delete" shortcut="d" />
      </CommandBar>
    </Card>
  )
}
