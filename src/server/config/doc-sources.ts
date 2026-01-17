/**
 * Documentation source configuration.
 * 
 * This file defines all documentation sources that the MCP server can fetch from.
 * Sources are categorized as:
 * - internal: Organization-specific standards and guidelines
 * - public: Public cloud/tool documentation (GCP, Terraform, Tekton)
 * 
 * CUSTOMIZE: Replace YOUR_ORG with your actual GitHub organization
 */

export type SourceType = "github" | "gcp" | "terraform" | "tekton" | "url";

export interface GitHubSource {
  type: "github";
  repo: string;
  path: string;
  branch?: string;
}

export interface GCPSource {
  type: "gcp";
  product: string;
  page: string;
}

export interface TerraformSource {
  type: "terraform";
  provider: string;
  resource: string;
}

export interface TektonSource {
  type: "tekton";
  docPath: string;
}

export interface URLSource {
  type: "url";
  url: string;
}

export type DocSource = GitHubSource | GCPSource | TerraformSource | TektonSource | URLSource;

export interface DocConfig {
  topic: string;
  title: string;
  description: string;
  category: "internal" | "public" | "user";
  source: DocSource;
  priority: number; // 0.0 to 1.0, higher = more important
}

/**
 * Documentation Sources
 * 
 * Internal docs: Organization-specific standards stored in GitHub
 * Public docs: Reference documentation from GCP, Terraform, Tekton
 */
export const DOC_SOURCES: DocConfig[] = [
  // ============================================
  // INTERNAL: Organization-specific standards
  // Replace YOUR_ORG with your GitHub organization
  // ============================================
  {
    topic: "naming-standards",
    title: "Resource Naming Standards",
    description: "Required naming conventions for all GCP resources",
    category: "internal",
    priority: 1.0,
    source: {
      type: "github",
      repo: "YOUR_ORG/cloud-standards",
      path: "gcp/naming-conventions.md",
      branch: "main",
    },
  },
  {
    topic: "terraform-modules",
    title: "Internal Terraform Modules",
    description: "Registry of approved internal Terraform modules and usage guidelines",
    category: "internal",
    priority: 1.0,
    source: {
      type: "github",
      repo: "YOUR_ORG/terraform-gcp-modules",
      path: "README.md",
      branch: "main",
    },
  },
  {
    topic: "security-policies",
    title: "GCP Security Policies",
    description: "Security requirements, IAM policies, and compliance guidelines",
    category: "internal",
    priority: 1.0,
    source: {
      type: "github",
      repo: "YOUR_ORG/cloud-standards",
      path: "security/gcp-policies.md",
      branch: "main",
    },
  },
  {
    topic: "team-codes",
    title: "Team Codes",
    description: "Valid team abbreviations for resource naming",
    category: "internal",
    priority: 0.8,
    source: {
      type: "github",
      repo: "YOUR_ORG/cloud-standards",
      path: "teams/team-codes.md",
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
  {
    topic: "gcp-service-accounts",
    title: "GCP Service Accounts",
    description: "Creating and managing GCP service accounts",
    category: "public",
    priority: 0.7,
    source: {
      type: "gcp",
      product: "iam",
      page: "docs/service-accounts",
    },
  },

  // ============================================
  // PUBLIC: Terraform Documentation
  // ============================================
  {
    topic: "terraform-gcs-bucket",
    title: "Terraform google_storage_bucket",
    description: "Terraform resource for GCS bucket",
    category: "public",
    priority: 0.6,
    source: {
      type: "terraform",
      provider: "google",
      resource: "google_storage_bucket",
    },
  },
  {
    topic: "terraform-gcp-project",
    title: "Terraform google_project",
    description: "Terraform resource for GCP project",
    category: "public",
    priority: 0.6,
    source: {
      type: "terraform",
      provider: "google",
      resource: "google_project",
    },
  },
  {
    topic: "terraform-service-account",
    title: "Terraform google_service_account",
    description: "Terraform resource for GCP service account",
    category: "public",
    priority: 0.6,
    source: {
      type: "terraform",
      provider: "google",
      resource: "google_service_account",
    },
  },

  // ============================================
  // PUBLIC: Tekton Documentation
  // ============================================
  {
    topic: "tekton-pipelines",
    title: "Tekton Pipelines Overview",
    description: "Introduction to Tekton Pipelines for CI/CD",
    category: "public",
    priority: 0.6,
    source: {
      type: "tekton",
      docPath: "pipelines",
    },
  },
  {
    topic: "tekton-tasks",
    title: "Tekton Tasks",
    description: "Creating and configuring Tekton Tasks",
    category: "public",
    priority: 0.6,
    source: {
      type: "tekton",
      docPath: "pipelines/tasks",
    },
  },
  {
    topic: "tekton-triggers",
    title: "Tekton Triggers",
    description: "Event-driven pipeline execution with Tekton Triggers",
    category: "public",
    priority: 0.6,
    source: {
      type: "tekton",
      docPath: "triggers",
    },
  },
];

// Dynamic doc sources (built-in + user docs)
let allDocSources: DocConfig[] = [...DOC_SOURCES];

/**
 * Update the merged doc sources list (called when user docs change)
 */
export function updateDocSources(userDocs: DocConfig[]): void {
  allDocSources = [...DOC_SOURCES, ...userDocs];
}

/**
 * Get all doc sources (built-in + user)
 */
export function getAllDocSources(): DocConfig[] {
  return allDocSources;
}

/**
 * Get doc config by topic name
 */
export function getDocConfig(topic: string): DocConfig | undefined {
  return allDocSources.find((doc) => doc.topic === topic);
}

/**
 * Get all doc configs for a category
 */
export function getDocsByCategory(category: "internal" | "public" | "user"): DocConfig[] {
  return allDocSources.filter((doc) => doc.category === category);
}

/**
 * Get all topics
 */
export function getAllTopics(): string[] {
  return allDocSources.map((doc) => doc.topic);
}
