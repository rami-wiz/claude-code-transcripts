# Tool Rendering Improvement Plan

## Current State

Tools currently have custom renderers:
- `Write` - Shows file path with syntax-highlighted content
- `Edit` - Shows old/new string diff
- `Bash` - Shows command with description
- `TodoWrite` - Shows todo list with checkboxes

All other tools fall back to raw JSON display, which is hard to read.

## Tools Needing Custom Renderers

### Priority 1 - High Usage

| Tool | Usage | Current | Proposed Rendering |
|------|-------|---------|-------------------|
| **Read** | 603 | JSON blob | 📖 **Read:** `filename` (full path as subtitle) |
| **Grep** | 21 | JSON blob | 🔍 **Grep:** `pattern` in `path` |
| **Glob** | 14 | JSON blob | 📁 **Glob:** `pattern` |

### Priority 2 - User-Facing Tools

| Tool | Usage | Current | Proposed Rendering |
|------|-------|---------|-------------------|
| **Task** | 10 | JSON blob | ⚙ **Task** *(subagent_type)*: description<br>Prompt in expandable section |
| **AskUserQuestion** | 2 | JSON blob | Formatted question cards with options |

### Priority 3 - Minimal Rendering

| Tool | Usage | Current | Proposed Rendering |
|------|-------|---------|-------------------|
| **ExitPlanMode** | 4 | JSON blob | 📋 **Exit Plan Mode** |
| **EnterPlanMode** | 2 | JSON blob | 📋 **Enter Plan Mode** |
| **TaskOutput** | 1 | JSON blob | ⏳ **TaskOutput:** `task_id` |

## Implementation Details

### 1. Read Tool Renderer

```python
def render_read_tool(tool_input: dict, tool_id: str) -> str:
    file_path = tool_input.get("file_path", "")
    filename = Path(file_path).name
    offset = tool_input.get("offset")
    limit = tool_input.get("limit")

    # Show range if specified
    range_info = ""
    if offset or limit:
        range_info = f" (lines {offset or 1}-{(offset or 0) + (limit or '?')})"

    return _macros.read_tool(filename, file_path, range_info, tool_id)
```

HTML output:
```html
<div class="file-tool read-tool">
  <div class="file-tool-header read-header">
    <span class="file-tool-icon">📖</span> Read: <span class="file-tool-path">filename.py</span>
  </div>
  <div class="file-tool-fullpath">/full/path/to/filename.py (lines 1-50)</div>
</div>
```

### 2. Grep Tool Renderer

```python
def render_grep_tool(tool_input: dict, tool_id: str) -> str:
    pattern = tool_input.get("pattern", "")
    path = tool_input.get("path", ".")

    return _macros.grep_tool(pattern, path, tool_id)
```

HTML output:
```html
<div class="file-tool grep-tool">
  <div class="file-tool-header grep-header">
    <span class="file-tool-icon">🔍</span> Grep: <code class="pattern">pattern</code>
  </div>
  <div class="file-tool-fullpath">in /path/to/search</div>
</div>
```

### 3. Glob Tool Renderer

```python
def render_glob_tool(tool_input: dict, tool_id: str) -> str:
    pattern = tool_input.get("pattern", "")
    path = tool_input.get("path", ".")

    return _macros.glob_tool(pattern, path, tool_id)
```

HTML output:
```html
<div class="file-tool glob-tool">
  <div class="file-tool-header glob-header">
    <span class="file-tool-icon">📁</span> Glob: <code class="pattern">**/*.py</code>
  </div>
  <div class="file-tool-fullpath">in /path/to/search</div>
</div>
```

### 4. Task Tool Renderer

```python
def render_task_tool(tool_input: dict, tool_id: str) -> str:
    description = tool_input.get("description", "")
    prompt = tool_input.get("prompt", "")
    subagent_type = tool_input.get("subagent_type", "")

    return _macros.task_tool(description, prompt, subagent_type, tool_id)
```

HTML output:
```html
<div class="tool-use task-tool">
  <div class="tool-header">
    <span class="tool-icon">⚙</span> Task
    <span class="task-type">Explore</span>
  </div>
  <div class="task-description">Explore codebase structure</div>
  <details class="task-prompt">
    <summary>View prompt</summary>
    <pre>Full prompt text here...</pre>
  </details>
</div>
```

### 5. AskUserQuestion Tool Renderer

```python
def render_ask_user_question_tool(tool_input: dict, tool_id: str) -> str:
    questions = tool_input.get("questions", [])
    return _macros.ask_user_question(questions, tool_id)
```

HTML output:
```html
<div class="tool-use ask-user-tool">
  <div class="tool-header">
    <span class="tool-icon">❓</span> Question
    <span class="question-header">Theme storage</span>
  </div>
  <div class="question-text">Where should the saved theme.json file be stored by default?</div>
  <div class="question-options">
    <div class="option">
      <strong>Output directory</strong>
      <span class="option-desc">Save alongside generated HTML files</span>
    </div>
    <div class="option">
      <strong>User config dir</strong>
      <span class="option-desc">Save to ~/.claude-code-transcripts/theme.json</span>
    </div>
  </div>
</div>
```

### 6. Minimal Renderers (EnterPlanMode, ExitPlanMode, TaskOutput)

These just need clean labels without JSON:

```python
def render_enter_plan_mode(tool_input: dict, tool_id: str) -> str:
    return _macros.simple_tool("📋", "Enter Plan Mode", tool_id)

def render_exit_plan_mode(tool_input: dict, tool_id: str) -> str:
    return _macros.simple_tool("📋", "Exit Plan Mode", tool_id)

def render_task_output(tool_input: dict, tool_id: str) -> str:
    task_id = tool_input.get("task_id", "unknown")
    return _macros.simple_tool("⏳", f"TaskOutput: {task_id}", tool_id)
```

## CSS Additions

```css
/* Read tool */
.read-tool { background: linear-gradient(135deg, #e3f2fd 0%, #f3e5f5 100%); border: 1px solid #7986cb; }
.read-header { color: #3949ab; }

/* Grep tool */
.grep-tool { background: linear-gradient(135deg, #fff3e0 0%, #fce4ec 100%); border: 1px solid #ff8a65; }
.grep-header { color: #e64a19; }
.grep-header code.pattern { background: rgba(0,0,0,0.1); padding: 2px 6px; border-radius: 4px; }

/* Glob tool */
.glob-tool { background: linear-gradient(135deg, #e8f5e9 0%, #f1f8e9 100%); border: 1px solid #81c784; }
.glob-header { color: #2e7d32; }

/* Task tool */
.task-tool { background: linear-gradient(135deg, #ede7f6 0%, #e1f5fe 100%); border: 1px solid #9575cd; }
.task-type { font-size: 0.8rem; background: rgba(0,0,0,0.1); padding: 2px 8px; border-radius: 12px; margin-left: 8px; }
.task-description { font-style: italic; color: var(--text-muted); margin: 8px 0; }
.task-prompt summary { cursor: pointer; color: var(--text-muted); font-size: 0.85rem; }

/* Ask user question */
.ask-user-tool { background: linear-gradient(135deg, #fff8e1 0%, #fffde7 100%); border: 1px solid #ffd54f; }
.question-header { font-size: 0.8rem; background: rgba(0,0,0,0.1); padding: 2px 8px; border-radius: 12px; }
.question-text { font-weight: 500; margin: 8px 0; }
.question-options { display: flex; flex-direction: column; gap: 6px; }
.option { padding: 8px; background: rgba(255,255,255,0.7); border-radius: 6px; }
.option-desc { display: block; font-size: 0.85rem; color: var(--text-muted); }
```

## Files to Modify

1. `src/claude_code_transcripts/__init__.py`
   - Add render functions for each tool
   - Add tool-specific macros
   - Update `render_content_block()` to use new renderers

2. `tests/test_generate_html.py`
   - Add tests for each new renderer

## Implementation Order

1. Read, Grep, Glob (highest impact, simple structure)
2. Task (complex but common)
3. AskUserQuestion (complex structure)
4. EnterPlanMode, ExitPlanMode, TaskOutput (simple labels)
