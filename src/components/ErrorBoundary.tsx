import * as React from 'react'
import { logError } from '../utils/logger'

interface ErrorBoundaryProps {
  name?: string
  children: React.ReactNode
}

interface ErrorBoundaryState {
  hasError: boolean
  message?: string
  stack?: string
  tick: number
}

export default class ErrorBoundary extends React.Component<ErrorBoundaryProps, ErrorBoundaryState> {
  constructor(props: ErrorBoundaryProps) {
    super(props)
    this.state = { hasError: false, tick: 0 }
  }

  static getDerivedStateFromError(err: unknown): Partial<ErrorBoundaryState> {
    return { hasError: true, message: String((err as any)?.message ?? err) }
  }

  componentDidCatch(error: unknown, info: React.ErrorInfo): void {
    this.setState({ stack: info?.componentStack ?? undefined })
    logError(`ErrorBoundary:${this.props.name ?? 'boundary'}`, error, info)
  }

  reset = () => {
    this.setState((s) => ({ hasError: false, message: undefined, stack: undefined, tick: s.tick + 1 }))
  }

  render(): React.ReactNode {
    if (this.state.hasError) {
      return (
        <div className="p-3 border rounded bg-amber-50 text-amber-800 text-sm space-y-2">
          <div className="font-medium">Something went wrong{this.props.name ? ` (${this.props.name})` : ''}.</div>
          {this.state.message && <div className="whitespace-pre-wrap break-words">{this.state.message}</div>}
          <div className="flex gap-2">
            <button className="px-2 py-1 border rounded" onClick={this.reset}>Try again</button>
          </div>
        </div>
      )
    }
    return <React.Fragment key={this.state.tick}>{this.props.children}</React.Fragment>
  }
}
