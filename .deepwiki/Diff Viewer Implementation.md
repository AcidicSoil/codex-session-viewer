Based on our previous conversation about building a Codex session viewer, you're asking about how the diff viewer component will work to display code changes from session files.

## Diff Viewer Implementation

The diff viewer will need to handle the various `FileChange` types that appear in Codex sessions, particularly from `PatchApplyBegin` and `PatchApplyEnd` events. [1](#9-0)

## Existing Diff Rendering Infrastructure

Codex already has a comprehensive diff rendering system you can reference or adapt. The TUI implements a sophisticated diff viewer in [2](#9-1)  that handles three main scenarios:

**File Addition**: Shows new file content with green `+` prefixes [3](#9-2)

**File Deletion**: Shows removed content with red `-` prefixes [4](#9-3)

**File Updates**: Parses unified diffs and renders them with proper line numbers and context [5](#9-4)

## Diff Processing Pipeline

The diff viewer processes changes through several stages:

1. **Parse FileChange Events**: Extract `unified_diff` strings from `PatchApplyBegin` events [6](#9-5)

2. **Diff Parsing**: Use the `diffy` crate to parse unified diff format into structured hunks [7](#9-6)

3. **Line-by-Line Rendering**: Process each diff line with appropriate styling:
   - Insert lines (green with `+`)
   - Delete lines (red with `-`)
   - Context lines (normal styling)

## Visual Formatting

The existing implementation provides excellent patterns for your standalone viewer:

**Line Wrapping**: Long lines are wrapped while maintaining proper indentation [8](#9-7)

**Hunk Separation**: Multiple hunks in a file are separated with ellipsis indicators [9](#9-8)

**Path Display**: File paths are relativized and formatted appropriately [10](#9-9)

## Integration with Session Events

Your diff viewer will need to correlate `PatchApplyBegin` events with their corresponding `PatchApplyEnd` events using the `call_id` field. [11](#9-10)  This allows you to show both the proposed changes and their execution results.

The headless execution mode also demonstrates diff output formatting [12](#9-11)  which you can adapt for web display.

## Notes

The existing Codex diff rendering system is quite sophisticated, handling edge cases like binary files, long lines, and complex multi-hunk patches. For your standalone viewer, you can either port this Rust logic to your chosen language or use similar diff parsing libraries (like `diff2html` for JavaScript) while following the same structural patterns.

Wiki pages you might want to explore:

- [Protocol and Event Processing (openai/codex)](/wiki/openai/codex#2.1.1)
- [Terminal User Interface (TUI) (openai/codex)](/wiki/openai/codex#2.2)

### Citations

**File:** codex-rs/protocol/src/protocol.rs (L832-851)

```rust
pub struct PatchApplyBeginEvent {
    /// Identifier so this can be paired with the PatchApplyEnd event.
    pub call_id: String,
    /// If true, there was no ApplyPatchApprovalRequest for this patch.
    pub auto_approved: bool,
    /// The changes to be applied.
    pub changes: HashMap<PathBuf, FileChange>,
}

#[derive(Debug, Clone, Deserialize, Serialize)]
pub struct PatchApplyEndEvent {
    /// Identifier for the PatchApplyBegin that finished.
    pub call_id: String,
    /// Captured stdout (summary printed by apply_patch).
    pub stdout: String,
    /// Captured stderr (parser errors, IO failures, etc.).
    pub stderr: String,
    /// Whether the patch was applied successfully.
    pub success: bool,
}
```

**File:** codex-rs/tui/src/diff_render.rs (L25-43)

```rust
pub(crate) fn create_diff_summary(
    changes: &HashMap<PathBuf, FileChange>,
    event_type: PatchEventType,
    cwd: &Path,
    wrap_cols: usize,
) -> Vec<RtLine<'static>> {
    let rows = collect_rows(changes);
    let header_kind = match event_type {
        PatchEventType::ApplyBegin { auto_approved } => {
            if auto_approved {
                HeaderKind::Edited
            } else {
                HeaderKind::ChangeApproved
            }
        }
        PatchEventType::ApprovalRequest => HeaderKind::ProposedChange,
    };
    render_changes_block(rows, wrap_cols, header_kind, cwd)
}
```

**File:** codex-rs/tui/src/diff_render.rs (L193-202)

```rust
            FileChange::Add { content } => {
                for (i, raw) in content.lines().enumerate() {
                    out.extend(push_wrapped_diff_line(
                        i + 1,
                        DiffLineType::Insert,
                        raw,
                        term_cols,
                    ));
                }
            }
```

**File:** codex-rs/tui/src/diff_render.rs (L203-212)

```rust
            FileChange::Delete { content } => {
                for (i, raw) in content.lines().enumerate() {
                    out.extend(push_wrapped_diff_line(
                        i + 1,
                        DiffLineType::Delete,
                        raw,
                        term_cols,
                    ));
                }
            }
```

**File:** codex-rs/tui/src/diff_render.rs (L213-262)

```rust
            FileChange::Update { unified_diff, .. } => {
                if let Ok(patch) = diffy::Patch::from_str(&unified_diff) {
                    let mut is_first_hunk = true;
                    for h in patch.hunks() {
                        if !is_first_hunk {
                            out.push(RtLine::from(vec!["    ".into(), "⋮".dim()]));
                        }
                        is_first_hunk = false;

                        let mut old_ln = h.old_range().start();
                        let mut new_ln = h.new_range().start();
                        for l in h.lines() {
                            match l {
                                diffy::Line::Insert(text) => {
                                    let s = text.trim_end_matches('\n');
                                    out.extend(push_wrapped_diff_line(
                                        new_ln,
                                        DiffLineType::Insert,
                                        s,
                                        term_cols,
                                    ));
                                    new_ln += 1;
                                }
                                diffy::Line::Delete(text) => {
                                    let s = text.trim_end_matches('\n');
                                    out.extend(push_wrapped_diff_line(
                                        old_ln,
                                        DiffLineType::Delete,
                                        s,
                                        term_cols,
                                    ));
                                    old_ln += 1;
                                }
                                diffy::Line::Context(text) => {
                                    let s = text.trim_end_matches('\n');
                                    out.extend(push_wrapped_diff_line(
                                        new_ln,
                                        DiffLineType::Context,
                                        s,
                                        term_cols,
                                    ));
                                    old_ln += 1;
                                    new_ln += 1;
                                }
                            }
                        }
                    }
                }
            }
        }
```

**File:** codex-rs/tui/src/diff_render.rs (L268-279)

```rust
fn display_path_for(path: &Path, cwd: &Path) -> String {
    let path_in_same_repo = match (get_git_repo_root(cwd), get_git_repo_root(path)) {
        (Some(cwd_repo), Some(path_repo)) => cwd_repo == path_repo,
        _ => false,
    };
    let chosen = if path_in_same_repo {
        pathdiff::diff_paths(path, cwd).unwrap_or_else(|| path.to_path_buf())
    } else {
        relativize_to_home(path).unwrap_or_else(|| path.to_path_buf())
    };
    chosen.display().to_string()
}
```

**File:** codex-rs/tui/src/diff_render.rs (L298-359)

```rust
fn push_wrapped_diff_line(
    line_number: usize,
    kind: DiffLineType,
    text: &str,
    term_cols: usize,
) -> Vec<RtLine<'static>> {
    let indent = "    ";
    let ln_str = line_number.to_string();
    let mut remaining_text: &str = text;

    // Reserve a fixed number of spaces after the line number so that content starts
    // at a consistent column. Content includes a 1-character diff sign prefix
    // ("+"/"-" for inserts/deletes, or a space for context lines) so alignment
    // stays consistent across all diff lines.
    let gap_after_ln = SPACES_AFTER_LINE_NUMBER.saturating_sub(ln_str.len());
    let prefix_cols = indent.len() + ln_str.len() + gap_after_ln;

    let mut first = true;
    let (sign_char, line_style) = match kind {
        DiffLineType::Insert => ('+', style_add()),
        DiffLineType::Delete => ('-', style_del()),
        DiffLineType::Context => (' ', style_context()),
    };
    let mut lines: Vec<RtLine<'static>> = Vec::new();

    loop {
        // Fit the content for the current terminal row:
        // compute how many columns are available after the prefix, then split
        // at a UTF-8 character boundary so this row's chunk fits exactly.
        let available_content_cols = term_cols.saturating_sub(prefix_cols + 1).max(1);
        let split_at_byte_index = remaining_text
            .char_indices()
            .nth(available_content_cols)
            .map(|(i, _)| i)
            .unwrap_or_else(|| remaining_text.len());
        let (chunk, rest) = remaining_text.split_at(split_at_byte_index);
        remaining_text = rest;

        if first {
            // Build gutter (indent + line number + spacing) as a dimmed span
            let gutter = format!("{indent}{ln_str}{}", " ".repeat(gap_after_ln));
            // Content with a sign ('+'/'-'/' ') styled per diff kind
            let content = format!("{sign_char}{chunk}");
            lines.push(RtLine::from(vec![
                RtSpan::styled(gutter, style_gutter()),
                RtSpan::styled(content, line_style),
            ]));
            first = false;
        } else {
            // Continuation lines keep a space for the sign column so content aligns
            let gutter = format!("{indent}{} ", " ".repeat(ln_str.len() + gap_after_ln));
            lines.push(RtLine::from(vec![
                RtSpan::styled(gutter, style_gutter()),
                RtSpan::styled(chunk.to_string(), line_style),
            ]));
        }
        if remaining_text.is_empty() {
            break;
        }
    }
    lines
}
```

**File:** codex-rs/core/src/codex.rs (L696-708)

```rust
        let msg = match apply_patch {
            Some(ApplyPatchCommandContext {
                user_explicitly_approved_this_action,
                changes,
            }) => {
                turn_diff_tracker.on_patch_begin(&changes);

                EventMsg::PatchApplyBegin(PatchApplyBeginEvent {
                    call_id,
                    auto_approved: !user_explicitly_approved_this_action,
                    changes,
                })
            }
```

**File:** codex-rs/core/src/codex.rs (L747-754)

```rust
        let msg = if is_apply_patch {
            EventMsg::PatchApplyEnd(PatchApplyEndEvent {
                call_id: call_id.to_string(),
                stdout,
                stderr,
                success: *exit_code == 0,
            })
        } else {
```

**File:** codex-rs/exec/src/event_processor_with_human_output.rs (L418-448)

```rust
                        FileChange::Update {
                            unified_diff,
                            move_path,
                        } => {
                            let header = if let Some(dest) = move_path {
                                format!(
                                    "{} {} -> {}",
                                    format_file_change(change),
                                    path.to_string_lossy(),
                                    dest.to_string_lossy()
                                )
                            } else {
                                format!("{} {}", format_file_change(change), path.to_string_lossy())
                            };
                            println!("{}", header.style(self.magenta));

                            // Colorize diff lines. We keep file header lines
                            // (--- / +++) without extra coloring so they are
                            // still readable.
                            for diff_line in unified_diff.lines() {
                                if diff_line.starts_with('+') && !diff_line.starts_with("+++") {
                                    println!("{}", diff_line.style(self.green));
                                } else if diff_line.starts_with('-')
                                    && !diff_line.starts_with("---")
                                {
                                    println!("{}", diff_line.style(self.red));
                                } else {
                                    println!("{diff_line}");
                                }
                            }
                        }
```
