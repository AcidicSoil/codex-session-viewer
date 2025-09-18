import React from 'react'
import type { SessionMetaParsed } from '../parser'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from './ui/card'
import { Badge } from './ui/badge'

export interface MetadataPanelProps {
  meta?: SessionMetaParsed
}

function Row({ label, value }: { label: string; value?: React.ReactNode }) {
  if (value === undefined || value === null || value === '') return null
  const testId = `metadata-${label.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')}`
  return (
    <div className="flex gap-3 text-sm" data-testid={testId}>
      <div className="w-28 text-gray-500 shrink-0">{label}</div>
      <div className="text-gray-900 break-words flex-1 min-w-0">{value}</div>
    </div>
  )
}

export default function MetadataPanel({ meta }: MetadataPanelProps) {
  if (!meta) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Session Metadata</CardTitle>
          <CardDescription>No session loaded yet.</CardDescription>
        </CardHeader>
      </Card>
    )
  }

  const git = meta.git || {}

  return (
    <Card className="space-y-3">
      <CardHeader>
        <CardTitle>Session Metadata</CardTitle>
        <CardDescription>Parsed details from the loaded session.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-2">
        <Row label="ID" value={meta.id} />
        <Row label="Timestamp" value={meta.timestamp} />
        <Row label="Version" value={(meta as any).version as React.ReactNode} />
        <Row
          label="Instructions"
          value={
            meta.instructions && (
              <pre className="bg-gray-50 p-2 rounded whitespace-pre-wrap break-words max-h-48 overflow-x-auto overflow-y-auto w-full max-w-full">{meta.instructions}</pre>
            )
          }
        />
        <div className="pt-2 border-t border-gray-100 space-y-2">
          <h3 className="text-sm font-medium text-gray-700">Git</h3>
          <Row label="Repo" value={git.repo} />
          <Row label="Branch" value={git.branch} />
          <Row label="Commit" value={git.commit} />
          <Row label="Remote" value={git.remote} />
          {git.dirty !== undefined && (
            <Row
              label="Dirty"
              value={<Badge variant={git.dirty ? 'destructive' : 'muted'}>{String(git.dirty)}</Badge>}
            />
          )}
        </div>
      </CardContent>
    </Card>
  )
}
