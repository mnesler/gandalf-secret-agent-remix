# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

## [0.0.3] - 2026-01-17

### Changed
- GitHub adapter now tries `gh` CLI first for authentication, falls back to `GITHUB_TOKEN`
- Zero config for users already authenticated with `gh auth login`
- Updated README and .env.example to reflect new auth options

## [0.0.2] - 2026-01-17

### Changed
- Removed hardcoded Anthropic model from agent template - now uses user's default model (e.g., GitHub Copilot)
- This allows the agent to work with any LLM provider configured in OpenCode

## [0.0.1] - 2026-01-17

### Added
- Initial release
- MCP server with documentation fetching from GitHub, GCP, Terraform, and Tekton
- `init` command to set up agent and MCP config in projects
- `serve` command to run the MCP server
- `infra-engineer` agent template with:
  - Documentation-first workflow
  - Organization standards enforcement
  - Naming conventions
  - Security requirements
  - **Software installation policy** - Agent must always prompt and get explicit user approval before installing any software

### Tools
- `list_topics` - List all available documentation
- `get_doc` - Fetch full content of a specific document
- `search_docs` - Full-text search across all documentation

## How to Update

To get the latest version:

```bash
# Re-run init to update agent template
bunx github:mnesler/gandalf-secret-agent-remix init --force

# Or manually update .opencode/agent/infra-engineer.md
```

To pin to a specific version:

```bash
bunx github:mnesler/gandalf-secret-agent-remix@v0.0.1 init
```
