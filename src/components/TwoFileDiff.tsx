import TwoFileDiffViewer, {
  exportDiff,
  type DiffExportFormat,
  type DiffSide,
  type TwoFileDiffViewerProps,
} from './TwoFileDiffViewer'

export { exportDiff }
export type { DiffExportFormat, DiffSide, TwoFileDiffViewerProps }

/**
 * Backwards compatible wrapper that preserves the original default export while
 * delegating all behaviour to the richer TwoFileDiffViewer component.
 */
export default function TwoFileDiff(props: TwoFileDiffViewerProps = {}) {
  return <TwoFileDiffViewer {...props} />
}


