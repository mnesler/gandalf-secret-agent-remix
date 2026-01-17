/**
 * GitHub source adapter.
 * Fetches markdown content from GitHub repositories.
 * 
 * Auth priority:
 * 1. Try `gh` CLI (uses existing auth from `gh auth login`)
 * 2. Fall back to GITHUB_TOKEN env var
 */

import { docCache } from "../cache.js";
import type { GitHubSource } from "../config/doc-sources.js";

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Check if gh CLI is available and authenticated
 */
async function isGhCliAvailable(): Promise<boolean> {
  try {
    const proc = Bun.spawn(["gh", "auth", "status"], {
      stdout: "pipe",
      stderr: "pipe",
    });
    const exitCode = await proc.exited;
    return exitCode === 0;
  } catch {
    return false;
  }
}

/**
 * Fetch content using gh CLI
 */
async function fetchWithGhCli(source: GitHubSource): Promise<string> {
  const { repo, path, branch = "main" } = source;
  
  const proc = Bun.spawn(
    ["gh", "api", `/repos/${repo}/contents/${path}?ref=${branch}`, "-H", "Accept: application/vnd.github.v3.raw"],
    {
      stdout: "pipe",
      stderr: "pipe",
    }
  );
  
  const exitCode = await proc.exited;
  
  if (exitCode !== 0) {
    const stderr = await new Response(proc.stderr).text();
    if (stderr.includes("404") || stderr.includes("Not Found")) {
      throw new Error(`Document not found: ${repo}/${path}`);
    }
    throw new Error(`gh CLI error: ${stderr}`);
  }
  
  return await new Response(proc.stdout).text();
}

/**
 * Fetch content using GitHub REST API with token
 */
async function fetchWithToken(source: GitHubSource, token: string): Promise<string> {
  const { repo, path, branch = "main" } = source;
  const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${path}?ref=${branch}`;
  
  const response = await fetch(url, {
    headers: {
      Accept: "application/vnd.github.v3.raw",
      "User-Agent": "Org-Docs-MCP-Server",
      Authorization: `Bearer ${token}`,
    },
  });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Document not found: ${repo}/${path}`);
    }
    if (response.status === 403) {
      throw new Error(`GitHub API rate limit exceeded.`);
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  return await response.text();
}

/**
 * Fetch content from a GitHub repository.
 * Tries gh CLI first, falls back to GITHUB_TOKEN.
 */
export async function fetchFromGitHub(source: GitHubSource): Promise<string> {
  const cacheKey = `github:${source.repo}:${source.path}:${source.branch || "main"}`;
  
  const cached = docCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  let content: string;
  
  // Try gh CLI first
  if (await isGhCliAvailable()) {
    content = await fetchWithGhCli(source);
  } else {
    // Fall back to GITHUB_TOKEN
    const token = process.env.GITHUB_TOKEN;
    if (!token) {
      throw new Error(
        "GitHub authentication required. Either:\n" +
        "  1. Install and authenticate gh CLI: gh auth login\n" +
        "  2. Set GITHUB_TOKEN environment variable"
      );
    }
    content = await fetchWithToken(source, token);
  }
  
  docCache.set(cacheKey, content);
  
  return content;
}

/**
 * Check if GitHub source is accessible (for health checks)
 */
export async function checkGitHubAccess(): Promise<boolean> {
  // Try gh CLI first
  if (await isGhCliAvailable()) {
    return true;
  }
  
  // Fall back to token check
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return false;
  }
  
  try {
    const response = await fetch(`${GITHUB_API_BASE}/rate_limit`, {
      headers: {
        "User-Agent": "Org-Docs-MCP-Server",
        Authorization: `Bearer ${token}`,
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
