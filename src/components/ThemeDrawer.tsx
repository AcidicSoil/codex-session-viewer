import * as React from 'react'
import { Dialog } from '@headlessui/react'
import ThemePicker from './ThemePicker'
import { Button } from './ui/button'
import { Badge } from './ui/badge'

export default function ThemeDrawer() {
  const [open, setOpen] = React.useState(false)
  return (
    <>
      <Button variant="outline" size="sm" aria-label="Open appearance settings" onClick={() => setOpen(true)}>Appearance</Button>
      <Dialog open={open} onClose={() => setOpen(false)} className="relative z-50">
        <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
        <div className="fixed inset-0 flex items-stretch justify-end">
          <Dialog.Panel className="h-full w-full max-w-md bg-background text-foreground border-l border-foreground/20 shadow-xl flex flex-col outline-none">
            <div className="p-4 border-b border-foreground/20 flex items-center justify-between">
              <Dialog.Title className="text-base font-semibold">Appearance</Dialog.Title>
              <Button variant="ghost" size="sm" aria-label="Close" onClick={() => setOpen(false)}>Close</Button>
            </div>
            <div className="p-4 space-y-6 overflow-auto">
              <section>
                <h3 className="text-sm font-medium mb-2">Theme</h3>
                <ThemePicker />
              </section>
              <section>
                <h3 className="text-sm font-medium mb-2">Preview</h3>
                <div className="flex flex-wrap gap-2 items-center">
                  <Button>Primary Button</Button>
                  <Button variant="outline">Outline Button</Button>
                  <Button variant="link">Link Button</Button>
                  <Badge>Badge</Badge>
                  <Badge variant="outline">Outline Badge</Badge>
                </div>
              </section>
            </div>
          </Dialog.Panel>
        </div>
      </Dialog>
    </>
  )
}
