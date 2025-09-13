import * as React from 'react'
import { Dialog } from '@headlessui/react'
import { CanvasReveal } from './ui/canvas-reveal'
import { Vortex } from './ui/vortex'
import { Button } from './ui/button'

export interface GithubGlobeModalProps {
  open: boolean
  onClose: () => void
  files: string[]
}

export default function GithubGlobeModal({ open, onClose, files }: GithubGlobeModalProps) {
  return (
    <Dialog open={open} onClose={onClose} className="relative z-50">
      <div className="fixed inset-0 bg-black/30" aria-hidden="true" />
      <div className="fixed inset-0 flex items-center justify-center p-4">
        <Dialog.Panel className="w-full max-w-lg rounded bg-white p-4">
          <Dialog.Title className="text-lg font-semibold mb-2">GitHub Globe</Dialog.Title>
          <CanvasReveal className="h-64 mb-4">
            <Vortex items={files} className="p-4" />
          </CanvasReveal>
          <div className="flex justify-end">
            <Button variant="outline" size="sm" onClick={onClose}>Close</Button>
          </div>
        </Dialog.Panel>
      </div>
    </Dialog>
  )
}
