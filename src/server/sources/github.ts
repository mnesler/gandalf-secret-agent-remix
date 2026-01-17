/**
 * GitHub source adapter.
 * Fetches markdown content from GitHub repositories.
 */

import { docCache } from "../cache.js";
import type { GitHubSource } from "../config/doc-sources.js";

const GITHUB_API_BASE = "https://api.github.com";

/**
 * Fetch content from a GitHub repository.
 * Uses GITHUB_TOKEN env var for authentication (avoids rate limits).
 */
export async function fetchFromGitHub(source: GitHubSource): Promise<string> {
  const cacheKey = `github:${source.repo}:${source.path}:${source.branch || "main"}`;
  
  const cached = docCache.get(cacheKey);
  if (cached) {
    return cached;
  }

  const { repo, path, branch = "main" } = source;
  const url = `${GITHUB_API_BASE}/repos/${repo}/contents/${path}?ref=${branch}`;
  
  const headers: Record<string, string> = {
    Accept: "application/vnd.github.v3.raw",
    "User-Agent": "Org-Docs-MCP-Server",
  };

  const token = process.env.GITHUB_TOKEN;
  if (token) {
    headers.Authorization = `Bearer ${token}`;
  }

  const response = await fetch(url, { headers });

  if (!response.ok) {
    if (response.status === 404) {
      throw new Error(`Document not found: ${repo}/${path}`);
    }
    if (response.status === 403) {
      throw new Error(`GitHub API rate limit exceeded. Set GITHUB_TOKEN to increase limit.`);
    }
    throw new Error(`GitHub API error: ${response.status} ${response.statusText}`);
  }

  const content = await response.text();
  
  docCache.set(cacheKey, content);
  
  return content;
}

/**
 * Check if GitHub source is accessible (for health checks)
 */
export async function checkGitHubAccess(): Promise<boolean> {
  try {
    const response = await fetch(`${GITHUB_API_BASE}/rate_limit`, {
      headers: {
        "User-Agent": "Org-Docs-MCP-Server",
        ...(process.env.GITHUB_TOKEN && {
          Authorization: `Bearer ${process.env.GITHUB_TOKEN}`,
        }),
      },
    });
    return response.ok;
  } catch {
    return false;
  }
}
