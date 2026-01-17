/**
 * Source adapter registry.
 * Provides unified interface for fetching docs from different sources.
 */

import type { DocSource, DocConfig } from "../config/doc-sources.js";
import { fetchFromGitHub, checkGitHubAccess } from "./github.js";
import { fetchFromGCP, checkGCPAccess } from "./gcp.js";
import { fetchFromTerraform, checkTerraformAccess } from "./terraform.js";
import { fetchFromTekton, checkTektonAccess } from "./tekton.js";
import { fetchFromURL } from "./url.js";

/**
 * Fetch documentation content from the appropriate source.
 */
export async function fetchDoc(config: DocConfig): Promise<string> {
  const { source } = config;
  
  switch (source.type) {
    case "github":
      return fetchFromGitHub(source);
    case "gcp":
      return fetchFromGCP(source);
    case "terraform":
      return fetchFromTerraform(source);
    case "tekton":
      return fetchFromTekton(source);
    case "url":
      return fetchFromURL(source.url);
    default:
      throw new Error(`Unknown source type: ${(source as DocSource).type}`);
  }
}

/**
 * Check health of all documentation sources.
 */
export async function checkSourceHealth(): Promise<Record<string, boolean>> {
  const [github, gcp, terraform, tekton] = await Promise.all([
    checkGitHubAccess(),
    checkGCPAccess(),
    checkTerraformAccess(),
    checkTektonAccess(),
  ]);
  
  return {
    github,
    gcp,
    terraform,
    tekton,
  };
}

export { fetchFromGitHub } from "./github.js";
export { fetchFromGCP } from "./gcp.js";
export { fetchFromTerraform } from "./terraform.js";
export { fetchFromTekton } from "./tekton.js";
export { fetchFromURL, previewURL } from "./url.js";
