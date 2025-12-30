# Kiến Trúc Hệ Thống Agent trong Claude Code

## Tổng Quan

Claude Code là một công cụ agentic coding hoạt động trong terminal, sử dụng các mô hình Claude 4 mới nhất (Sonnet 4.5, Opus 4.5) để hỗ trợ developers viết code, debug và quản lý git workflows thông qua các lệnh tự nhiên.

## Nguyên Tắc Thiết Kế Cốt Lõi

**"Claude cần cùng những công cụ mà lập trình viên sử dụng hàng ngày"**

Claude Code cho phép Claude truy cập vào computer của user (qua terminal), giúp Claude có thể:
- Tìm kiếm files trong codebase
- Viết và chỉnh sửa files
- Lint code
- Chạy code
- Debug
- Thực hiện các hành động lặp lại cho đến khi code thành công

## Tech Stack

- **Frontend/UI**: TypeScript, React, Ink (React for CLI), Yoga
- **Runtime**: Bun
- **Đặc điểm**: 90% code trong Claude Code được viết bởi chính Claude!

## Kiến Trúc Chi Tiết

### 1. Single-Thread Architecture (Kiến Trúc Đơn Luồng)

**Điểm quan trọng**: Khác với xu hướng multi-agent systems, Claude Code chỉ duy trì **một main thread duy nhất**.

```
Main Thread:
├── System Prompt (~2,800 tokens)
├── Tools Definition (~9,400 tokens)
├── CLAUDE.md Context (1,000-2,000 tokens)
└── Conversation History
```

**Lý do**:
- Dễ debug hơn
- Đi theo hướng cải tiến của model chung
- Giảm độ phức tạp

### 2. Context Management Layer

#### a) CLAUDE.md Files
- Tự động load vào system prompt mỗi conversation
- Chứa thông tin về:
  - Cấu trúc project
  - Coding standards
  - Architectural patterns
  - Common bash commands
  - Testing instructions
  - Developer environment setup

#### b) Compact Feature
- Tự động tóm tắt messages khi gần đạt context limit
- Giữ cho agent không bị out of context
- Dựa trên slash command `/compact`

#### c) Codebase Indexing
- Claude tự động index toàn bộ codebase
- Hiểu cấu trúc project
- Nhận biết module relationships

### 3. Planning & Decision Layer

#### Extended Thinking (Interleaved Mode)
- Claude 4 hỗ trợ "interleaved thinking"
- Cho phép reasoning sâu hơn
- Có thể trigger bằng: "think", "think hard", "ultrathink"

#### Task Planning
Claude chia nhỏ tasks theo workflow:

```
User Request → Research → Plan → Implement → Verify → Commit
```

**Workflow tiêu chuẩn**:
1. **Research**: Đọc files, URLs, images liên quan (không code)
2. **Plan**: Tạo plan cách tiếp cận (có thể dùng sub-agents)
3. **Implement**: Viết code thực thi
4. **Verify**: Test, lint, type checking
5. **Commit & PR**: Tạo commit message và PR

### 4. Sub-agent System

**Thiết kế đơn giản nhưng hiệu quả**:

```
Main Agent
    └── Sub-agent (Max 1 level)
            ├── Isolated context
            ├── Limited tools (no spawning ability)
            └── Result → Main thread
```

**Đặc điểm**:
- Tối đa **1 nhánh** (không có nested sub-agents)
- Sub-agent là clone của main agent nhưng:
  - Không thể spawn thêm sub-agents
  - Có tool access bị giới hạn
  - Kết quả được trả về main thread như tool response

**Built-in Sub-agents**:

1. **General-purpose sub-agent**: 
   - Xử lý tasks phức tạp, multi-step
   - Có thể modify files
   - Thực hiện exploration và action

2. **Explore sub-agent**:
   - Focused vào research tasks
   - Tìm kiếm và phân tích code
   - Không modify files

**Khi nào Claude spawn sub-agent?**
- Task cần cả exploration và modification
- Cần complex reasoning để interpret search results
- Có nhiều strategies phải thử
- Multi-step tasks phụ thuộc lẫn nhau

### 5. Tools System (~9,400 tokens trong prompt)

#### Core Tools:

**a) Bash Tool**
```javascript
{
  name: "bash_tool",
  description: "Run bash commands in container",
  parameters: {
    command: string,
    description: string // Why running this command
  }
}
```

**b) File Operations**
- `str_replace`: Sửa file (replace unique string)
- `create_file`: Tạo file mới
- `view`: Xem files, directories, images

**c) Git Operations**
- Commit changes
- Create PRs
- Manage branches
- Integration với GitHub/GitLab

**d) Web Search**
- Tìm kiếm thông tin current
- Fetch web pages

**e) MCP (Model Context Protocol) Tools**
- Integration với external services
- Google Drive, Slack, Figma, Jira, etc.
- Custom MCP servers

### 6. Skills System (Kiến Trúc Meta-tool)

**Điểm đặc biệt**: Skills KHÔNG phải là code thực thi, mà là **prompt-based context modifiers**.

#### Cách hoạt động:

```
1. User request: "Extract text from PDF"
   ↓
2. Claude invokes Skill meta-tool
   ↓
3. Load SKILL.md file (markdown instructions)
   ↓
4. Inject 2 messages:
   - User-visible metadata message
   - Hidden instruction message (for API)
   ↓
5. Modify execution context:
   - Tool permissions
   - Model selection
   ↓
6. Continue conversation with enriched context
```

**Kiến trúc Skills**:
```
/mnt/skills/
├── public/           # Built-in skills
│   ├── docx/
│   ├── pdf/
│   ├── pptx/
│   └── xlsx/
├── private/          # Private skills
└── examples/         # Example skills
```

**Ví dụ skills có sẵn**:
- **docx**: Document creation/editing
- **pdf**: PDF manipulation
- **pptx**: Presentation creation
- **xlsx**: Spreadsheet operations
- **product-self-knowledge**: Product info reference
- **frontend-design**: UI/UX design patterns

### 7. Model Selection Strategy

Claude Code sử dụng 3 models khác nhau:

#### Claude Haiku (~50% calls)
- **Use case**: Fast, cheap tasks
  - Code formatting
  - Read large files
  - Parse web pages
  - Process git history
  - Summarize conversations
  - Generate one-word processing labels
- **Cost**: 70-80% cheaper than Sonnet/Opus

#### Claude Sonnet 4.5 (Default)
- **Use case**: Daily workhorse
  - Standard coding tasks
  - Feature implementation
  - Bug fixes
  - Code reviews

#### Claude Opus 4.5 (Max plan only)
- **Use case**: Complex tasks
  - Heavy refactoring
  - Distributed microservices analysis
  - Complex architecture decisions
  - Multi-system interactions

**Model switching**: Dùng `/model` command để chuyển model trong session.

### 8. Feedback Loop (Core Workflow)

Mọi agent operation đều follow feedback loop:

```
┌─────────────────────────────────────┐
│  1. GATHER CONTEXT                  │
│  - Read files                       │
│  - Search codebase                  │
│  - Query external sources           │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  2. TAKE ACTION                     │
│  - Edit files                       │
│  - Execute commands                 │
│  - Call MCP tools                   │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  3. VERIFY WORK                     │
│  - Run tests                        │
│  - Lint code                        │
│  - Type checking                    │
└──────────────┬──────────────────────┘
               ↓
┌─────────────────────────────────────┐
│  4. REPEAT                          │
│  - Success? → Done                  │
│  - Failed? → Go to step 1           │
└─────────────────────────────────────┘
```

### 9. Hooks System

Cho phép custom shell commands:

```markdown
# .claude/hooks/pre-commit.sh
#!/bin/bash
npm run lint
npm run test
```

Claude có thể tự động chạy hooks trong workflow.

### 10. Configuration & Customization

#### Project-level (.claude/)
```
.claude/
├── agents/              # Custom sub-agents
├── commands/            # Slash commands
├── hooks/               # Git hooks
└── CLAUDE.md            # Project context
```

#### User-level (~/.claude/)
```
~/.claude/
├── agents/              # Personal agents
├── commands/            # Global commands
└── config.json          # Global settings
```

#### MCP Configuration
```json
// .mcp.json
{
  "servers": {
    "google-drive": {...},
    "slack": {...},
    "custom-tool": {...}
  }
}
```

## Data Flow Chi Tiết

### Typical Request Flow

```
User Input
    ↓
Terminal UI (React + Ink)
    ↓
Main Agent Thread
    ├─→ Load System Prompt
    ├─→ Load CLAUDE.md
    ├─→ Load Conversation History
    └─→ Extended Thinking
            ↓
    Task Planning & Decision
            ↓
         ┌──┴──┐
         │     │
    Simple    Complex
      Task     Task
         │     │
         ↓     ↓
    Execute   Spawn
    Tools     Sub-agent
         │         │
         │    ┌────┴─────┐
         │    │          │
         │  Execute  Return
         │  Tools    Result
         │    │          │
         │    └──────────┘
         │         │
         └────┬────┘
              ↓
        Verify Work
              ↓
     ┌────────┴────────┐
     │                 │
  Success           Failed
     │                 │
     ↓                 ↓
 Display          Retry Loop
  Result              ↓
                  (Back to Planning)
```

### Skills Activation Flow

```
User: "Create a Word document"
    ↓
Claude recognizes need for docx skill
    ↓
Invoke Skill meta-tool
    ↓
Load /mnt/skills/public/docx/SKILL.md
    ↓
Inject context:
    ├─→ User message: "[Skill activated: docx]"
    └─→ System message: [Detailed docx instructions]
    ↓
Modify execution:
    ├─→ Enable python-docx tools
    ├─→ Set appropriate permissions
    └─→ Adjust model if needed
    ↓
Execute docx operations
    ↓
Return created file to user
```

## Best Practices & Patterns

### 1. Effective Prompting

**Tốt**:
```
Research the authentication system, create a plan,
then implement OAuth2 integration with proper error handling.
Test with our existing user flows.
```

**Không tốt**:
```
Add OAuth
```

### 2. Using Sub-agents

**Khi nào dùng**:
- Complex research tasks
- Need to verify multiple hypotheses
- Multi-file analysis
- Preserve main context

**Example**:
```
Use a sub-agent to research all authentication flows
in the codebase, then report back with a summary.
Don't modify anything yet.
```

### 3. Slash Commands

```bash
/permissions      # Manage command permissions
/model sonnet     # Switch to Sonnet
/model opus       # Switch to Opus (Max plan)
/compact          # Compact conversation
/agents           # Manage sub-agents
/bug              # Report bug to Anthropic
```

### 4. Plan Mode

Trigger với keywords:
- "think" - Standard planning
- "think hard" - Deeper analysis
- "ultrathink" - Maximum depth

### 5. MCP Integration

**Setup**:
```bash
# Add MCP server
claude mcp add google-drive

# Debug MCP
claude --mcp-debug
```

**Best practice**: Add MCP servers to `.mcp.json` để team share configuration.

## Performance Characteristics

### Token Efficiency
- System prompt: ~2,800 tokens
- Tools definition: ~9,400 tokens
- CLAUDE.md: 1,000-2,000 tokens
- Skills: Load on-demand
- **Result**: 32.3% token reduction vs naïve approaches

### Speed
- 2.8-4.4x speed improvement với parallel coordination
- Haiku cho tasks nhanh (50% calls)
- Sonnet cho balance
- Opus chỉ khi cần thiết

### Reliability
- 84.8% solve rate trên SWE-Bench
- Feedback loop đảm bảo quality
- Sub-agents giúp preserve context

## Security & Permissions

### Permission System
```bash
# Grant specific commands
/permissions add "npm install"

# Skip all permissions (DANGEROUS)
claude --dangerously-skip-permissions
```

### Best Practices
- Review bash commands trước khi auto-approve
- Limit tool access cho sub-agents
- Use hooks để enforce standards
- Regular code reviews

## Future Directions

### Agent-First Product Design
Claude Code đang thúc đẩy một paradigm mới:

**Human-first Design**:
- Optimize cho developer readability
- Team productivity focus

**Agent-first Design**:
- Builds on human-first foundation
- Optimize cho AI generation/extension
- Enable rapid personalization at scale
- Templatable experiences
- Automated validation

## Kết Luận

Kiến trúc của Claude Code là một ví dụ xuất sắc về **simplicity over complexity**:

✅ **Single-thread** thay vì complex multi-agent
✅ **Max 1-level sub-agents** thay vì deep hierarchies
✅ **Prompt-based skills** thay vì executable code
✅ **Tool composition** thay vì monolithic features
✅ **Feedback loops** đảm bảo quality
✅ **Model diversity** optimize cost/performance

Kết quả là một system **dễ debug**, **dễ maintain**, và **highly effective** cho agentic coding tasks.

## Resources

- Official Docs: https://code.claude.com/docs
- Blog: https://www.anthropic.com/engineering/claude-code-best-practices
- GitHub: https://github.com/anthropics/claude-code
- Discord: Claude Developers Discord
