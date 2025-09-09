You're asking about the ID fields in the JSON structure from a Codex session rollout, specifically the `"id":"fc_68b32723aff081959bf4818b0b2f7c3a0ab6361ec9f89aa1"` field in a `FunctionCall` response item.

## ID Field Purpose and Structure

The `id` field you're seeing is a **call identifier** used to track function calls throughout their lifecycle in Codex sessions [1](#2-0) . In the `ResponseItem::FunctionCall` enum variant, this field is defined as `call_id: String` and serves as a unique identifier for correlating function calls with their outputs.

## ID Generation and Usage

The ID `"fc_68b32723aff081959bf4818b0b2f7c3a0ab6361ec9f89aa1"` follows a pattern where:

- `fc_` appears to be a prefix indicating "function call"
- The remaining characters form a unique identifier

This ID is used throughout the conversation flow to match function calls with their corresponding outputs. When Codex processes the function call, it creates a corresponding `FunctionCallOutput` item that references the same `call_id` [2](#2-1) .

## ID Tracking in Chat Completions

During chat completions streaming, the system accumulates function call state across multiple chunks, tracking the `call_id` as part of the streaming process [3](#2-2) . The ID is extracted from the streaming response and used to build the final `FunctionCall` response item [4](#2-3) .

## ID Usage in Function Call Processing

When handling function calls, the system uses these IDs to correlate calls with their execution results. For example, in shell command execution, the system tracks both `call_id` and `id` fields to ensure proper correlation [5](#2-4) . The ID becomes crucial for matching the function call request with its eventual output response.

## Notes

The ID system ensures that in multi-turn conversations with multiple concurrent function calls, each call can be properly tracked and its output correctly attributed. This is essential for maintaining conversation coherence and allowing the UI to display function call results in the correct context.

Wiki pages you might want to explore:

- [Core Engine (codex-rs) (openai/codex)](/wiki/openai/codex#2)

### Citations

**File:** codex-rs/protocol/src/models.rs (L67-77)

```rust
    FunctionCall {
        #[serde(skip_serializing)]
        id: Option<String>,
        name: String,
        // The Responses API returns the function call arguments as a *string* that contains
        // JSON, not as an already‑parsed object. We keep it as a raw string here and let
        // Session::handle_function_call parse it into a Value. This exactly matches the
        // Chat Completions + Responses API behavior.
        arguments: String,
        call_id: String,
    },
```

**File:** codex-rs/protocol/src/models.rs (L84-87)

```rust
    FunctionCallOutput {
        call_id: String,
        output: FunctionCallOutputPayload,
    },
```

**File:** codex-rs/core/src/chat_completions.rs (L528-531)

```rust
                // Extract call_id if present.
                if let Some(id) = tool_call.get("id").and_then(|v| v.as_str()) {
                    fn_call_state.call_id.get_or_insert_with(|| id.to_string());
                }
```

**File:** codex-rs/core/src/chat_completions.rs (L565-572)

```rust
                        let item = ResponseItem::FunctionCall {
                            id: None,
                            name: fn_call_state.name.clone().unwrap_or_else(|| "".to_string()),
                            arguments: fn_call_state.arguments.clone(),
                            call_id: fn_call_state.call_id.clone().unwrap_or_else(String::new),
                        };

                        let _ = tx_event.send(Ok(ResponseEvent::OutputItemDone(item))).await;
```

**File:** codex-rs/core/src/codex.rs (L1959-1972)

```rust
            let effective_call_id = match (call_id, id) {
                (Some(call_id), _) => call_id,
                (None, Some(id)) => id,
                (None, None) => {
                    error!("LocalShellCall without call_id or id");
                    return Ok(Some(ResponseInputItem::FunctionCallOutput {
                        call_id: "".to_string(),
                        output: FunctionCallOutputPayload {
                            content: "LocalShellCall without call_id or id".to_string(),
                            success: None,
                        },
                    }));
                }
            };
```
