import { useEffect, useState, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { useProjectsStore } from "../stores/projects";
import { useConversationsStore } from "../stores/conversations";

export function ProjectDetailPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const navigate = useNavigate();
  const {
    currentProject,
    projectFiles,
    fetchProject,
    fetchProjectFiles,
    updateProject,
    uploadProjectFiles,
    deleteProjectFile,
    setCurrentProject,
  } = useProjectsStore();
  const { createConversation } = useConversationsStore();

  const [name, setName] = useState("");
  const [description, setDescription] = useState("");
  const [customInstructions, setCustomInstructions] = useState("");
  const [saving, setSaving] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (projectId) {
      fetchProject(projectId);
      fetchProjectFiles(projectId);
    }
    return () => setCurrentProject(null);
  }, [projectId, fetchProject, fetchProjectFiles, setCurrentProject]);

  const currentInstructions = currentProject?.customInstructions ?? "";

  useEffect(() => {
    if (currentProject) {
      setName(currentProject.name);
      setDescription(currentProject.description ?? "");
      setCustomInstructions(currentInstructions ?? "");
    }
  }, [currentProject, currentInstructions]);

  const handleSave = async () => {
    if (!projectId || !name.trim()) return;
    setSaving(true);
    await updateProject(projectId, {
      name: name.trim(),
      description: description.trim() || null,
      customInstructions: customInstructions.trim() || null,
    });
    setSaving(false);
  };

  const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files;
    if (!files || files.length === 0 || !projectId) return;
    await uploadProjectFiles(projectId, Array.from(files));
    // Reset the input
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleDeleteFile = async (fileId: string) => {
    if (!projectId) return;
    await deleteProjectFile(projectId, fileId);
  };

  const handleNewChat = async () => {
    if (!projectId) return;
    const id = await createConversation(undefined, projectId);
    if (id) {
      navigate(`/c/${id}`);
    }
  };

  const formatSize = (bytes: number) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  if (!currentProject) {
    return (
      <div className="flex flex-1 items-center justify-center">
        <p className="text-stone-400 dark:text-stone-500">Loading...</p>
      </div>
    );
  }

  return (
    <div className="flex flex-1 flex-col overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b border-stone-200/80 px-6 py-4 dark:border-white/10">
        <div className="flex items-center">
          <button
            onClick={() => navigate("/projects")}
            className="mr-4 text-stone-500 transition-colors hover:text-stone-700 dark:text-stone-400 dark:hover:text-stone-200"
          >
            &larr; Back
          </button>
          <h2 className="font-serif text-xl font-semibold text-stone-900 dark:text-stone-100">
            {currentProject.name}
          </h2>
        </div>
        <button
          onClick={handleNewChat}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700"
        >
          + New Chat
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-6">
        {/* Settings section */}
        <section className="mb-8">
          <h3 className="mb-4 text-lg font-semibold text-stone-900 dark:text-stone-100">
            Settings
          </h3>
          <div className="max-w-2xl space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                Name
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                Description
              </label>
              <input
                type="text"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                placeholder="Optional description"
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-stone-100"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
                Custom Instructions
              </label>
              <p className="mb-1 text-xs text-stone-500 dark:text-stone-400">
                These instructions are prepended to the system prompt for all
                conversations in this project.
              </p>
              <textarea
                value={customInstructions}
                onChange={(e) => setCustomInstructions(e.target.value)}
                placeholder="e.g., Always respond in a formal tone. Focus on technical accuracy."
                rows={4}
                className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-stone-100"
              />
            </div>
            <button
              onClick={handleSave}
              disabled={saving || !name.trim()}
              className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? "Saving..." : "Save Changes"}
            </button>
          </div>
        </section>

        {/* Knowledge files section */}
        <section>
          <h3 className="mb-4 text-lg font-semibold text-stone-900 dark:text-stone-100">
            Knowledge Documents
          </h3>
          <p className="mb-3 text-sm text-stone-500 dark:text-stone-400">
            Upload documents to give this project context. Files are chunked and
            embedded for retrieval during conversations.
          </p>

          <div className="mb-4">
            <input
              ref={fileInputRef}
              type="file"
              multiple
              onChange={handleFileUpload}
              accept=".pdf,.txt,.csv,.md,.py,.js,.ts,.html,.css,.json,.docx"
              className="hidden"
            />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="rounded-xl border border-stone-200 bg-white px-4 py-2 text-sm font-medium text-stone-700 shadow-soft transition-colors hover:bg-stone-50 dark:border-white/10 dark:bg-white/5 dark:text-stone-200 dark:hover:bg-white/10"
            >
              Upload Files
            </button>
          </div>

          {projectFiles.length === 0 ? (
            <p className="text-sm text-stone-400 dark:text-stone-500">
              No documents uploaded yet.
            </p>
          ) : (
            <div className="max-w-2xl space-y-2">
              {projectFiles.map((file) => (
                <div
                  key={file.id}
                  className="flex items-center justify-between rounded-xl border border-stone-200/80 px-4 py-3 dark:border-white/10"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-stone-900 dark:text-stone-100">
                      {file.filename}
                    </p>
                    <p className="text-xs text-stone-500 dark:text-stone-400">
                      {formatSize(file.size)} &middot;{" "}
                      {file.status === "processing" ? (
                        <span className="text-yellow-600 dark:text-yellow-400">
                          Processing...
                        </span>
                      ) : file.status === "error" ? (
                        <span className="text-red-600 dark:text-red-400">
                          Error
                        </span>
                      ) : (
                        <span>
                          {file.chunkCount} chunk
                          {file.chunkCount !== 1 ? "s" : ""}
                        </span>
                      )}
                    </p>
                  </div>
                  <button
                    onClick={() => handleDeleteFile(file.id)}
                    className="ml-4 text-stone-400 transition-colors hover:text-red-500"
                    title="Delete file"
                  >
                    &times;
                  </button>
                </div>
              ))}
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
