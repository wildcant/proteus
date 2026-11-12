import accordionSet from '@proteus/design/components/Accordion.json'
import { setDefault, setOptions } from '@proteus/design/figcraft-set'
import type { Meta, StoryObj } from '@storybook/react-vite'
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from './accordion'

function AccordionStory({ variant, label }: { variant: 'menu' | 'footer'; label: string }) {
  return (
    <Accordion variant={variant} defaultValue={['first']}>
      <AccordionItem value="first">
        <AccordionTrigger>{label}</AccordionTrigger>
        <AccordionContent>
          <a href="#shirts">Shirts</a>
          <a href="#shorts">Shorts</a>
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value="second">
        <AccordionTrigger>{label}</AccordionTrigger>
        <AccordionContent>
          <a href="#shoes">Shoes</a>
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  )
}

const meta = {
  title: 'ui/Accordion',
  component: AccordionStory,
  args: {
    variant: setDefault(accordionSet, 'variant') as 'menu',
    label: setDefault(accordionSet, 'label'),
  },
  argTypes: {
    variant: { control: 'select', options: setOptions(accordionSet, 'variant') },
    label: { control: 'text' },
  },
} satisfies Meta<typeof AccordionStory>

// biome-ignore lint/style/noDefaultExport: Storybook reads the meta from the default export.
export default meta

type Story = StoryObj<typeof meta>

export const Playground: Story = {}
