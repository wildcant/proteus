import { Button, Checkbox, CommandBar, CommandBarCommand, CommandBarSeparator, CommandBarValue, cn } from '@proteus/ui'
import { ImageIcon, PlusIcon, StarIcon } from 'lucide-react'
import { useState } from 'react'
import type { AdminProductImage, AdminProductVariantResponseVariant } from '#/api/generated/model'
import { KeyboundForm } from '#/components/modals/keybound-form'
import { RouteFocusModal } from '#/components/modals/route-focus-modal/route-focus-modal'
import { useRouteModal } from '#/components/modals/route-modal-provider/use-route-modal'
import { useEditVariantMediaForm } from '#/features/products/hooks/use-edit-variant-media-form'

type EditVariantMediaFormProps = {
  productId: string
  variant: AdminProductVariantResponseVariant
  /** Every image on the parent product — the pool the variant can be assigned from. */
  productImages: AdminProductImage[]
}

export function EditVariantMediaForm({ productId, variant, productImages }: EditVariantMediaFormProps) {
  const { handleSuccess } = useRouteModal()
  const [selection, setSelection] = useState<Record<string, boolean>>({})

  const { form, isLoading } = useEditVariantMediaForm(productId, variant, {
    onSuccess: () => handleSuccess(),
  })

  const toggleSelected = (id: string) => {
    setSelection((prev) => {
      const { [id]: isSelected, ...rest } = prev
      return isSelected ? rest : { ...prev, [id]: true }
    })
  }

  return (
    <RouteFocusModal.Form form={form}>
      <KeyboundForm onSubmit={form.handleSubmit} className="flex flex-1 flex-col overflow-hidden">
        <RouteFocusModal.Header>
          <RouteFocusModal.Title className="sr-only">Edit Variant Media</RouteFocusModal.Title>
        </RouteFocusModal.Header>
        <RouteFocusModal.Body className="flex flex-col overflow-hidden">
          <form.Field name="imageIds">
            {(field) => {
              const assigned = productImages.filter((image) => field.state.value.includes(image.id))
              const available = productImages.filter((image) => !field.state.value.includes(image.id))
              const selectedIds = Object.keys(selection)

              const removeSelected = () => {
                field.handleChange(field.state.value.filter((id) => !selection[id]))
                setSelection({})
              }

              const makeThumbnail = () => {
                const [id] = selectedIds
                const image = productImages.find((item) => item.id === id)
                if (image) form.setFieldValue('thumbnail', image.url)
                setSelection({})
              }

              return (
                <div className="flex size-full flex-col-reverse lg:grid lg:grid-cols-[1fr_320px]">
                  <div className="size-full overflow-auto bg-muted/40">
                    {assigned.length > 0 ? (
                      <div className="grid h-fit auto-rows-auto grid-cols-2 gap-6 p-6 xl:grid-cols-4">
                        <form.Subscribe selector={(state) => state.values.thumbnail}>
                          {(thumbnail) =>
                            assigned.map((image) => (
                              <AssignedImage
                                key={image.id}
                                image={image}
                                checked={!!selection[image.id]}
                                isThumbnail={image.url === thumbnail}
                                onCheckedChange={() => toggleSelected(image.id)}
                              />
                            ))
                          }
                        </form.Subscribe>
                      </div>
                    ) : (
                      <div className="flex size-full flex-col items-center justify-center gap-y-2 p-6">
                        <ImageIcon className="size-6 text-muted-foreground" />
                        <p className="text-muted-foreground text-sm">No images assigned to this variant yet.</p>
                      </div>
                    )}
                  </div>
                  <div className="overflow-auto border-b lg:border-b-0 lg:border-l">
                    <div className="border-b px-6 py-4">
                      <h2 className="font-medium text-sm">Select images</h2>
                      <p className="mt-1 text-muted-foreground text-sm">
                        Add product images to the variant. To add new images, add them to the product first.
                      </p>
                    </div>
                    <div className="grid grid-cols-2 gap-4 p-4">
                      {available.map((image) => (
                        <AvailableImage
                          key={image.id}
                          image={image}
                          onAdd={() => field.handleChange([...field.state.value, image.id])}
                        />
                      ))}
                    </div>
                  </div>
                  <CommandBar open={selectedIds.length > 0}>
                    <CommandBarValue>{selectedIds.length} selected</CommandBarValue>
                    <CommandBarSeparator />
                    {selectedIds.length === 1 && (
                      <>
                        <CommandBarCommand action={makeThumbnail} label="Make thumbnail" shortcut="t" />
                        <CommandBarSeparator />
                      </>
                    )}
                    <CommandBarCommand action={removeSelected} label="Remove Selected" shortcut="r" />
                  </CommandBar>
                </div>
              )
            }}
          </form.Field>
        </RouteFocusModal.Body>
        <RouteFocusModal.Footer>
          <RouteFocusModal.Close render={<Button variant="secondary" size="sm" />}>Cancel</RouteFocusModal.Close>
          <Button type="submit" size="sm" disabled={isLoading}>
            Save
          </Button>
        </RouteFocusModal.Footer>
      </KeyboundForm>
    </RouteFocusModal.Form>
  )
}

type AssignedImageProps = {
  image: AdminProductImage
  checked: boolean
  isThumbnail: boolean
  onCheckedChange: () => void
}

function AssignedImage({ image, checked, isThumbnail, onCheckedChange }: AssignedImageProps) {
  return (
    <div
      data-slot="media-tile"
      className="group relative aspect-square size-full overflow-hidden rounded-lg border bg-muted shadow-sm"
    >
      {!!isThumbnail && (
        <span
          title="Thumbnail"
          className="absolute top-2 left-2 z-10 rounded-full bg-background p-1 text-foreground shadow-sm"
        >
          <StarIcon className="size-3.5 fill-current" />
          <span className="sr-only">Thumbnail</span>
        </span>
      )}
      <img src={image.url} alt="" className="size-full object-cover object-center" />
      <div
        className={cn(
          'invisible absolute top-2 right-2 z-10 opacity-0 transition-opacity group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100',
          checked && 'visible opacity-100',
        )}
      >
        <Checkbox
          checked={checked}
          onCheckedChange={onCheckedChange}
          aria-label="Select image"
          className="bg-background"
        />
      </div>
    </div>
  )
}

function AvailableImage({ image, onAdd }: { image: AdminProductImage; onAdd: () => void }) {
  return (
    <button
      type="button"
      onClick={onAdd}
      data-slot="available-image"
      className="group relative aspect-square size-full cursor-pointer overflow-hidden rounded-lg border bg-muted shadow-sm outline-none focus-visible:ring-3 focus-visible:ring-ring/50"
    >
      <img src={image.url} alt="" className="size-full object-cover object-center" />
      <span className="invisible absolute inset-0 flex items-center justify-center bg-foreground/30 opacity-0 transition-opacity group-hover:visible group-hover:opacity-100 group-focus-visible:visible group-focus-visible:opacity-100">
        <span className="flex size-10 items-center justify-center rounded-full border bg-background shadow-sm">
          <PlusIcon className="size-4" />
        </span>
      </span>
      <span className="sr-only">Add image to variant</span>
    </button>
  )
}
