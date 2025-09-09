Looking at your PRD for the Codex Session Viewer, I'd suggest several key changes based on the actual Codex codebase structure and existing infrastructure:

## Data Model Alignment

Your data model needs to align with Codex's actual session format. [1](#4-0)  The sessions are stored as JSONL files, not JSON, with the first line containing `SessionMeta` and subsequent lines containing `ResponseItem` objects.

Update your data model to:

```
- Session {id, timestamp, instructions, git?, items[]}
- ResponseItem (from codex-protocol) with variants for different event types
- Use existing Codex event schema rather than custom Event structure
```

## Technology Stack Reconsideration

Since you're developing within the Codex repo, consider leveraging existing infrastructure: [2](#4-1)

**Backend**: Use Rust with `tiny_http` (already used in `codex-login`) rather than a separate Node.js/React stack. This gives you direct access to session parsing utilities. [3](#4-2)

**Frontend**: Consider a simpler approach with embedded HTML/CSS/JS assets, following the pattern in the login server, rather than a full React application.

## File Format Correction

Change "`.json` log files" to "`.jsonl` files" since Codex uses JSONL format for session recording. [4](#4-3)

## Integration with Existing CLI

Add a section about CLI integration since you'll be adding this as a subcommand: [5](#4-4)

```
- Integration: New `codex session-viewer` subcommand
- Leverage existing session listing/parsing from codex-core
- Follow workspace patterns for crate organization
```

## Event Type Accuracy

Update your event types to match actual Codex protocol events. [6](#4-5)  The protocol uses specific event types like `AgentMessage`, `ExecCommandBegin`, `PatchApplyBegin`, etc., rather than generic categories.

## Additional Considerations

**MCP Integration**: Consider how to handle MCP tool calls in sessions, as this is a key Codex feature. [7](#4-6)

**Session Discovery**: Leverage the existing session listing functionality rather than building from scratch. [8](#4-7)

The core concept is solid, but aligning with Codex's actual architecture and data formats will make implementation much more straightforward and maintainable.

## Notes

Your PRD shows good understanding of the user needs, but the technical implementation should leverage Codex's existing Rust infrastructure rather than introducing a separate JavaScript stack. This approach will be more maintainable and give you direct access to all the session parsing logic that's already battle-tested.

Wiki pages you might want to explore:

- [Core Engine (codex-rs) (openai/codex)](/wiki/openai/codex#2)
- [Protocol and Event Processing (openai/codex)](/wiki/openai/codex#2.1.1)

### Citations

**File:** codex-rs/core/src/rollout/recorder.rs (L33-46)

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

**File:** codex-rs/core/src/rollout/recorder.rs (L61-63)

```rust
/// Records all [`ResponseItem`]s for a session and flushes them to disk after
/// every update.
///
```

**File:** codex-rs/cli/Cargo.toml (L6-8)

```text
[[bin]]
name = "codex"
path = "src/main.rs"
```

**File:** codex-rs/cli/Cargo.toml (L17-40)

```text
[dependencies]
anyhow = "1"
clap = { version = "4", features = ["derive"] }
clap_complete = "4"
codex-arg0 = { path = "../arg0" }
codex-chatgpt = { path = "../chatgpt" }
codex-common = { path = "../common", features = ["cli"] }
codex-core = { path = "../core" }
codex-exec = { path = "../exec" }
codex-login = { path = "../login" }
codex-mcp-server = { path = "../mcp-server" }
codex-protocol = { path = "../protocol" }
codex-tui = { path = "../tui" }
serde_json = "1"
tokio = { version = "1", features = [
    "io-std",
    "macros",
    "process",
    "rt-multi-thread",
    "signal",
] }
tracing = "0.1.41"
tracing-subscriber = "0.3.19"
```

**File:** codex-rs/core/src/lib.rs (L64-67)

```rust
pub use rollout::RolloutRecorder;
pub use rollout::list::ConversationItem;
pub use rollout::list::ConversationsPage;
pub use rollout::list::Cursor;
```

**File:** codex-rs/protocol/src/protocol.rs (L1-5)

```rust
//! Defines the protocol for a Codex session between a client and an agent.
//!
//! Uses a SQ (Submission Queue) / EQ (Event Queue) pattern to asynchronously communicate
//! between user and agent.

```

**File:** codex-rs/mcp-server/src/codex_tool_runner.rs (L36-47)

```rust
/// Run a complete Codex session and stream events back to the client.
///
/// On completion (success or error) the function sends the appropriate
/// `tools/call` response so the LLM can continue the conversation.
pub async fn run_codex_tool_session(
    id: RequestId,
    initial_prompt: String,
    config: CodexConfig,
    outgoing: Arc<OutgoingMessageSender>,
    conversation_manager: Arc<ConversationManager>,
    running_requests_id_to_codex_uuid: Arc<Mutex<HashMap<RequestId, Uuid>>>,
) {
```
