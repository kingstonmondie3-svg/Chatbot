import { z } from "zod";

export const conversationParamsSchema = z.object({
  temperature: z.number().min(0).max(2).optional(),
  maxTokens: z.number().min(1).max(128000).optional(),
  systemPrompt: z.string().max(10000).optional(),
});

export const createConversationSchema = z.object({
  model: z.string().optional(),
  params: conversationParamsSchema.optional(),
  title: z.string().max(200).optional(),
  projectId: z.string().uuid().optional(),
  incognito: z.boolean().optional(),
});

export const updateConversationSchema = z.object({
  title: z.string().max(200).optional(),
  pinned: z.boolean().optional(),
  model: z.string().optional(),
  params: conversationParamsSchema.optional(),
});

export const sendMessageSchema = z.object({
  content: z.string().min(1).max(100000),
  parentId: z.string().uuid().optional(),
  attachmentIds: z.array(z.string().uuid()).max(5).optional(),
  artifactId: z.string().uuid().optional(),
});

export const editMessageSchema = z.object({
  content: z.string().min(1).max(100000),
});

export const conversationSearchSchema = z.object({
  q: z.string().min(1).max(200),
});

// --- Artifacts ---

export const artifactTypeSchema = z.enum([
  "markdown",
  "html",
  "react",
  "svg",
  "mermaid",
  "code",
]);

export const artifactSchema = z.object({
  id: z.string().uuid(),
  messageId: z.string().uuid(),
  conversationId: z.string().uuid(),
  artifactType: artifactTypeSchema,
  title: z.string().max(500),
  language: z.string().nullable().optional(),
  currentVersion: z.number().int().min(1),
  createdAt: z.string().datetime(),
});

export const artifactVersionSchema = z.object({
  id: z.string().uuid(),
  artifactId: z.string().uuid(),
  versionNumber: z.number().int().min(1),
  content: z.string(),
  createdAt: z.string().datetime(),
});

export const artifactWithVersionsSchema = artifactSchema.extend({
  versions: z.array(artifactVersionSchema),
});

export const createArtifactVersionSchema = z.object({
  content: z.string().min(1).max(500000),
});

export const uploadResponseSchema = z.object({
  id: z.string().uuid(),
  filename: z.string(),
  mime: z.string(),
  size: z.number(),
});
export type UploadResponse = z.infer<typeof uploadResponseSchema>;

export type ConversationParams = z.infer<typeof conversationParamsSchema>;
export type CreateConversationInput = z.infer<typeof createConversationSchema>;
export type UpdateConversationInput = z.infer<typeof updateConversationSchema>;
export type SendMessageInput = z.infer<typeof sendMessageSchema>;
export type EditMessageInput = z.infer<typeof editMessageSchema>;
export type ConversationSearchInput = z.infer<typeof conversationSearchSchema>;
export type ArtifactType = z.infer<typeof artifactTypeSchema>;
export type Artifact = z.infer<typeof artifactSchema>;
export type ArtifactVersion = z.infer<typeof artifactVersionSchema>;
export type ArtifactWithVersions = z.infer<typeof artifactWithVersionsSchema>;
export type CreateArtifactVersionInput = z.infer<typeof createArtifactVersionSchema>;

// --- Projects ---

export const createProjectSchema = z.object({
  name: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  customInstructions: z.string().max(10000).optional(),
});

export const updateProjectSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(2000).nullable().optional(),
  customInstructions: z.string().max(10000).nullable().optional(),
});

export const projectSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  name: z.string(),
  description: z.string().nullable().optional(),
  customInstructions: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const projectFileSchema = z.object({
  id: z.string().uuid(),
  projectId: z.string().uuid(),
  filename: z.string(),
  mime: z.string(),
  size: z.number(),
  status: z.enum(["processing", "ready", "error"]),
  chunkCount: z.number().int(),
  createdAt: z.string().datetime(),
});

export type CreateProjectInput = z.infer<typeof createProjectSchema>;
export type UpdateProjectInput = z.infer<typeof updateProjectSchema>;
export type Project = z.infer<typeof projectSchema>;
export type ProjectFile = z.infer<typeof projectFileSchema>;

// --- Memory ---

export const memoryItemSchema = z.object({
  id: z.string().uuid(),
  userId: z.string().uuid(),
  conversationId: z.string().uuid().nullable().optional(),
  content: z.string(),
  source: z.string().nullable().optional(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const updateMemoryItemSchema = z.object({
  content: z.string().min(1).max(5000),
});

export const memorySearchResultSchema = z.object({
  content: z.string(),
  similarity: z.number(),
  conversationId: z.string().uuid().nullable().optional(),
  createdAt: z.string().datetime(),
});

export type MemoryItem = z.infer<typeof memoryItemSchema>;
export type UpdateMemoryItemInput = z.infer<typeof updateMemoryItemSchema>;
export type MemorySearchResult = z.infer<typeof memorySearchResultSchema>;
