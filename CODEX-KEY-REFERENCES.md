# Based on our conversation about building a standalone Codex session viewer, here are the key files you should reference during development

## Session File Format and Parsing

**Core session recording structure**:

This shows the `SessionMeta` structure that appears as the first line in each `.jsonl` file, containing session ID, timestamp, and optional instructions.

**Session file creation and JSONL format**:

This demonstrates how session files are created with the naming pattern `rollout-{timestamp}-{uuid}.jsonl` in the directory structure `.codex/sessions/YYYY/MM/DD/`.

**JSONL parsing logic**:

This shows how to parse session files where the first line is metadata and subsequent lines are `ResponseItem` objects.

## ResponseItem Event Types

**Protocol definitions**:

This file contains the core protocol definitions you'll need to understand for parsing different event types.

**Session configuration events**:

Shows the `SessionConfiguredEvent` structure that provides session metadata.

## Session Discovery and Listing

**Session listing utilities**:

Defines the `ConversationsPage` and `ConversationItem` structures for paginated session browsing.

**Directory traversal logic**:

Shows how to scan the hierarchical directory structure and parse session filenames.

## Test Examples and Data Structures

**Fake session creation for testing**:

Provides a concrete example of how session files are structured with metadata and message entries.

**Session resumption test**:

Shows real examples of `ResponseItem` structures for different message types (user, system, assistant).

## Core Library Exports

**Main library interface**:

Lists the key exports you'll need, including `RolloutRecorder`, `ConversationItem`, and `ResponseItem`.

## Additional Context Files

**Message history format**:

While this is for a different history format, it shows JSONL parsing patterns you can reference.

**Session logging example**:

Demonstrates JSONL writing patterns and timestamp formatting.

## Notes

These files provide the complete picture of Codex's session format, from the directory structure and file naming conventions to the internal JSONL format and `ResponseItem` event types. The test files are particularly valuable as they show concrete examples of the data structures you'll need to parse in your standalone application.

Wiki pages you might want to explore:

- [Core Engine (codex-rs) (openai/codex)](/wiki/openai/codex#2)
- [MCP Message Processing and Tool Calls (openai/codex)](/wiki/openai/codex#5.2)

### Citations

**File:** codex-rs/core/src/rollout/recorder.rs (L32-46)

```rust

#[derive(Serialize, Deserialize, Clone, Default)]
pub struct SessionMeta {
    pub id: Uuid,
    pub timestamp: String,
    pub instructions: Option<String>,
}

#[derive(Serialize)]
struct SessionMetaWithGit {
    #[serde(flatten)]
    meta: SessionMeta,
    #[serde(skip_serializing_if = "Option::is_none")]
    git: Option<GitInfo>,
}
```

**File:** codex-rs/core/src/rollout/recorder.rs (L165-207)

```rust
    pub async fn get_rollout_history(path: &Path) -> std::io::Result<InitialHistory> {
        info!("Resuming rollout from {path:?}");
        let text = tokio::fs::read_to_string(path).await?;
        let mut lines = text.lines();
        let _ = lines
            .next()
            .ok_or_else(|| IoError::other("empty session file"))?;
        let mut items = Vec::new();

        for line in lines {
            if line.trim().is_empty() {
                continue;
            }
            let v: Value = match serde_json::from_str(line) {
                Ok(v) => v,
                Err(_) => continue,
            };
            if v.get("record_type")
                .and_then(|rt| rt.as_str())
                .map(|s| s == "state")
                .unwrap_or(false)
            {
                continue;
            }
            match serde_json::from_value::<ResponseItem>(v.clone()) {
                Ok(item) => {
                    if is_persisted_response_item(&item) {
                        items.push(item);
                    }
                }
                Err(e) => {
                    warn!("failed to parse item: {v:?}, error: {e}");
                }
            }
        }

        info!("Resumed rollout successfully from {path:?}");
        if items.is_empty() {
            Ok(InitialHistory::New)
        } else {
            Ok(InitialHistory::Resumed(items))
        }
    }
```

**File:** codex-rs/core/src/rollout/recorder.rs (L236-268)

```rust
fn create_log_file(config: &Config, session_id: Uuid) -> std::io::Result<LogFileInfo> {
    // Resolve ~/.codex/sessions/YYYY/MM/DD and create it if missing.
    let timestamp = OffsetDateTime::now_local()
        .map_err(|e| IoError::other(format!("failed to get local time: {e}")))?;
    let mut dir = config.codex_home.clone();
    dir.push(SESSIONS_SUBDIR);
    dir.push(timestamp.year().to_string());
    dir.push(format!("{:02}", u8::from(timestamp.month())));
    dir.push(format!("{:02}", timestamp.day()));
    fs::create_dir_all(&dir)?;

    // Custom format for YYYY-MM-DDThh-mm-ss. Use `-` instead of `:` for
    // compatibility with filesystems that do not allow colons in filenames.
    let format: &[FormatItem] =
        format_description!("[year]-[month]-[day]T[hour]-[minute]-[second]");
    let date_str = timestamp
        .format(format)
        .map_err(|e| IoError::other(format!("failed to format timestamp: {e}")))?;

    let filename = format!("rollout-{date_str}-{session_id}.jsonl");

    let path = dir.join(filename);
    let file = std::fs::OpenOptions::new()
        .append(true)
        .create(true)
        .open(&path)?;

    Ok(LogFileInfo {
        file,
        session_id,
        timestamp,
    })
}
```

**File:** codex-rs/protocol/src/protocol.rs (L1-32)

```rust
//! Defines the protocol for a Codex session between a client and an agent.
//!
//! Uses a SQ (Submission Queue) / EQ (Event Queue) pattern to asynchronously communicate
//! between user and agent.

use std::collections::HashMap;
use std::fmt;
use std::path::Path;
use std::path::PathBuf;
use std::str::FromStr;
use std::time::Duration;

use crate::custom_prompts::CustomPrompt;
use mcp_types::CallToolResult;
use mcp_types::Tool as McpTool;
use serde::Deserialize;
use serde::Serialize;
use serde_with::serde_as;
use strum_macros::Display;
use ts_rs::TS;
use uuid::Uuid;

use crate::config_types::ReasoningEffort as ReasoningEffortConfig;
use crate::config_types::ReasoningSummary as ReasoningSummaryConfig;
use crate::message_history::HistoryEntry;
use crate::models::ResponseItem;
use crate::parse_command::ParsedCommand;
use crate::plan_tool::UpdatePlanArgs;

/// Open/close tags for special user-input blocks. Used across crates to avoid
/// duplicated hardcoded strings.
pub const USER_INSTRUCTIONS_OPEN_TAG: &str = "<user_instructions>";
```

**File:** codex-rs/protocol/src/protocol.rs (L880-898)

```rust
#[derive(Debug, Default, Clone, Deserialize, Serialize)]
pub struct SessionConfiguredEvent {
    /// Unique id for this session.
    pub session_id: Uuid,

    /// Tell the client what model is being queried.
    pub model: String,

    /// Identifier of the history log file (inode on Unix, 0 otherwise).
    pub history_log_id: u64,

    /// Current number of entries in the history log.
    pub history_entry_count: usize,

    /// Optional initial messages (as events) for resumed sessions.
    /// When present, UIs can use these to seed the history.
    #[serde(skip_serializing_if = "Option::is_none")]
    pub initial_messages: Option<Vec<EventMsg>>,
}
```

**File:** codex-rs/core/src/rollout/list.rs (L14-34)

```rust
/// Returned page of conversation summaries.
#[derive(Debug, Default, PartialEq)]
pub struct ConversationsPage {
    /// Conversation summaries ordered newest first.
    pub items: Vec<ConversationItem>,
    /// Opaque pagination token to resume after the last item, or `None` if end.
    pub next_cursor: Option<Cursor>,
    /// Total number of files touched while scanning this request.
    pub num_scanned_files: usize,
    /// True if a hard scan cap was hit; consider resuming with `next_cursor`.
    pub reached_scan_cap: bool,
}

/// Summary information for a conversation rollout file.
#[derive(Debug, PartialEq)]
pub struct ConversationItem {
    /// Absolute path to the rollout file.
    pub path: PathBuf,
    /// First up to 5 JSONL records parsed as JSON (includes meta line).
    pub head: Vec<serde_json::Value>,
}
```

**File:** codex-rs/core/src/rollout/list.rs (L115-186)

```rust
async fn traverse_directories_for_paths(
    root: PathBuf,
    page_size: usize,
    anchor: Option<Cursor>,
) -> io::Result<ConversationsPage> {
    let mut items: Vec<ConversationItem> = Vec::with_capacity(page_size);
    let mut scanned_files = 0usize;
    let mut anchor_passed = anchor.is_none();
    let (anchor_ts, anchor_id) = match anchor {
        Some(c) => (c.ts, c.id),
        None => (OffsetDateTime::UNIX_EPOCH, Uuid::nil()),
    };

    let year_dirs = collect_dirs_desc(&root, |s| s.parse::<u16>().ok()).await?;

    'outer: for (_year, year_path) in year_dirs.iter() {
        if scanned_files >= MAX_SCAN_FILES {
            break;
        }
        let month_dirs = collect_dirs_desc(year_path, |s| s.parse::<u8>().ok()).await?;
        for (_month, month_path) in month_dirs.iter() {
            if scanned_files >= MAX_SCAN_FILES {
                break 'outer;
            }
            let day_dirs = collect_dirs_desc(month_path, |s| s.parse::<u8>().ok()).await?;
            for (_day, day_path) in day_dirs.iter() {
                if scanned_files >= MAX_SCAN_FILES {
                    break 'outer;
                }
                let mut day_files = collect_files(day_path, |name_str, path| {
                    if !name_str.starts_with("rollout-") || !name_str.ends_with(".jsonl") {
                        return None;
                    }

                    parse_timestamp_uuid_from_filename(name_str)
                        .map(|(ts, id)| (ts, id, name_str.to_string(), path.to_path_buf()))
                })
                .await?;
                // Stable ordering within the same second: (timestamp desc, uuid desc)
                day_files.sort_by_key(|(ts, sid, _name_str, _path)| (Reverse(*ts), Reverse(*sid)));
                for (ts, sid, _name_str, path) in day_files.into_iter() {
                    scanned_files += 1;
                    if scanned_files >= MAX_SCAN_FILES && items.len() >= page_size {
                        break 'outer;
                    }
                    if !anchor_passed {
                        if ts < anchor_ts || (ts == anchor_ts && sid < anchor_id) {
                            anchor_passed = true;
                        } else {
                            continue;
                        }
                    }
                    if items.len() == page_size {
                        break 'outer;
                    }
                    let head = read_first_jsonl_records(&path, HEAD_RECORD_LIMIT)
                        .await
                        .unwrap_or_default();
                    items.push(ConversationItem { path, head });
                }
            }
        }
    }

    let next = build_next_cursor(&items);
    Ok(ConversationsPage {
        items,
        next_cursor: next,
        num_scanned_files: scanned_files,
        reached_scan_cap: scanned_files >= MAX_SCAN_FILES,
    })
}
```

**File:** codex-rs/mcp-server/tests/suite/list_resume.rs (L148-172)

```rust
fn create_fake_rollout(codex_home: &Path, filename_ts: &str, meta_rfc3339: &str, preview: &str) {
    let uuid = Uuid::new_v4();
    // sessions/YYYY/MM/DD/ derived from filename_ts (YYYY-MM-DDThh-mm-ss)
    let year = &filename_ts[0..4];
    let month = &filename_ts[5..7];
    let day = &filename_ts[8..10];
    let dir = codex_home.join("sessions").join(year).join(month).join(day);
    fs::create_dir_all(&dir).unwrap_or_else(|e| panic!("create sessions dir: {e}"));

    let file_path = dir.join(format!("rollout-{filename_ts}-{uuid}.jsonl"));
    let mut lines = Vec::new();
    // Meta line with timestamp
    lines.push(json!({"timestamp": meta_rfc3339}).to_string());
    // Minimal user message entry as a persisted response item
    lines.push(
        json!({
            "type":"message",
            "role":"user",
            "content":[{"type":"input_text","text": preview}]
        })
        .to_string(),
    );
    fs::write(file_path, lines.join("\n") + "\n")
        .unwrap_or_else(|e| panic!("write rollout file: {e}"));
}
```

**File:** codex-rs/core/tests/suite/client.rs (L121-162)

```rust
    // Create a fake rollout session file with prior user + system + assistant messages.
    let tmpdir = TempDir::new().unwrap();
    let session_path = tmpdir.path().join("resume-session.jsonl");
    let mut f = std::fs::File::create(&session_path).unwrap();
    // First line: meta (content not used by reader other than non-empty)
    writeln!(
        f,
        "{}",
        serde_json::json!({"meta":"test","instructions":"be nice"})
    )
    .unwrap();

    // Prior item: user message (should be delivered)
    let prior_user = codex_protocol::models::ResponseItem::Message {
        id: None,
        role: "user".to_string(),
        content: vec![codex_protocol::models::ContentItem::InputText {
            text: "resumed user message".to_string(),
        }],
    };
    writeln!(f, "{}", serde_json::to_string(&prior_user).unwrap()).unwrap();

    // Prior item: system message (excluded from API history)
    let prior_system = codex_protocol::models::ResponseItem::Message {
        id: None,
        role: "system".to_string(),
        content: vec![codex_protocol::models::ContentItem::OutputText {
            text: "resumed system instruction".to_string(),
        }],
    };
    writeln!(f, "{}", serde_json::to_string(&prior_system).unwrap()).unwrap();

    // Prior item: assistant message
    let prior_item = codex_protocol::models::ResponseItem::Message {
        id: None,
        role: "assistant".to_string(),
        content: vec![codex_protocol::models::ContentItem::OutputText {
            text: "resumed assistant message".to_string(),
        }],
    };
    writeln!(f, "{}", serde_json::to_string(&prior_item).unwrap()).unwrap();
    drop(f);
```

**File:** codex-rs/core/src/lib.rs (L62-88)

```rust
mod tool_apply_patch;
pub mod turn_diff_tracker;
pub use rollout::RolloutRecorder;
pub use rollout::list::ConversationItem;
pub use rollout::list::ConversationsPage;
pub use rollout::list::Cursor;
mod user_notification;
pub mod util;
pub use apply_patch::CODEX_APPLY_PATCH_ARG1;
pub use safety::get_platform_sandbox;
// Re-export the protocol types from the standalone `codex-protocol` crate so existing
// `codex_core::protocol::...` references continue to work across the workspace.
pub use codex_protocol::protocol;
// Re-export protocol config enums to ensure call sites can use the same types
// as those in the protocol crate when constructing protocol messages.
pub use codex_protocol::config_types as protocol_config_types;

pub use client::ModelClient;
pub use client_common::Prompt;
pub use client_common::ResponseEvent;
pub use client_common::ResponseStream;
pub use codex_protocol::models::ContentItem;
pub use codex_protocol::models::LocalShellAction;
pub use codex_protocol::models::LocalShellExecAction;
pub use codex_protocol::models::LocalShellStatus;
pub use codex_protocol::models::ReasoningItemContent;
pub use codex_protocol::models::ResponseItem;
```

**File:** codex-rs/core/src/message_history.rs (L1-31)

```rust
//! Persistence layer for the global, append-only *message history* file.
//!
//! The history is stored at `~/.codex/history.jsonl` with **one JSON object per
//! line** so that it can be efficiently appended to and parsed with standard
//! JSON-Lines tooling. Each record has the following schema:
//!
//! ````text
//! {"session_id":"<uuid>","ts":<unix_seconds>,"text":"<message>"}
//! ````
//!
//! To minimise the chance of interleaved writes when multiple processes are
//! appending concurrently, callers should *prepare the full line* (record +
//! trailing `\n`) and write it with a **single `write(2)` system call** while
//! the file descriptor is opened with the `O_APPEND` flag. POSIX guarantees
//! that writes up to `PIPE_BUF` bytes are atomic in that case.

use std::fs::File;
use std::fs::OpenOptions;
use std::io::Result;
use std::io::Write;
use std::path::PathBuf;

use serde::Deserialize;
use serde::Serialize;
use std::time::Duration;
use tokio::fs;
use tokio::io::AsyncReadExt;
use uuid::Uuid;

use crate::config::Config;
use crate::config_types::HistoryPersistence;
```

**File:** codex-rs/tui/src/session_log.rs (L79-123)

```rust
fn now_ts() -> String {
    // RFC3339 for readability; consumers can parse as needed.
    chrono::Utc::now().to_rfc3339_opts(chrono::SecondsFormat::Millis, true)
}

pub(crate) fn maybe_init(config: &Config) {
    let enabled = std::env::var("CODEX_TUI_RECORD_SESSION")
        .map(|v| matches!(v.as_str(), "1" | "true" | "TRUE" | "yes" | "YES"))
        .unwrap_or(false);
    if !enabled {
        return;
    }

    let path = if let Ok(path) = std::env::var("CODEX_TUI_SESSION_LOG_PATH") {
        PathBuf::from(path)
    } else {
        let mut p = match codex_core::config::log_dir(config) {
            Ok(dir) => dir,
            Err(_) => std::env::temp_dir(),
        };
        let filename = format!(
            "session-{}.jsonl",
            chrono::Utc::now().format("%Y%m%dT%H%M%SZ")
        );
        p.push(filename);
        p
    };

    if let Err(e) = LOGGER.open(path.clone()) {
        tracing::error!("failed to open session log {:?}: {}", path, e);
        return;
    }

    // Write a header record so we can attach context.
    let header = json!({
        "ts": now_ts(),
        "dir": "meta",
        "kind": "session_start",
        "cwd": config.cwd,
        "model": config.model,
        "model_provider_id": config.model_provider_id,
        "model_provider_name": config.model_provider.name,
    });
    LOGGER.write_json_line(header);
}
```
