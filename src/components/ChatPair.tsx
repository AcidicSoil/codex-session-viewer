import * as React from 'react'
import type { ResponseItem, MessagePart } from '../types'
import { Badge } from './ui/badge'

type MessageItem = Extract<ResponseItem, { type: 'Message' }>

interface ChatPairProps {
  user: MessageItem
  assistant?: MessageItem
}

export default function ChatPair({ user, assistant }: ChatPairProps) {
  const renderContent = (
    content: string | readonly MessagePart[]
  ): string =>
    typeof content === 'string'
      ? content
      : content.map((part) => part.text).join('')

  return (
    <div data-testid="chat-pair" className="grid grid-cols-2 gap-4">
      <div className="justify-self-start space-y-1">
        <div className="text-xs text-gray-500 flex items-center gap-2">
          <Badge variant="secondary">user</Badge>
        </div>
        <pre className="whitespace-pre-wrap break-words text-sm bg-gray-50 rounded p-2">
          {renderContent(user.content)}
        </pre>
      </div>
      {assistant && (
        <div className="justify-self-end space-y-1">
          <div className="text-xs text-gray-500 flex items-center gap-2 justify-end">
            <Badge variant="secondary">assistant</Badge>
          </div>
          <pre className="whitespace-pre-wrap break-words text-sm bg-gray-50 rounded p-2 text-right">
            {renderContent(assistant.content)}
          </pre>
        </div>
      )}
    </div>
  )
}

