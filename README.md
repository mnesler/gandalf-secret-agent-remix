# gandalf-secret-agent-remix

An [OpenCode](https://opencode.ai) MCP agent that provides AI assistants with access to your organization's infrastructure documentation, layered on top of public GCP, Terraform, and Tekton docs.

## Prerequisites

Before installing, ensure you have:

| Requirement | Installation |
|-------------|--------------|
| **Bun** | `curl -fsSL https://bun.sh/install \| bash` |
| **OpenCode** | `curl -fsSL https://opencode.ai/install \| bash` |
| **GitHub Copilot** | [Subscription required](https://github.com/features/copilot) for LLM access |

> **Note:** If fetching docs from private GitHub repos, you'll also need [GitHub CLI](https://cli.github.com) (`gh auth login`) or a `GITHUB_TOKEN` environment variable.

## What it does

This package provides:

1. **An OpenCode Agent** (`infra-engineer`) - A specialized AI assistant that follows your organization's infrastructure standards
2. **An MCP Server** - Fetches and serves documentation from GitHub repos and public sources

When you ask the agent to create infrastructure (e.g., "create a GCS bucket for ML models"), it will:
1. Query your internal documentation for naming conventions, security policies, and approved modules
2. Check public GCP/Terraform docs for resource specifications  
3. Generate compliant Terraform code that follows all your organization's standards

## Key Features

- **Self-updating docs**: Use `/updoot` to add documentation sources through conversation
- **Multi-source**: GitHub repos, public docs (GCP, Terraform, Tekton), and any URL
- **Smart caching**: 5-minute TTL for fast responses
- **Hot reload**: Changes to user docs are immediately available

## Quick Start

```bash
# In your project directory
bunx github:mnesler/gandalf-secret-agent-remix init

# Authenticate with GitHub (if not already)
gh auth login

# Start OpenCode
opencode

# Press Tab to switch to 'infra-engineer' agent
```

> **Note:** The MCP server uses `gh` CLI for GitHub authentication. If `gh` is not available, it falls back to the `GITHUB_TOKEN` environment variable.

## What `init` creates

```
your-project/
├── .opencode/
│   └── agent/
│       └── infra-engineer.md    # The agent definition
├── opencode.json                # MCP server configuration
└── .env.example                 # GitHub token template
```

## Adding Documentation Sources

### Option 1: Use `/updoot` (Recommended)

The easiest way to add documentation is through conversation:

```
User: /updoot
Agent: I'm ready to help manage your documentation sources! You can:
       - Paste a URL to add new documentation
       - Say "remove <topic>" to remove one
       - Say "list" to see your custom docs

User: https://cloud.google.com/storage/docs/naming-buckets
Agent: [previews the page and suggests topic name]
       Added! You can now use get_doc('gcp-bucket-naming')
```

User docs are saved to `~/.config/gandalf/docs.json` and work across all projects.

### Option 2: Edit Built-in Sources

For organization-wide defaults, edit `src/server/config/doc-sources.ts` in this package (or fork it):

```typescript
{
  topic: "naming-standards",
  title: "Resource Naming Standards",
  description: "Required naming conventions for all GCP resources",
  category: "internal",
  priority: 1.0,
  source: {
    type: "github",
    repo: "YOUR_ORG/cloud-standards",     // <-- Your repo here
    path: "gcp/naming-conventions.md",
    branch: "main",
  },
},
```

### Option 3: Customize the Agent Prompt

Edit `.opencode/agent/infra-engineer.md` in your project to match your organization's specific requirements.

## Managing Documentation

| Command | Purpose |
|---------|---------|
| `/updoot` | Add, remove, or list custom documentation sources |
| `list_topics` | See all available documentation (built-in + user) |
| `get_doc <topic>` | Fetch a specific document |
| `search_docs <query>` | Search across all documentation |

## Documentation Sources

### Built-in Sources

| Category | Examples | Source |
|----------|----------|--------|
| **Internal** | `naming-standards`, `terraform-modules`, `security-policies` | GitHub repos (YOUR_ORG/*) |
| **Public** | `gcp-storage-bucket`, `terraform-gcs-bucket`, `tekton-pipelines` | Live docs (GCP, Terraform, Tekton) |
| **User** | Added via `/updoot` | Any URL, saved to ~/.config/gandalf/docs.json |

## MCP Tools

The agent has access to these tools:

| Tool | Description |
|------|-------------|
| `list_topics` | List all available documentation |
| `get_doc` | Fetch full content of a specific doc |
| `search_docs` | Full-text search across all docs |

## Development

```bash
# Clone and install
git clone https://github.com/mnesler/gandalf-secret-agent-remix
cd gandalf-secret-agent-remix
bun install

# Run the MCP server directly
bun run src/cli.ts serve

# Type check
bun run typecheck
```

## How It Works

```
┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐
│    OpenCode     │────▶│   MCP Server    │────▶│  Doc Sources    │
│  (AI Agent)     │     │  (this pkg)     │     │  - GitHub API   │
│                 │◀────│                 │◀────│  - GCP Docs     │
│ infra-engineer  │     │ list_topics     │     │  - Terraform    │
│    agent        │     │ get_doc         │     │  - Tekton       │
│                 │     │ search_docs     │     │                 │
└─────────────────┘     └─────────────────┘     └─────────────────┘
```

1. User asks agent to create infrastructure
2. Agent calls MCP tools to fetch relevant documentation
3. MCP server fetches docs from GitHub/public sources (with caching)
4. Agent generates compliant code based on documented standards

## License

MIT
