# MCP Server Self-Discovery Implementation Plan

**Project:** gandalf-secret-agent-remix  
**Document Version:** 1.0  
**Date:** 2026-01-18  
**Status:** Planning Phase

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Background & Context](#2-background--context)
3. [Requirements & Goals](#3-requirements--goals)
4. [Architecture Overview](#4-architecture-overview)
5. [Phase 1: Index Building System](#5-phase-1-index-building-system)
6. [Phase 2: Search & Retrieval](#6-phase-2-search--retrieval)
7. [Phase 3: MCP Tool Integration](#7-phase-3-mcp-tool-integration)
8. [Phase 4: Configuration & Customization](#8-phase-4-configuration--customization)
9. [Testing Strategy](#9-testing-strategy)
10. [Performance Considerations](#10-performance-considerations)
11. [Error Handling & Edge Cases](#11-error-handling--edge-cases)
12. [Deployment & Rollout](#12-deployment--rollout)
13. [Future Enhancements](#13-future-enhancements)
14. [Appendices](#14-appendices)

---

## 1. Executive Summary

### 1.1 Problem Statement

Organizations maintain infrastructure documentation across multiple GitHub repositories:
- Naming conventions and standards
- Terraform module catalogs
- Architecture patterns and reference designs
- Security policies and compliance requirements

Currently, these documents must be manually configured in the MCP server's `doc-sources.ts` file. When repositories contain dozens or hundreds of example files, maintaining this configuration becomes impractical.

### 1.2 Proposed Solution

Implement a **self-discovery system** that:

1. **Automatically scans** configured GitHub repositories
2. **Indexes** all relevant files (.tf, .md) with metadata
3. **Enables intelligent search** across discovered content
4. **Updates on-demand** when documentation changes

### 1.3 Key Benefits

- ✅ **Zero-configuration scaling** - Add 100 examples, no config updates needed
- ✅ **Better relevance** - Search finds examples based on actual content, not just topic names
- ✅ **Reduced maintenance** - No manual updates to doc-sources.ts for every new file
- ✅ **Richer context** - Agent gets examples relevant to specific resources (e.g., "GCS bucket with lifecycle")
- ✅ **Future-proof** - Easy to extend with semantic search, vector embeddings later

### 1.4 High-Level Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                    AI Agent (Claude, etc.)                  │
└────────────┬────────────────────────────────┬───────────────┘
             │                                │
             │ Curated Docs                   │ Discovery Search
             │ (Known topics)                 │ (Auto-indexed)
             ▼                                ▼
┌────────────────────────┐      ┌────────────────────────────┐
│   Hardcoded Docs       │      │   Discovery System         │
│                        │      │                            │
│ • naming-standards     │      │ • Repo Scanner             │
│ • security-policies    │      │ • File Indexer             │
│ • terraform-modules    │      │ • Content Analyzer         │
│                        │      │ • Search Engine            │
│ Tools:                 │      │                            │
│ - get_doc()            │      │ Tools:                     │
│ - list_topics()        │      │ - search_examples()        │
│ - search_docs()        │      │ - rebuild_index()          │
└────────────────────────┘      └────────────────────────────┘
             │                                │
             │                                │
             ▼                                ▼
┌────────────────────────┐      ┌────────────────────────────┐
│   doc-sources.ts       │      │   ~/.config/gandalf/       │
│   (in code)            │      │   repo-index.json          │
└────────────────────────┘      └────────────────────────────┘
```

---

## 2. Background & Context

### 2.1 Current System

The existing `gandalf-secret-agent-remix` MCP server provides:

**Capabilities:**
- Fetches documentation from GitHub, GCP, Terraform, Tekton
- Exposes MCP tools: `list_topics`, `get_doc`, `search_docs`
- Caches fetched content (5-minute TTL)
- Supports user-added docs via `/updoot` command

**Limitations:**
- Each document must be manually configured
- No support for discovering files in a repo
- Search is limited to pre-configured docs
- Scaling requires code changes

### 2.2 Use Case

**Organization:** ACME Corp (example)

**Documentation Repositories (2-5 repos):**
1. `acme-corp/infra-standards` - Naming conventions, labeling policies, team codes
2. `acme-corp/terraform-modules` - Internal module catalog and documentation
3. `acme-corp/terraform-examples` - ~50+ example .tf files for various GCP resources
4. `acme-corp/architecture` - Architecture patterns, reference designs
5. `acme-corp/security-docs` - Security policies, compliance requirements

**Key Documentation Types:**
- Naming standards (critical, hardcoded)
- Terraform modules (critical, hardcoded catalog + auto-discovered READMEs)
- Architecture patterns (auto-discovered from patterns/*.md)
- Terraform examples (auto-discovered from **/*.tf)

**GCP Focus Areas:**
- Cloud Storage (GCS)
- IAM & Security
- Networking (VPC, Cloud NAT, Load Balancers)
- Data & Analytics (BigQuery, Pub/Sub, Dataflow)

### 2.3 Agent Behavior Requirements

**Documentation Strategy:** "Check docs on demand"

The agent should:
- Decide when documentation is needed (not forced)
- Call `get_doc()` for known standards (naming, security)
- Call `search_examples()` when looking for code examples
- Combine official standards + real examples when generating infrastructure

**Example Workflow:**
```
User: "Create a GCS bucket for ML training data"

Agent:
1. Calls get_doc("naming-standards") - Get naming pattern
2. Calls search_examples("GCS bucket ML") - Find relevant examples
3. Synthesizes:
   - Naming from standards: acme-dev-ml-bucket-training-data
   - Configuration from example: lifecycle rules, labels, encryption
   - Generates compliant Terraform code
```

---

## 3. Requirements & Goals

### 3.1 Functional Requirements

**FR1: Repository Scanning**
- Scan configured GitHub repositories (public or private)
- Support glob patterns for include/exclude (e.g., `patterns/**/*.md`)
- Handle repos with 100+ files efficiently

**FR2: File Analysis**
- Analyze Terraform files (.tf):
  - Extract resource types (e.g., `google_storage_bucket`)
  - Extract title from comments
  - Generate keywords from content
- Analyze Markdown files (.md):
  - Extract title from H1/H2 headings
  - Extract keywords from headings, bold text, inline code
  - Generate summary from first paragraph

**FR3: Index Storage**
- Store index as JSON at `~/.config/gandalf/repo-index.json`
- Include metadata: path, title, keywords, resource types, summary
- Support versioning for index format changes

**FR4: Search Capabilities**
- Search by keywords across all indexed files
- Filter by resource type (e.g., only `google_storage_bucket` files)
- Filter by file type (.tf vs .md)
- Filter by repository
- Score and rank results by relevance

**FR5: On-Demand Refresh**
- Rebuild index via MCP tool call
- Support full rebuild (all repos) or single repo
- Preserve existing index if rebuild fails

**FR6: MCP Tool Integration**
- New tool: `search_examples(query, options)`
- New tool: `rebuild_index(repo?)`
- Maintain existing tools: `get_doc()`, `list_topics()`, `search_docs()`

### 3.2 Non-Functional Requirements

**NFR1: Performance**
- Index build: < 30 seconds for 100 files
- Search latency: < 500ms for queries
- Index file size: < 1MB for 500 files

**NFR2: Reliability**
- Graceful degradation if GitHub API fails
- Preserve old index if new build fails
- Handle rate limits (GitHub API: 5000 req/hour authenticated)

**NFR3: Maintainability**
- Clear separation: hardcoded docs vs. discovered docs
- Configuration-driven (no hardcoded repo lists in code)
- Extensible for future source types

**NFR4: Usability**
- Human-readable index (JSON, not binary)
- Clear error messages for failed operations
- Progress logging during index builds

### 3.3 Out of Scope (Future Work)

- ❌ Vector embeddings / semantic search (Phase 2)
- ❌ Real-time index updates (webhook-based)
- ❌ Multi-language support (Python, Go, etc.)
- ❌ Distributed caching (Redis, etc.)
- ❌ Web UI for index management

---

## 4. Architecture Overview

### 4.1 System Components

```
┌─────────────────────────────────────────────────────────────┐
│                      MCP Server                             │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             Discovery System                          │  │
│  │                                                       │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌────────────┐ │  │
│  │  │ Index        │  │ File         │  │ Search     │ │  │
│  │  │ Builder      │  │ Analyzer     │  │ Engine     │ │  │
│  │  │              │  │              │  │            │ │  │
│  │  │ • Scan repos │  │ • Parse .tf  │  │ • Score    │ │  │
│  │  │ • Fetch tree │  │ • Parse .md  │  │ • Rank     │ │  │
│  │  │ • Filter     │  │ • Extract    │  │ • Filter   │ │  │
│  │  │   files      │  │   metadata   │  │ • Excerpt  │ │  │
│  │  └──────┬───────┘  └──────┬───────┘  └──────┬─────┘ │  │
│  │         │                 │                 │       │  │
│  │         └────────┬────────┴─────────────────┘       │  │
│  │                  │                                   │  │
│  │         ┌────────▼────────┐                          │  │
│  │         │ Index Storage   │                          │  │
│  │         │ • Load/Save     │                          │  │
│  │         │ • Validate      │                          │  │
│  │         └─────────────────┘                          │  │
│  └──────────────────────────────────────────────────────┘  │
│                                                             │
│  ┌──────────────────────────────────────────────────────┐  │
│  │             MCP Tools                                 │  │
│  │                                                       │  │
│  │  Curated Docs:              Discovery:               │  │
│  │  • list_topics()            • search_examples()      │  │
│  │  • get_doc(topic)           • rebuild_index(repo?)   │  │
│  │  • search_docs(query)       • list_indexed_repos()   │  │
│  └──────────────────────────────────────────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                              │
                              │
                ┌─────────────┴─────────────┐
                │                           │
                ▼                           ▼
    ┌───────────────────┐      ┌───────────────────────┐
    │ doc-sources.ts    │      │ ~/.config/gandalf/    │
    │ (Hardcoded)       │      │ repo-index.json       │
    └───────────────────┘      └───────────────────────┘
```

### 4.2 Data Flow

#### **Index Building Flow**

```
1. Trigger: MCP tool call rebuild_index()
   ↓
2. Load config: discovery-repos.ts
   ↓
3. For each repo:
   a. Fetch file tree (GitHub Tree API)
   b. Filter by include/exclude patterns
   c. For each file:
      - Fetch content (GitHub Contents API)
      - Analyze (extract metadata)
      - Add to index
   ↓
4. Save index to ~/.config/gandalf/repo-index.json
   ↓
5. Return summary (files indexed, repos scanned)
```

#### **Search Flow**

```
1. Trigger: MCP tool call search_examples(query)
   ↓
2. Load index from ~/.config/gandalf/repo-index.json
   ↓
3. Score all files:
   - Title match: +10
   - Keyword match: +3
   - Path match: +2
   - Resource type match: +20
   ↓
4. Sort by score, take top N
   ↓
5. Fetch actual content for top results
   ↓
6. Extract excerpts around matches
   ↓
7. Return SearchResult[] to agent
```

### 4.3 File Structure

```
gandalf-secret-agent-remix/
├── src/
│   ├── server/
│   │   ├── index.ts                    # MCP server entry point
│   │   ├── tools.ts                    # MCP tool definitions
│   │   ├── resources.ts                # MCP resources
│   │   ├── search.ts                   # Curated doc search
│   │   │
│   │   ├── config/
│   │   │   ├── doc-sources.ts          # Hardcoded docs (existing)
│   │   │   ├── discovery-repos.ts      # NEW: Repos to auto-index
│   │   │   └── user-docs.ts            # User-added docs (existing)
│   │   │
│   │   ├── sources/                    # Existing fetchers
│   │   │   ├── index.ts
│   │   │   ├── github.ts
│   │   │   ├── gcp.ts
│   │   │   ├── terraform.ts
│   │   │   ├── tekton.ts
│   │   │   └── url.ts
│   │   │
│   │   └── discovery/                  # NEW: Self-discovery system
│   │       ├── index-builder.ts        # Scan repos, build index
│   │       ├── file-analyzer.ts        # Analyze .tf and .md files
│   │       ├── keyword-extractor.ts    # Extract searchable keywords
│   │       ├── index-storage.ts        # Load/save index JSON
│   │       └── search.ts               # Search indexed files
│   │
│   ├── templates/
│   │   └── agent.md                    # Agent prompt (to update)
│   │
│   └── cli.ts                          # CLI entry point
│
├── ~/.config/gandalf/
│   ├── docs.json                       # User docs (existing)
│   └── repo-index.json                 # NEW: Discovery index
│
└── SELF_DISCOVERY_PLAN.md             # This document
```

---

## 5. Phase 1: Index Building System

### 5.1 Data Structures

#### **Index Format (JSON)**

```typescript
interface FullIndex {
  version: string;              // Index format version (e.g., "1.0")
  createdAt: string;            // ISO timestamp
  repos: {
    [repoName: string]: RepoIndex;
  };
}

interface RepoIndex {
  lastIndexed: string;          // ISO timestamp
  fileCount: number;
  files: FileMetadata[];
}

interface FileMetadata {
  path: string;                 // "gcs/bucket-basic.tf"
  type: "terraform" | "markdown";
  title: string;                // Extracted from file
  keywords: string[];           // Searchable terms
  resourceTypes?: string[];     // For .tf files only
  summary: string;              // First few lines or description
  size: number;                 // File size in bytes
  sha: string;                  // GitHub SHA for change detection
}
```

#### **Example Index File**

```json
{
  "version": "1.0",
  "createdAt": "2026-01-18T10:30:00Z",
  "repos": {
    "acme-corp/terraform-examples": {
      "lastIndexed": "2026-01-18T10:30:00Z",
      "fileCount": 47,
      "files": [
        {
          "path": "gcs/bucket-basic.tf",
          "type": "terraform",
          "title": "Basic GCS bucket for application data",
          "keywords": ["gcs", "bucket", "storage", "basic", "application"],
          "resourceTypes": ["google_storage_bucket"],
          "summary": "Example of basic GCS bucket configuration with required labels",
          "size": 1234,
          "sha": "abc123..."
        },
        {
          "path": "vpc/network-shared.md",
          "type": "markdown",
          "title": "Shared VPC Network Pattern",
          "keywords": ["vpc", "network", "shared", "networking", "subnet"],
          "summary": "Architecture pattern for shared VPC across multiple projects...",
          "size": 2345,
          "sha": "def456..."
        }
      ]
    },
    "acme-corp/architecture": {
      "lastIndexed": "2026-01-18T10:30:00Z",
      "fileCount": 12,
      "files": [
        // ... more files
      ]
    }
  }
}
```

### 5.2 Configuration Format

#### **discovery-repos.ts**

```typescript
// src/server/config/discovery-repos.ts

export interface RepoConfig {
  repo: string;                 // "owner/repo-name"
  description: string;          // Human-readable description
  branch?: string;              // Default: "main"
  include: string[];            // Glob patterns to include
  exclude?: string[];           // Glob patterns to exclude
  priority: number;             // 0.0 to 1.0 (affects search scoring)
}

export const DISCOVERY_REPOS: RepoConfig[] = [
  {
    repo: "acme-corp/terraform-examples",
    description: "Real-world Terraform examples for all GCP resources",
    branch: "main",
    include: [
      "**/*.tf",
      "**/*.md",
    ],
    exclude: [
      ".git/**",
      "**/node_modules/**",
      "**/.terraform/**",
    ],
    priority: 0.9,
  },
  {
    repo: "acme-corp/architecture",
    description: "Architecture patterns and design docs",
    branch: "main",
    include: [
      "patterns/**/*.md",
      "reference/**/*.md",
    ],
    priority: 0.7,
  },
  {
    repo: "acme-corp/terraform-modules",
    description: "Internal Terraform module documentation",
    branch: "main",
    include: [
      "modules/**/README.md",
      "modules/**/docs/**/*.md",
    ],
    priority: 1.0,  // Highest - prefer internal modules
  },
];
```

### 5.3 Index Builder Implementation

#### **Core Algorithm**

```typescript
// src/server/discovery/index-builder.ts

import { Octokit } from "@octokit/rest";
import { minimatch } from "minimatch";
import { DISCOVERY_REPOS, type RepoConfig } from "../config/discovery-repos.js";
import { analyzeFile } from "./file-analyzer.js";
import { saveIndex, loadIndex } from "./index-storage.js";

const octokit = new Octokit({
  auth: process.env.GITHUB_TOKEN,
});

/**
 * Build index for all configured repos
 */
export async function buildFullIndex(): Promise<FullIndex> {
  console.error("[index-builder] Starting full index build...");
  
  const index: FullIndex = {
    version: "1.0",
    createdAt: new Date().toISOString(),
    repos: {},
  };
  
  for (const repoConfig of DISCOVERY_REPOS) {
    console.error(`[index-builder] Indexing ${repoConfig.repo}...`);
    
    try {
      const repoIndex = await buildRepoIndex(repoConfig);
      index.repos[repoConfig.repo] = repoIndex;
      
      console.error(
        `[index-builder] ✓ Indexed ${repoIndex.fileCount} files from ${repoConfig.repo}`
      );
    } catch (error) {
      console.error(
        `[index-builder] ✗ Failed to index ${repoConfig.repo}:`,
        error.message
      );
      // Continue with other repos
    }
  }
  
  await saveIndex(index);
  
  const totalFiles = Object.values(index.repos).reduce(
    (sum, repo) => sum + repo.fileCount,
    0
  );
  
  console.error(
    `[index-builder] ✓ Index complete: ${totalFiles} files across ${Object.keys(index.repos).length} repos`
  );
  
  return index;
}

/**
 * Build index for a single repository
 */
async function buildRepoIndex(config: RepoConfig): Promise<RepoIndex> {
  const [owner, repo] = config.repo.split("/");
  const branch = config.branch || "main";
  
  // Step 1: Fetch file tree from GitHub
  const { data: treeData } = await octokit.git.getTree({
    owner,
    repo,
    tree_sha: branch,
    recursive: "true",
  });
  
  // Step 2: Filter to relevant files
  const relevantFiles = treeData.tree.filter((item) => {
    // Only files (not directories)
    if (item.type !== "blob") return false;
    
    const path = item.path || "";
    
    // Check include patterns
    const isIncluded = config.include.some((pattern) =>
      minimatch(path, pattern)
    );
    
    if (!isIncluded) return false;
    
    // Check exclude patterns
    if (config.exclude) {
      const isExcluded = config.exclude.some((pattern) =>
        minimatch(path, pattern)
      );
      if (isExcluded) return false;
    }
    
    return true;
  });
  
  console.error(
    `[index-builder] Found ${relevantFiles.length} files to index in ${config.repo}`
  );
  
  // Step 3: Analyze each file
  const fileMetadata: FileMetadata[] = [];
  
  for (const file of relevantFiles) {
    try {
      const metadata = await analyzeGitHubFile(
        owner,
        repo,
        file.path || "",
        file.sha || "",
        config.priority
      );
      
      fileMetadata.push(metadata);
    } catch (error) {
      console.error(
        `[index-builder] Warning: Failed to analyze ${file.path}:`,
        error.message
      );
      // Skip this file, continue with others
    }
  }
  
  return {
    lastIndexed: new Date().toISOString(),
    fileCount: fileMetadata.length,
    files: fileMetadata,
  };
}

/**
 * Fetch and analyze a single file from GitHub
 */
async function analyzeGitHubFile(
  owner: string,
  repo: string,
  path: string,
  sha: string,
  priority: number
): Promise<FileMetadata> {
  // Fetch file content
  const { data } = await octokit.repos.getContent({
    owner,
    repo,
    path,
  });
  
  // Decode content (base64)
  const content = Buffer.from(
    (data as any).content,
    "base64"
  ).toString("utf-8");
  
  // Analyze file
  const metadata = await analyzeFile(path, content);
  
  return {
    path,
    sha,
    size: content.length,
    ...metadata,
  };
}

/**
 * Rebuild index for a specific repo
 */
export async function rebuildRepoIndex(repoName: string): Promise<void> {
  console.error(`[index-builder] Rebuilding index for ${repoName}...`);
  
  const repoConfig = DISCOVERY_REPOS.find((r) => r.repo === repoName);
  
  if (!repoConfig) {
    throw new Error(`Repository ${repoName} not configured for discovery`);
  }
  
  // Load existing index
  const existingIndex = await loadIndex();
  
  if (!existingIndex) {
    throw new Error("No existing index found. Run buildFullIndex first.");
  }
  
  // Rebuild this repo
  const repoIndex = await buildRepoIndex(repoConfig);
  
  // Update index
  existingIndex.repos[repoName] = repoIndex;
  
  await saveIndex(existingIndex);
  
  console.error(
    `[index-builder] ✓ Rebuilt ${repoIndex.fileCount} files for ${repoName}`
  );
}
```

### 5.4 File Analyzer

#### **Terraform File Analysis**

```typescript
// src/server/discovery/file-analyzer.ts

import { extractKeywordsFromText, extractTechnicalTerms } from "./keyword-extractor.js";

export async function analyzeFile(
  path: string,
  content: string
): Promise<Omit<FileMetadata, "path" | "sha" | "size">> {
  // Determine file type
  const type = path.endsWith(".tf")
    ? "terraform"
    : path.endsWith(".md")
    ? "markdown"
    : null;
  
  if (!type) {
    throw new Error(`Unsupported file type: ${path}`);
  }
  
  if (type === "terraform") {
    return analyzeTerraformFile(content, path);
  } else {
    return analyzeMarkdownFile(content, path);
  }
}

/**
 * Analyze Terraform file
 */
function analyzeTerraformFile(
  content: string,
  path: string
): Omit<FileMetadata, "path" | "sha" | "size"> {
  // Extract resource types
  const resourceTypes = extractTerraformResources(content);
  
  // Extract title from comments
  const title = extractTerraformTitle(content, path);
  
  // Extract keywords
  const keywords = extractTerraformKeywords(content, resourceTypes);
  
  // Extract summary
  const summary = extractTerraformSummary(content);
  
  return {
    type: "terraform",
    title,
    keywords,
    resourceTypes,
    summary,
  };
}

/**
 * Extract Terraform resource types
 * Pattern: resource "TYPE" "NAME"
 */
function extractTerraformResources(content: string): string[] {
  const resources = new Set<string>();
  const resourceRegex = /resource\s+"([^"]+)"\s+"([^"]+)"/g;
  
  let match;
  while ((match = resourceRegex.exec(content)) !== null) {
    resources.add(match[1]);
  }
  
  return Array.from(resources);
}

/**
 * Extract title from Terraform file
 */
function extractTerraformTitle(content: string, path: string): string {
  // Try top comment
  const commentMatch = content.match(/^#\s*(.+)$/m);
  if (commentMatch) {
    return commentMatch[1].trim();
  }
  
  // Try first resource name
  const resourceMatch = content.match(/resource\s+"[^"]+"\s+"([^"]+)"/);
  if (resourceMatch) {
    return `Terraform: ${resourceMatch[1].replace(/_/g, " ")}`;
  }
  
  // Fallback to filename
  const filename = path.split("/").pop()?.replace(".tf", "");
  return `Terraform: ${filename}`;
}

/**
 * Extract keywords from Terraform file
 */
function extractTerraformKeywords(
  content: string,
  resourceTypes: string[]
): string[] {
  const keywords = new Set<string>();
  
  // Add resource types and their parts
  resourceTypes.forEach((type) => {
    keywords.add(type);
    // "google_storage_bucket" → ["google", "storage", "bucket"]
    type.split("_").forEach((part) => keywords.add(part));
  });
  
  // Extract from comments
  const comments = content.match(/^#\s*(.+)$/gm) || [];
  comments.forEach((comment) => {
    const words = extractKeywordsFromText(comment);
    words.forEach((w) => keywords.add(w));
  });
  
  // Add technical terms
  const techTerms = extractTechnicalTerms(content);
  techTerms.forEach((term) => keywords.add(term));
  
  // Add common Terraform keywords if present
  const tfKeywords = [
    "module",
    "variable",
    "output",
    "data",
    "locals",
    "lifecycle",
    "depends_on",
  ];
  
  tfKeywords.forEach((kw) => {
    if (content.includes(kw)) {
      keywords.add(kw);
    }
  });
  
  return Array.from(keywords);
}

/**
 * Extract summary from Terraform file
 */
function extractTerraformSummary(content: string): string {
  // Try comment block at top
  const commentBlock = content.match(/^#\s*(.+(?:\n#\s*.+)*)/m);
  
  if (commentBlock) {
    return commentBlock[1]
      .split("\n")
      .map((line) => line.replace(/^#\s*/, ""))
      .join(" ")
      .slice(0, 200);
  }
  
  // Fallback: describe resources
  const resourceTypes = extractTerraformResources(content);
  if (resourceTypes.length > 0) {
    return `Terraform configuration for ${resourceTypes.join(", ")}`;
  }
  
  return "Terraform configuration";
}
```

#### **Markdown File Analysis**

```typescript
/**
 * Analyze Markdown file
 */
function analyzeMarkdownFile(
  content: string,
  path: string
): Omit<FileMetadata, "path" | "sha" | "size"> {
  const title = extractMarkdownTitle(content, path);
  const keywords = extractMarkdownKeywords(content);
  const summary = extractMarkdownSummary(content);
  
  return {
    type: "markdown",
    title,
    keywords,
    summary,
  };
}

/**
 * Extract title from Markdown
 */
function extractMarkdownTitle(content: string, path: string): string {
  // Try H1 (#)
  const h1Match = content.match(/^#\s+(.+)$/m);
  if (h1Match) {
    return h1Match[1].trim();
  }
  
  // Try H2 (##)
  const h2Match = content.match(/^##\s+(.+)$/m);
  if (h2Match) {
    return h2Match[1].trim();
  }
  
  // Fallback to filename
  const filename = path.split("/").pop()?.replace(".md", "");
  return filename || "Documentation";
}

/**
 * Extract keywords from Markdown
 */
function extractMarkdownKeywords(content: string): string[] {
  const keywords = new Set<string>();
  
  // Extract from headings
  const headings = content.match(/^#{1,6}\s+(.+)$/gm) || [];
  headings.forEach((heading) => {
    const words = extractKeywordsFromText(heading);
    words.forEach((w) => keywords.add(w));
  });
  
  // Extract from bold text
  const bold = content.match(/\*\*([^*]+)\*\*/g) || [];
  bold.forEach((text) => {
    const cleaned = text.replace(/\*\*/g, "");
    const words = extractKeywordsFromText(cleaned);
    words.forEach((w) => keywords.add(w));
  });
  
  // Extract from inline code
  const inlineCode = content.match(/`([^`]+)`/g) || [];
  inlineCode.forEach((code) => {
    const cleaned = code.replace(/`/g, "");
    if (cleaned.length < 30) {
      keywords.add(cleaned.toLowerCase());
    }
  });
  
  // Extract technical terms
  const techTerms = extractTechnicalTerms(content);
  techTerms.forEach((term) => keywords.add(term));
  
  return Array.from(keywords).slice(0, 50); // Limit to 50
}

/**
 * Extract summary from Markdown
 */
function extractMarkdownSummary(content: string): string {
  // Remove headings
  const withoutHeadings = content.replace(/^#{1,6}\s+.+$/gm, "");
  
  // Remove code blocks
  const withoutCode = withoutHeadings.replace(/```[\s\S]*?```/g, "");
  
  // Get first paragraph
  const paragraphs = withoutCode
    .split("\n\n")
    .filter((p) => p.trim().length > 0);
  
  if (paragraphs.length > 0) {
    return paragraphs[0].replace(/\n/g, " ").trim().slice(0, 200);
  }
  
  return "Documentation";
}
```

### 5.5 Keyword Extractor

```typescript
// src/server/discovery/keyword-extractor.ts

const STOP_WORDS = new Set([
  "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "is", "are", "was", "were", "be", "been", "being",
  "have", "has", "had", "do", "does", "did", "will", "would", "should",
  "can", "could", "may", "might", "must", "this", "that", "these", "those",
  "it", "its", "you", "your", "we", "our", "they", "their", "from", "by",
]);

/**
 * Extract meaningful keywords from text
 */
export function extractKeywordsFromText(text: string): string[] {
  // Lowercase and split into words
  const words = text
    .toLowerCase()
    .split(/\W+/)
    .filter(Boolean);
  
  // Filter out stop words and short words
  const keywords = words.filter((word) => {
    if (STOP_WORDS.has(word)) return false;
    if (word.length < 3) return false;
    return true;
  });
  
  // Return unique keywords
  return Array.from(new Set(keywords));
}

/**
 * Extract technical terms (GCP, Terraform, etc.)
 */
export function extractTechnicalTerms(text: string): string[] {
  const terms = new Set<string>();
  
  // GCP resource patterns
  const gcpPatterns = [
    /google_[a-z_]+/g,           // google_storage_bucket
    /\b(gcs|gce|gke|gcf|gae|iam|vpc|nat)\b/gi,  // GCP abbreviations
  ];
  
  gcpPatterns.forEach((pattern) => {
    const matches = text.match(pattern) || [];
    matches.forEach((match) => terms.add(match.toLowerCase()));
  });
  
  // Terraform keywords
  const tfTerms = [
    "resource",
    "module",
    "variable",
    "output",
    "data",
    "terraform",
    "provider",
  ];
  
  tfTerms.forEach((term) => {
    if (text.toLowerCase().includes(term)) {
      terms.add(term);
    }
  });
  
  return Array.from(terms);
}
```

### 5.6 Index Storage

```typescript
// src/server/discovery/index-storage.ts

import * as fs from "fs/promises";
import * as path from "path";
import * as os from "os";

const INDEX_DIR = path.join(os.homedir(), ".config", "gandalf");
const INDEX_PATH = path.join(INDEX_DIR, "repo-index.json");

/**
 * Save index to disk
 */
export async function saveIndex(index: FullIndex): Promise<void> {
  // Ensure directory exists
  await fs.mkdir(INDEX_DIR, { recursive: true });
  
  // Write JSON (pretty-printed for readability)
  await fs.writeFile(
    INDEX_PATH,
    JSON.stringify(index, null, 2),
    "utf-8"
  );
  
  console.error(`[index-storage] Saved index to ${INDEX_PATH}`);
}

/**
 * Load index from disk
 */
export async function loadIndex(): Promise<FullIndex | null> {
  try {
    const content = await fs.readFile(INDEX_PATH, "utf-8");
    const index = JSON.parse(content) as FullIndex;
    
    console.error(`[index-storage] Loaded index from ${INDEX_PATH}`);
    return index;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      console.error(`[index-storage] No index file found at ${INDEX_PATH}`);
      return null;
    }
    throw error;
  }
}

/**
 * Check if index exists
 */
export async function indexExists(): Promise<boolean> {
  try {
    await fs.access(INDEX_PATH);
    return true;
  } catch {
    return false;
  }
}

/**
 * Delete index file
 */
export async function deleteIndex(): Promise<void> {
  try {
    await fs.unlink(INDEX_PATH);
    console.error(`[index-storage] Deleted index at ${INDEX_PATH}`);
  } catch (error: any) {
    if (error.code !== "ENOENT") {
      throw error;
    }
  }
}
```

---

## 6. Phase 2: Search & Retrieval

### 6.1 Search Algorithm

```typescript
// src/server/discovery/search.ts

import { loadIndex } from "./index-storage.js";
import { fetchGitHubFile } from "../sources/github.js";
import { extractKeywordsFromText } from "./keyword-extractor.js";

export interface SearchResult {
  repo: string;
  path: string;
  title: string;
  type: "terraform" | "markdown";
  score: number;
  excerpt: string;
  resourceTypes?: string[];
  fullContent?: string;  // Optional: include full content
}

export interface SearchOptions {
  resourceType?: string;      // Filter by Terraform resource type
  fileType?: "terraform" | "markdown";
  repo?: string;              // Filter to specific repo
  minScore?: number;          // Minimum relevance score
  limit?: number;             // Max results to return
}

/**
 * Search through indexed files
 */
export async function searchExamples(
  query: string,
  options: SearchOptions = {}
): Promise<SearchResult[]> {
  const {
    resourceType,
    fileType,
    repo,
    minScore = 5,
    limit = 5,
  } = options;
  
  // Load index
  const index = await loadIndex();
  
  if (!index) {
    throw new Error(
      "No index found. Run rebuild_index to create one."
    );
  }
  
  // Prepare query terms
  const queryLower = query.toLowerCase();
  const queryTerms = extractKeywordsFromText(query);
  
  console.error(
    `[search] Searching for: "${query}" (terms: ${queryTerms.join(", ")})`
  );
  
  // Score all files
  const allResults: Array<{
    file: FileMetadata;
    repo: string;
    score: number;
  }> = [];
  
  // Filter repos if specified
  const reposToSearch = repo
    ? { [repo]: index.repos[repo] }
    : index.repos;
  
  for (const [repoName, repoData] of Object.entries(reposToSearch)) {
    if (!repoData) continue;
    
    for (const file of repoData.files) {
      // Apply filters
      if (fileType && file.type !== fileType) continue;
      if (resourceType && !file.resourceTypes?.includes(resourceType)) continue;
      
      // Calculate score
      const score = scoreFile(file, queryTerms, resourceType);
      
      if (score >= minScore) {
        allResults.push({ file, repo: repoName, score });
      }
    }
  }
  
  console.error(
    `[search] Found ${allResults.length} matches (minScore=${minScore})`
  );
  
  // Sort by score and take top N
  const topResults = allResults
    .sort((a, b) => b.score - a.score)
    .slice(0, limit);
  
  // Fetch content for top results
  const resultsWithContent = await Promise.all(
    topResults.map(async (result) => {
      const content = await fetchGitHubFile(result.repo, result.file.path);
      const excerpt = extractExcerpt(content, query);
      
      return {
        repo: result.repo,
        path: result.file.path,
        title: result.file.title,
        type: result.file.type,
        score: result.score,
        excerpt,
        resourceTypes: result.file.resourceTypes,
      };
    })
  );
  
  console.error(`[search] Returning top ${resultsWithContent.length} results`);
  
  return resultsWithContent;
}

/**
 * Score a file based on query relevance
 */
function scoreFile(
  file: FileMetadata,
  queryTerms: string[],
  resourceType?: string
): number {
  let score = 0;
  
  const titleLower = file.title.toLowerCase();
  const pathLower = file.path.toLowerCase();
  const summaryLower = file.summary.toLowerCase();
  
  // === Title matching (highest weight) ===
  for (const term of queryTerms) {
    if (titleLower.includes(term)) {
      score += 10;
    }
  }
  
  // === Keyword matching ===
  for (const term of queryTerms) {
    const matchCount = file.keywords.filter((kw) =>
      kw.includes(term)
    ).length;
    score += matchCount * 3;
  }
  
  // === Path matching ===
  for (const term of queryTerms) {
    if (pathLower.includes(term)) {
      score += 2;
    }
  }
  
  // === Resource type exact match ===
  if (resourceType && file.resourceTypes?.includes(resourceType)) {
    score += 20;  // Very strong signal
  }
  
  // === Resource type partial match ===
  if (file.resourceTypes) {
    for (const rt of file.resourceTypes) {
      for (const term of queryTerms) {
        if (rt.includes(term)) {
          score += 5;
        }
      }
    }
  }
  
  // === File type bonus ===
  if (file.type === "terraform") {
    const infraTerms = ["bucket", "vpc", "network", "instance", "database"];
    const hasInfraTerm = queryTerms.some((t) => infraTerms.includes(t));
    if (hasInfraTerm) {
      score *= 1.2;  // 20% bonus
    }
  }
  
  // === Summary matching ===
  for (const term of queryTerms) {
    if (summaryLower.includes(term)) {
      score += 1;
    }
  }
  
  return Math.round(score);
}

/**
 * Extract relevant excerpt from content
 */
function extractExcerpt(
  content: string,
  query: string,
  contextChars: number = 150
): string {
  const queryLower = query.toLowerCase();
  const contentLower = content.toLowerCase();
  
  // Try exact query match
  let index = contentLower.indexOf(queryLower);
  
  // If not found, try first term
  if (index === -1) {
    const firstTerm = query.split(/\s+/)[0]?.toLowerCase();
    if (firstTerm) {
      index = contentLower.indexOf(firstTerm);
    }
  }
  
  // If still not found, use beginning
  if (index === -1) {
    return content.slice(0, contextChars * 2) + "...";
  }
  
  // Extract context around match
  const start = Math.max(0, index - contextChars);
  const end = Math.min(content.length, index + query.length + contextChars);
  
  let excerpt = content.slice(start, end);
  
  // Clean up
  excerpt = excerpt.replace(/\n+/g, " ").trim();
  
  // Add ellipsis
  if (start > 0) excerpt = "..." + excerpt;
  if (end < content.length) excerpt = excerpt + "...";
  
  return excerpt;
}
```

### 6.2 Advanced Search Features

```typescript
/**
 * Find files similar to a reference file
 */
export async function findSimilar(
  repo: string,
  path: string,
  limit: number = 5
): Promise<SearchResult[]> {
  const index = await loadIndex();
  if (!index) throw new Error("No index found");
  
  // Find reference file
  const refFile = index.repos[repo]?.files.find((f) => f.path === path);
  if (!refFile) throw new Error(`File not found: ${repo}/${path}`);
  
  // Use its keywords and resource types as query
  const queryTerms = [...refFile.keywords];
  if (refFile.resourceTypes) {
    queryTerms.push(...refFile.resourceTypes);
  }
  
  // Search
  const allResults: Array<{
    file: FileMetadata;
    repo: string;
    score: number;
  }> = [];
  
  for (const [repoName, repoData] of Object.entries(index.repos)) {
    for (const file of repoData.files) {
      // Skip the reference file itself
      if (file.path === path && repoName === repo) continue;
      
      const score = scoreFile(file, queryTerms);
      
      if (score > 0) {
        allResults.push({ file, repo: repoName, score });
      }
    }
  }
  
  // Return top matches (without fetching full content)
  return allResults
    .sort((a, b) => b.score - a.score)
    .slice(0, limit)
    .map((r) => ({
      repo: r.repo,
      path: r.file.path,
      title: r.file.title,
      type: r.file.type,
      score: r.score,
      excerpt: r.file.summary,
      resourceTypes: r.file.resourceTypes,
    }));
}

/**
 * List all indexed repositories
 */
export async function listIndexedRepos(): Promise<
  Array<{
    repo: string;
    fileCount: number;
    lastIndexed: string;
  }>
> {
  const index = await loadIndex();
  if (!index) return [];
  
  return Object.entries(index.repos).map(([repo, data]) => ({
    repo,
    fileCount: data.fileCount,
    lastIndexed: data.lastIndexed,
  }));
}
```

---

## 7. Phase 3: MCP Tool Integration

### 7.1 New Tool Definitions

```typescript
// src/server/tools.ts (additions)

import { searchExamples, listIndexedRepos } from "./discovery/search.js";
import { buildFullIndex, rebuildRepoIndex } from "./discovery/index-builder.js";

/**
 * Add to listTools() function
 */
export function listTools(): Tool[] {
  return [
    // ... existing tools (list_topics, get_doc, search_docs)
    
    // NEW: Search discovered examples
    {
      name: "search_examples",
      description:
        "Search through all auto-discovered Terraform examples and architecture docs. " +
        "Returns relevant files based on keywords and resource types. " +
        "Use when you need code examples or patterns for specific resources.",
      inputSchema: {
        type: "object",
        properties: {
          query: {
            type: "string",
            description:
              "What you're looking for (e.g., 'GCS bucket', 'VPC network', 'BigQuery')",
          },
          resource_type: {
            type: "string",
            description:
              "Terraform resource type if known (e.g., 'google_storage_bucket'). " +
              "This will boost matching files.",
          },
          file_type: {
            type: "string",
            enum: ["terraform", "markdown"],
            description: "Filter to only .tf or .md files",
          },
          limit: {
            type: "number",
            description: "Maximum number of results (default: 5, max: 20)",
            default: 5,
          },
        },
        required: ["query"],
      },
    },
    
    // NEW: Rebuild index
    {
      name: "rebuild_index",
      description:
        "Rebuild the repository index. Use when documentation has been updated. " +
        "Can rebuild all repos or a specific repo.",
      inputSchema: {
        type: "object",
        properties: {
          repo: {
            type: "string",
            description:
              "Specific repo to rebuild (e.g., 'acme-corp/terraform-examples'), " +
              "or omit to rebuild all repos",
          },
        },
      },
    },
    
    // NEW: List indexed repos
    {
      name: "list_indexed_repos",
      description:
        "List all repositories that have been indexed, with file counts and last index time.",
      inputSchema: {
        type: "object",
        properties: {},
      },
    },
  ];
}
```

### 7.2 Tool Implementations

```typescript
/**
 * Add to callTool() function
 */
export async function callTool(
  name: string,
  args: Record<string, unknown>
): Promise<CallToolResult> {
  try {
    switch (name) {
      // ... existing cases
      
      case "search_examples":
        return await searchExamplesHandler(
          args.query as string,
          {
            resourceType: args.resource_type as string | undefined,
            fileType: args.file_type as "terraform" | "markdown" | undefined,
            limit: (args.limit as number) || 5,
          }
        );
      
      case "rebuild_index":
        return await rebuildIndexHandler(args.repo as string | undefined);
      
      case "list_indexed_repos":
        return await listIndexedReposHandler();
      
      default:
        return {
          content: [{ type: "text", text: `Unknown tool: ${name}` }],
          isError: true,
        };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Error executing ${name}: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handler: search_examples
 */
async function searchExamplesHandler(
  query: string,
  options: {
    resourceType?: string;
    fileType?: "terraform" | "markdown";
    limit?: number;
  }
): Promise<CallToolResult> {
  if (!query) {
    return {
      content: [{ type: "text", text: "Error: query parameter is required" }],
      isError: true,
    };
  }
  
  const limit = Math.min(options.limit || 5, 20);
  
  const results = await searchExamples(query, {
    resourceType: options.resourceType,
    fileType: options.fileType,
    limit,
  });
  
  if (results.length === 0) {
    return {
      content: [
        {
          type: "text",
          text:
            `No examples found for "${query}".\n\n` +
            `Try different search terms or run \`rebuild_index\` if you recently added new files.`,
        },
      ],
    };
  }
  
  const output = `# Search Results: "${query}"

Found ${results.length} example(s):

${results
  .map(
    (r, i) => `## ${i + 1}. ${r.title}

**Repository**: ${r.repo}  
**File**: ${r.path}  
**Type**: ${r.type}  
${r.resourceTypes ? `**Resources**: ${r.resourceTypes.join(", ")}\n` : ""}**Relevance**: ${r.score}

**Excerpt**:
> ${r.excerpt}

---
`
  )
  .join("\n")}

Use these examples as reference when generating infrastructure code.`;
  
  return {
    content: [{ type: "text", text: output }],
  };
}

/**
 * Handler: rebuild_index
 */
async function rebuildIndexHandler(
  repo?: string
): Promise<CallToolResult> {
  try {
    if (repo) {
      // Rebuild specific repo
      await rebuildRepoIndex(repo);
      
      return {
        content: [
          {
            type: "text",
            text: `✓ Successfully rebuilt index for ${repo}`,
          },
        ],
      };
    } else {
      // Rebuild all repos
      const index = await buildFullIndex();
      
      const totalFiles = Object.values(index.repos).reduce(
        (sum, repoData) => sum + repoData.fileCount,
        0
      );
      
      const repoCount = Object.keys(index.repos).length;
      
      return {
        content: [
          {
            type: "text",
            text:
              `✓ Successfully rebuilt index\n\n` +
              `**Repositories**: ${repoCount}\n` +
              `**Total Files**: ${totalFiles}\n` +
              `**Index Location**: ~/.config/gandalf/repo-index.json`,
          },
        ],
      };
    }
  } catch (error) {
    return {
      content: [
        {
          type: "text",
          text: `Failed to rebuild index: ${
            error instanceof Error ? error.message : String(error)
          }`,
        },
      ],
      isError: true,
    };
  }
}

/**
 * Handler: list_indexed_repos
 */
async function listIndexedReposHandler(): Promise<CallToolResult> {
  const repos = await listIndexedRepos();
  
  if (repos.length === 0) {
    return {
      content: [
        {
          type: "text",
          text:
            "No repositories have been indexed yet.\n\n" +
            "Run `rebuild_index` to create the index.",
        },
      ],
    };
  }
  
  const output = `# Indexed Repositories

| Repository | Files | Last Indexed |
|------------|-------|--------------|
${repos
  .map(
    (r) =>
      `| ${r.repo} | ${r.fileCount} | ${new Date(r.lastIndexed).toLocaleString()} |`
  )
  .join("\n")}

**Total**: ${repos.length} repositories, ${repos.reduce(
    (sum, r) => sum + r.fileCount,
    0
  )} files

Run \`search_examples\` to search across these files.`;
  
  return {
    content: [{ type: "text", text: output }],
  };
}
```

### 7.3 Agent Workflow Updates

The agent should use the new tools in this pattern:

```
User Request: "Create a GCS bucket for ML training data"
    ↓
Agent Decision Tree:
    1. Is this an infrastructure request? YES
    2. Do I need to check standards? YES
    3. Do I need examples? YES
    ↓
Agent Actions:
    1. Call get_doc("naming-standards")
       → Get naming pattern: {org}-{env}-{team}-{resource}-{purpose}
    
    2. Call search_examples("GCS bucket ML", {
         resource_type: "google_storage_bucket"
       })
       → Get 3 relevant examples with lifecycle, labels, etc.
    
    3. Call get_doc("security-policies") (if needed)
       → Verify encryption, IAM requirements
    ↓
Agent Synthesis:
    - Use naming pattern from standards
    - Use configuration patterns from examples
    - Apply security requirements from policies
    - Generate compliant Terraform code
```

---

## 8. Phase 4: Configuration & Customization

### 8.1 Discovery Repository Configuration

Create `src/server/config/discovery-repos.ts`:

```typescript
export interface RepoConfig {
  repo: string;
  description: string;
  branch?: string;
  include: string[];
  exclude?: string[];
  priority: number;
}

export const DISCOVERY_REPOS: RepoConfig[] = [
  {
    repo: "YOUR_ORG/terraform-examples",
    description: "Real-world Terraform examples for all GCP resources",
    branch: "main",
    include: [
      "**/*.tf",
      "**/*.md",
    ],
    exclude: [
      ".git/**",
      "**/node_modules/**",
      "**/.terraform/**",
      "**/terraform.tfstate*",
    ],
    priority: 0.9,
  },
  {
    repo: "YOUR_ORG/architecture",
    description: "Architecture patterns and design docs",
    branch: "main",
    include: [
      "patterns/**/*.md",
      "reference/**/*.md",
    ],
    priority: 0.7,
  },
  {
    repo: "YOUR_ORG/terraform-modules",
    description: "Internal Terraform module documentation",
    branch: "main",
    include: [
      "modules/**/README.md",
      "modules/**/docs/**/*.md",
    ],
    priority: 1.0,
  },
];
```

### 8.2 Updated doc-sources.ts Structure

Keep critical docs hardcoded:

```typescript
// src/server/config/doc-sources.ts

export const DOC_SOURCES: DocConfig[] = [
  // ============================================
  // INTERNAL: High-priority standards
  // ============================================
  {
    topic: "naming-standards",
    title: "Resource Naming Standards",
    description: "Required naming conventions for all GCP resources",
    category: "internal",
    priority: 1.0,
    source: {
      type: "github",
      repo: "YOUR_ORG/infra-standards",
      path: "naming-conventions.md",
      branch: "main",
    },
  },
  {
    topic: "security-policies",
    title: "GCP Security Policies",
    description: "Security requirements, IAM policies, compliance guidelines",
    category: "internal",
    priority: 1.0,
    source: {
      type: "github",
      repo: "YOUR_ORG/infra-standards",
      path: "security/gcp-policies.md",
      branch: "main",
    },
  },
  {
    topic: "terraform-modules",
    title: "Internal Terraform Modules Catalog",
    description: "Registry of approved internal Terraform modules",
    category: "internal",
    priority: 1.0,
    source: {
      type: "github",
      repo: "YOUR_ORG/terraform-modules",
      path: "README.md",
      branch: "main",
    },
  },
  
  // ============================================
  // PUBLIC: GCP Documentation
  // ============================================
  {
    topic: "gcp-storage-bucket",
    title: "GCP Cloud Storage Bucket",
    description: "Google Cloud Storage bucket creation and configuration",
    category: "public",
    priority: 0.7,
    source: {
      type: "gcp",
      product: "storage",
      page: "docs/creating-buckets",
    },
  },
  {
    topic: "gcp-iam",
    title: "GCP IAM Overview",
    description: "Google Cloud Identity and Access Management",
    category: "public",
    priority: 0.7,
    source: {
      type: "gcp",
      product: "iam",
      page: "docs/overview",
    },
  },
  // ... more GCP docs for: VPC, BigQuery, Pub/Sub, etc.
];
```

**Strategy:**
- **Hardcoded** = Critical standards, security policies, module catalogs
- **Discovered** = Examples, patterns, module-specific READMEs

### 8.3 Agent Prompt Updates

Update `src/templates/agent.md`:

```markdown
---
description: Infrastructure engineer for GCP/Terraform with organization documentation
mode: primary
temperature: 0.2
tools:
  orgdocs_*: true
---

You are a senior infrastructure engineer at YOUR_ORG.

## Documentation Tools Available

You have access to two types of documentation:

### 1. Curated Documentation (Official Standards)
Use these tools for official policies and standards:
- `list_topics()` - List all curated documentation topics
- `get_doc(topic)` - Fetch a specific standard by topic name
- `search_docs(query)` - Search across curated documentation

Key topics:
- `naming-standards` - Resource naming conventions (ALWAYS check first)
- `security-policies` - Security and compliance requirements
- `terraform-modules` - Internal module catalog

### 2. Discovered Examples (Code & Patterns)
Use these tools for real-world examples:
- `search_examples(query)` - Search Terraform examples and architecture patterns
- `list_indexed_repos()` - See which repos are indexed

## Recommended Workflow

When generating infrastructure code:

1. **Check Official Standards** (if relevant):
   - Call `get_doc("naming-standards")` for naming patterns
   - Call `get_doc("security-policies")` for compliance requirements
   - Call `get_doc("terraform-modules")` to see if an internal module exists

2. **Find Relevant Examples**:
   - Call `search_examples(resource_description)` to find code examples
   - Include resource type if known (e.g., `google_storage_bucket`)

3. **Synthesize**:
   - Follow naming conventions from standards
   - Use configuration patterns from examples
   - Apply security requirements from policies
   - Generate compliant, production-ready code

## Examples

**Good workflow:**
```
User: "Create a GCS bucket for ML training data"

You:
1. Call get_doc("naming-standards")
   → Learn pattern: {org}-{env}-{team}-{resource}-{purpose}

2. Call search_examples("GCS bucket ML training", {
     resource_type: "google_storage_bucket"
   })
   → Find examples with lifecycle rules, labels, encryption

3. Generate code combining:
   - Correct naming: acme-dev-ml-bucket-training-data
   - Best practices from examples: lifecycle, labels, encryption
   - Security requirements: uniform_bucket_level_access = true
```

## Index Management

If documentation has been updated:
- Tell the user: "I can rebuild the index to pick up new files. Would you like me to?"
- If yes, call `rebuild_index()`

If search returns no results:
- Suggest rebuilding the index
- Suggest trying different search terms
- Fall back to curated docs
```

---

## 9. Testing Strategy

### 9.1 Unit Tests

**Test: File Analyzer**
```typescript
// src/server/discovery/__tests__/file-analyzer.test.ts

describe("analyzeTerraformFile", () => {
  it("extracts resource types correctly", () => {
    const content = `
resource "google_storage_bucket" "bucket" {
  name = "test-bucket"
}

resource "google_storage_bucket_iam_member" "member" {
  bucket = google_storage_bucket.bucket.name
}
`;
    
    const result = analyzeTerraformFile(content, "test.tf");
    
    expect(result.resourceTypes).toEqual([
      "google_storage_bucket",
      "google_storage_bucket_iam_member",
    ]);
  });
  
  it("extracts title from comment", () => {
    const content = `# GCS Bucket for ML Training Data
resource "google_storage_bucket" "bucket" {
  name = "test-bucket"
}`;
    
    const result = analyzeTerraformFile(content, "test.tf");
    
    expect(result.title).toBe("GCS Bucket for ML Training Data");
  });
  
  it("extracts keywords from content", () => {
    const content = `# GCS bucket with lifecycle rules
resource "google_storage_bucket" "bucket" {
  name = "test-bucket"
  lifecycle_rule {
    action { type = "Delete" }
  }
}`;
    
    const result = analyzeTerraformFile(content, "test.tf");
    
    expect(result.keywords).toContain("gcs");
    expect(result.keywords).toContain("bucket");
    expect(result.keywords).toContain("lifecycle");
  });
});

describe("analyzeMarkdownFile", () => {
  it("extracts title from H1", () => {
    const content = `# Shared VPC Pattern\n\nThis pattern...`;
    
    const result = analyzeMarkdownFile(content, "test.md");
    
    expect(result.title).toBe("Shared VPC Pattern");
  });
  
  it("extracts keywords from headings and bold", () => {
    const content = `# VPC Network Pattern

## Overview
Use this for **shared VPC** across projects.

\`\`\`
google_compute_network
\`\`\`
`;
    
    const result = analyzeMarkdownFile(content, "test.md");
    
    expect(result.keywords).toContain("vpc");
    expect(result.keywords).toContain("network");
    expect(result.keywords).toContain("shared");
  });
});
```

**Test: Search Algorithm**
```typescript
// src/server/discovery/__tests__/search.test.ts

describe("scoreFile", () => {
  it("scores title match higher than keyword match", () => {
    const file: FileMetadata = {
      path: "test.tf",
      type: "terraform",
      title: "GCS Bucket Configuration",
      keywords: ["config", "storage"],
      summary: "...",
      size: 100,
      sha: "abc",
    };
    
    const score = scoreFile(file, ["bucket"], undefined);
    
    expect(score).toBeGreaterThan(0);
    // Title match = 10 points
    expect(score).toBe(10);
  });
  
  it("gives huge boost for exact resource type match", () => {
    const file: FileMetadata = {
      path: "test.tf",
      type: "terraform",
      title: "Bucket",
      keywords: ["bucket"],
      resourceTypes: ["google_storage_bucket"],
      summary: "...",
      size: 100,
      sha: "abc",
    };
    
    const score = scoreFile(file, ["bucket"], "google_storage_bucket");
    
    // Title (10) + keyword (3) + resource type (20) = 33+
    expect(score).toBeGreaterThan(30);
  });
});

describe("extractExcerpt", () => {
  it("extracts context around query match", () => {
    const content = "This is some text before the KEYWORD and some text after it.";
    
    const excerpt = extractExcerpt(content, "KEYWORD", 10);
    
    expect(excerpt).toContain("KEYWORD");
    expect(excerpt).toContain("before");
    expect(excerpt).toContain("after");
  });
  
  it("adds ellipsis when truncated", () => {
    const content = "A".repeat(500);
    
    const excerpt = extractExcerpt(content, "AAAA", 50);
    
    expect(excerpt).toContain("...");
  });
});
```

### 9.2 Integration Tests

**Test: Index Building**
```typescript
// src/server/discovery/__tests__/integration.test.ts

describe("Index Building Integration", () => {
  it("builds index for test repo", async () => {
    const config: RepoConfig = {
      repo: "YOUR_ORG/test-repo",
      description: "Test",
      include: ["**/*.tf"],
      priority: 1.0,
    };
    
    const index = await buildRepoIndex(config);
    
    expect(index.fileCount).toBeGreaterThan(0);
    expect(index.files).toBeDefined();
    expect(index.files[0]).toHaveProperty("path");
    expect(index.files[0]).toHaveProperty("keywords");
  });
  
  it("saves and loads index correctly", async () => {
    const testIndex: FullIndex = {
      version: "1.0",
      createdAt: new Date().toISOString(),
      repos: {
        "test/repo": {
          lastIndexed: new Date().toISOString(),
          fileCount: 1,
          files: [
            {
              path: "test.tf",
              type: "terraform",
              title: "Test",
              keywords: ["test"],
              summary: "Test file",
              size: 100,
              sha: "abc",
            },
          ],
        },
      },
    };
    
    await saveIndex(testIndex);
    const loaded = await loadIndex();
    
    expect(loaded).toEqual(testIndex);
  });
});
```

### 9.3 End-to-End Tests

**Test: Complete Search Flow**
```typescript
describe("E2E: Search Flow", () => {
  beforeAll(async () => {
    // Build index for test repos
    await buildFullIndex();
  });
  
  it("searches and returns relevant results", async () => {
    const results = await searchExamples("GCS bucket", {
      resourceType: "google_storage_bucket",
      limit: 5,
    });
    
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty("repo");
    expect(results[0]).toHaveProperty("path");
    expect(results[0]).toHaveProperty("excerpt");
    expect(results[0].score).toBeGreaterThan(0);
  });
  
  it("returns empty for nonsense query", async () => {
    const results = await searchExamples("xyzabc123nonsense", {
      limit: 5,
    });
    
    expect(results.length).toBe(0);
  });
});
```

---

## 10. Performance Considerations

### 10.1 Index Build Performance

**Current Design:**
- Sequential file fetching (one at a time)
- No parallelization

**Optimization:**
```typescript
// Parallel file fetching
async function buildRepoIndex(config: RepoConfig): Promise<RepoIndex> {
  // ... get file list
  
  // Fetch and analyze in parallel (batches of 10)
  const BATCH_SIZE = 10;
  const fileMetadata: FileMetadata[] = [];
  
  for (let i = 0; i < relevantFiles.length; i += BATCH_SIZE) {
    const batch = relevantFiles.slice(i, i + BATCH_SIZE);
    
    const results = await Promise.all(
      batch.map((file) => analyzeGitHubFile(owner, repo, file.path, file.sha))
    );
    
    fileMetadata.push(...results);
  }
  
  return { lastIndexed: new Date().toISOString(), fileCount: fileMetadata.length, files: fileMetadata };
}
```

**Benchmarks (estimated):**
- 100 files, sequential: ~60 seconds (600ms/file)
- 100 files, parallel (10): ~10 seconds (100ms/file effective)

### 10.2 Search Performance

**Current Design:**
- Load entire index into memory
- Linear scan through all files
- Score each file

**Complexity:**
- Time: O(n * m) where n = files, m = query terms
- Space: O(n) for loaded index

**Optimization Opportunities:**
1. **Pre-compute keyword index:**
   ```json
   {
     "keywordIndex": {
       "bucket": ["file1.tf", "file2.md"],
       "vpc": ["file3.tf"],
       ...
     }
   }
   ```
   Reduces search to O(m + k) where k = matching files

2. **Inverted index for resource types:**
   ```json
   {
     "resourceIndex": {
       "google_storage_bucket": ["file1.tf", "file2.tf"],
       ...
     }
   }
   ```

### 10.3 GitHub API Rate Limits

**Limits:**
- Authenticated: 5,000 requests/hour
- Unauthenticated: 60 requests/hour

**Index Build Usage:**
- Tree API: 1 request per repo
- Contents API: 1 request per file
- Total: 1 + N requests (N = files)

**Example:**
- 3 repos, 150 files total = ~153 requests
- Well within limits (5000/hour)

**Mitigation:**
- Use conditional requests (ETags) for unchanged files
- Cache file SHAs, only re-fetch if changed
- Implement exponential backoff on rate limit errors

### 10.4 Index Size

**Estimated Size:**
- 500 files × 1KB metadata/file = ~500KB
- JSON formatting overhead: ~50KB
- **Total: ~550KB**

Well within acceptable limits (<1MB).

---

## 11. Error Handling & Edge Cases

### 11.1 GitHub API Errors

**Scenarios:**
1. Authentication failure
2. Rate limit exceeded
3. Repository not found
4. File not found
5. Network timeout

**Handling:**
```typescript
async function fetchGitHubFile(owner: string, repo: string, path: string): Promise<string> {
  try {
    const { data } = await octokit.repos.getContent({ owner, repo, path });
    return Buffer.from((data as any).content, "base64").toString("utf-8");
  } catch (error: any) {
    if (error.status === 404) {
      throw new Error(`File not found: ${owner}/${repo}/${path}`);
    } else if (error.status === 403 && error.response?.headers?.["x-ratelimit-remaining"] === "0") {
      const resetTime = error.response.headers["x-ratelimit-reset"];
      throw new Error(`Rate limit exceeded. Resets at ${new Date(resetTime * 1000).toLocaleString()}`);
    } else if (error.status === 401) {
      throw new Error("Authentication failed. Check GITHUB_TOKEN.");
    } else {
      throw new Error(`GitHub API error: ${error.message}`);
    }
  }
}
```

### 11.2 Index Corruption

**Scenarios:**
1. JSON parse error (corrupted file)
2. Missing required fields
3. Version mismatch

**Handling:**
```typescript
export async function loadIndex(): Promise<FullIndex | null> {
  try {
    const content = await fs.readFile(INDEX_PATH, "utf-8");
    const index = JSON.parse(content) as FullIndex;
    
    // Validate structure
    if (!index.version || !index.repos) {
      throw new Error("Invalid index structure");
    }
    
    // Check version compatibility
    if (index.version !== "1.0") {
      console.warn(`[index-storage] Index version ${index.version} may be incompatible`);
    }
    
    return index;
  } catch (error: any) {
    if (error.code === "ENOENT") {
      return null;
    } else if (error instanceof SyntaxError) {
      console.error("[index-storage] Corrupted index file. Delete and rebuild.");
      throw new Error("Corrupted index file. Run rebuild_index.");
    } else {
      throw error;
    }
  }
}
```

### 11.3 Empty Search Results

**Scenarios:**
1. No matching files
2. Index not built
3. Query too specific

**Handling:**
```typescript
// In search_examples tool handler
if (results.length === 0) {
  return {
    content: [{
      type: "text",
      text:
        `No examples found for "${query}".\n\n` +
        `Suggestions:\n` +
        `- Try broader search terms\n` +
        `- Run \`rebuild_index\` if docs were recently added\n` +
        `- Check \`list_indexed_repos\` to see what's indexed\n` +
        `- Use \`search_docs\` for curated documentation`,
    }],
  };
}
```

### 11.4 Large Files

**Scenarios:**
1. File >1MB (GitHub API limit)
2. Generated files (terraform.tfstate)

**Handling:**
```typescript
// In buildRepoIndex
const relevantFiles = treeData.tree.filter((item) => {
  // ... existing filters
  
  // Skip large files
  if (item.size && item.size > 1_000_000) {
    console.warn(`[index-builder] Skipping large file: ${item.path} (${item.size} bytes)`);
    return false;
  }
  
  return true;
});
```

---

## 12. Deployment & Rollout

### 12.1 Implementation Phases

**Phase 1: Core Infrastructure (Week 1-2)**
- [ ] Implement file analyzer (Terraform & Markdown)
- [ ] Implement keyword extractor
- [ ] Implement index builder
- [ ] Implement index storage
- [ ] Unit tests for analyzers

**Phase 2: Search System (Week 2-3)**
- [ ] Implement search algorithm
- [ ] Implement scoring logic
- [ ] Implement excerpt extraction
- [ ] Integration tests for search

**Phase 3: MCP Integration (Week 3-4)**
- [ ] Add new MCP tools (search_examples, rebuild_index)
- [ ] Update agent prompt
- [ ] Add discovery-repos.ts configuration
- [ ] E2E tests

**Phase 4: Polish & Documentation (Week 4-5)**
- [ ] Error handling improvements
- [ ] Performance optimizations
- [ ] User documentation
- [ ] Migration guide

### 12.2 Rollout Plan

**Step 1: Development Environment**
- Implement and test locally
- Build index for 1-2 test repos
- Validate search results

**Step 2: Staging/Beta**
- Deploy to staging environment
- Index all production repos
- Beta test with 2-3 users
- Gather feedback on:
  - Search relevance
  - Index build time
  - Tool usability

**Step 3: Production Release**
- Document new tools in README
- Provide migration guide
- Announce to team
- Monitor usage and errors

### 12.3 Migration Guide (for users)

```markdown
# Migrating to Self-Discovery

## What's New

The MCP server can now automatically discover and index documentation files
from your GitHub repositories.

## New Tools

- `search_examples(query)` - Search Terraform examples and architecture docs
- `rebuild_index()` - Rebuild the discovery index
- `list_indexed_repos()` - See what's been indexed

## Setup Steps

1. **Configure repos to index:**
   Edit `src/server/config/discovery-repos.ts`:
   ```typescript
   export const DISCOVERY_REPOS = [
     {
       repo: "your-org/terraform-examples",
       include: ["**/*.tf", "**/*.md"],
       priority: 0.9,
     },
   ];
   ```

2. **Build the initial index:**
   In your AI chat:
   ```
   User: Can you rebuild the index?
   Agent: [calls rebuild_index()]
   ```

3. **Start using search:**
   ```
   User: Show me GCS bucket examples
   Agent: [calls search_examples("GCS bucket")]
   ```

## Existing Features Still Work

All existing tools continue to work:
- `list_topics()` - Curated docs
- `get_doc(topic)` - Fetch by topic name
- `search_docs(query)` - Search curated docs

Use curated docs for standards, discovered docs for examples.
```

---

## 13. Future Enhancements

### 13.1 Semantic Search (Phase 2)

**Goal:** Understand intent, not just keywords

**Implementation:**
- Use embedding model (OpenAI, Cohere, local)
- Generate embeddings for each file during indexing
- Store embeddings in vector DB (Pinecone, Weaviate, local)
- Query with semantic similarity

**Benefits:**
- "storage bucket" matches "GCS container"
- "network isolation" matches "VPC private subnet"
- Better relevance for fuzzy queries

**Trade-offs:**
- Requires API key / local model
- Slower indexing (embedding generation)
- More complex infrastructure

### 13.2 Real-Time Updates (Webhooks)

**Goal:** Auto-update index when repos change

**Implementation:**
- GitHub webhook on push events
- Webhook handler updates only changed files
- Incremental index updates

**Benefits:**
- Always up-to-date
- No manual rebuild needed

**Trade-offs:**
- Requires webhook endpoint (server)
- More complex infrastructure
- Security considerations (webhook auth)

### 13.3 Multi-Language Support

**Goal:** Support more than just Terraform

**File Types:**
- Python (FastAPI, Flask apps)
- Go (microservices)
- YAML (Kubernetes, GitHub Actions)
- HCL (Packer, Nomad)

**Implementation:**
- Add analyzers for each language
- Extract: imports, functions, classes, etc.
- Index similarly to Terraform

### 13.4 Interactive Index Management

**Goal:** Web UI for managing index

**Features:**
- View indexed files
- Search preview
- Manual re-index buttons
- Add/remove repos
- View statistics

**Implementation:**
- Simple web server (Express, Fastify)
- React/Vue frontend
- REST API for index operations

### 13.5 Collaborative Annotations

**Goal:** Let users annotate examples

**Features:**
- Add notes to files ("This is deprecated")
- Rate examples (thumbs up/down)
- Tag files with categories

**Implementation:**
- Extend index with annotations field
- Store in separate file (user-annotations.json)
- Merge with index during search

---

## 14. Appendices

### Appendix A: Complete Type Definitions

```typescript
// Full type definitions for discovery system

interface FullIndex {
  version: string;
  createdAt: string;
  repos: {
    [repoName: string]: RepoIndex;
  };
}

interface RepoIndex {
  lastIndexed: string;
  fileCount: number;
  files: FileMetadata[];
}

interface FileMetadata {
  path: string;
  type: "terraform" | "markdown";
  title: string;
  keywords: string[];
  resourceTypes?: string[];
  summary: string;
  size: number;
  sha: string;
}

interface RepoConfig {
  repo: string;
  description: string;
  branch?: string;
  include: string[];
  exclude?: string[];
  priority: number;
}

interface SearchResult {
  repo: string;
  path: string;
  title: string;
  type: "terraform" | "markdown";
  score: number;
  excerpt: string;
  resourceTypes?: string[];
}

interface SearchOptions {
  resourceType?: string;
  fileType?: "terraform" | "markdown";
  repo?: string;
  minScore?: number;
  limit?: number;
}
```

### Appendix B: Example Index File

See section 5.1 for detailed example.

### Appendix C: Configuration Examples

See section 8 for complete configuration examples.

### Appendix D: API References

**GitHub APIs Used:**

1. **Get Tree API**
   - Endpoint: `GET /repos/{owner}/{repo}/git/trees/{tree_sha}`
   - Purpose: List all files in repo
   - Docs: https://docs.github.com/en/rest/git/trees

2. **Get Content API**
   - Endpoint: `GET /repos/{owner}/{repo}/contents/{path}`
   - Purpose: Fetch file content
   - Docs: https://docs.github.com/en/rest/repos/contents

**Anthropic MCP SDK:**

- Package: `@modelcontextprotocol/sdk`
- Version: `^1.0.0`
- Docs: https://modelcontextprotocol.io/

**Libraries:**

- `minimatch`: Glob pattern matching
- `@octokit/rest`: GitHub API client

---

## Conclusion

This comprehensive plan outlines the complete implementation of a self-discovery system for the gandalf-secret-agent-remix MCP server. The system will:

1. **Automatically index** documentation from GitHub repositories
2. **Enable intelligent search** across discovered content
3. **Integrate seamlessly** with existing MCP tools
4. **Scale effortlessly** as documentation grows

The phased approach ensures iterative progress with testable milestones, while the modular architecture allows for future enhancements like semantic search and real-time updates.

**Key Success Metrics:**
- ✅ Index build completes in <30 seconds for 100 files
- ✅ Search returns relevant results in <500ms
- ✅ Agent successfully uses examples in code generation
- ✅ Zero manual configuration for new example files

**Next Steps:**
1. Review and approve this plan
2. Set up development environment
3. Begin Phase 1 implementation
4. Schedule weekly progress reviews

---

**Document Status:** Ready for Implementation  
**Last Updated:** 2026-01-18  
**Maintainer:** Development Team
