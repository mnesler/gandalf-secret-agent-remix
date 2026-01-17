# gandalf-secret-agent-remix

An [OpenCode](https://opencode.ai) MCP agent that provides AI assistants with access to your organization's infrastructure documentation, layered on top of public GCP, Terraform, and Tekton docs.

## What it does

This package provides:

1. **An OpenCode Agent** (`infra-engineer`) - A specialized AI assistant that follows your organization's infrastructure standards
2. **An MCP Server** - Fetches and serves documentation from GitHub repos and public sources

When you ask the agent to create infrastructure (e.g., "create a GCS bucket for ML models"), it will:
1. Query your internal documentation for naming conventions, security policies, and approved modules
2. Check public GCP/Terraform docs for resource specifications  
3. Generate compliant Terraform code that follows all your organization's standards

## Quick Start

```bash
# In your project directory
bunx github:mnesler/gandalf-secret-agent-remix init

# Set your GitHub token (for private repo access)
export GITHUB_TOKEN=ghp_your_token_here

# Start OpenCode
opencode

# Press Tab to switch to 'infra-engineer' agent
```

## What `init` creates

```
your-project/
├── .opencode/
│   └── agent/
│       └── infra-engineer.md    # The agent definition
├── opencode.json                # MCP server configuration
└── .env.example                 # GitHub token template
```

## Customization

### 1. Add Your Documentation Sources

Edit `src/server/config/doc-sources.ts` in this package (or fork it) to point to your organization's actual documentation:

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

### 2. Customize the Agent Prompt

Edit `.opencode/agent/infra-engineer.md` in your project to match your organization's specific requirements.

## Documentation Sources

### Internal (from GitHub)

| Topic | Description |
|-------|-------------|
| `naming-standards` | Resource naming conventions |
| `terraform-modules` | Internal Terraform module registry |
| `security-policies` | Security and compliance requirements |
| `team-codes` | Valid team abbreviations |

### Public (fetched live)

| Topic | Source |
|-------|--------|
| `gcp-storage-bucket` | cloud.google.com |
| `gcp-iam` | cloud.google.com |
| `terraform-gcs-bucket` | registry.terraform.io |
| `tekton-pipelines` | tekton.dev |

## MCP Tools

The agent has access to these tools:

| Tool | Description |
|------|-------------|
| `list_topics` | List all available documentation |
| `get_doc` | Fetch full content of a specific doc |
| `search_docs` | Full-text search across all docs |

## Requirements

- [Bun](https://bun.sh) runtime
- [OpenCode](https://opencode.ai) CLI
- GitHub token (for private repo access)

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
