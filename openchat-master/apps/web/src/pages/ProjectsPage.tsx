import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { useProjectsStore } from "../stores/projects";

export function ProjectsPage() {
  const { projects, fetchProjects, createProject, deleteProject } =
    useProjectsStore();
  const navigate = useNavigate();
  const [showCreate, setShowCreate] = useState(false);
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    fetchProjects();
  }, [fetchProjects]);

  const handleCreate = async () => {
    if (!name.trim()) return;
    const id = await createProject({
      name: name.trim(),
      description: description.trim() || undefined,
    });
    if (id) {
      setName("");
      setDescription("");
      setShowCreate(false);
      navigate(`/projects/${id}`);
    }
  };

  const handleDelete = async (e: React.MouseEvent, id: string) => {
    e.stopPropagation();
    await deleteProject(id);
  };

  return (
    <div className="flex flex-1 flex-col overflow-hidden p-6">
      <div className="mx-auto mb-6 flex w-full max-w-5xl items-center justify-between">
        <h2 className="font-serif text-2xl font-semibold text-stone-900 dark:text-stone-100">
          Projects
        </h2>
        <button
          onClick={() => setShowCreate(!showCreate)}
          className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700"
        >
          {showCreate ? "Cancel" : "+ New Project"}
        </button>
      </div>

      {showCreate && (
        <div className="mx-auto mb-6 w-full max-w-5xl rounded-2xl border border-stone-200/80 bg-white p-4 shadow-soft dark:border-white/10 dark:bg-[#15171c]">
          <div className="mb-3">
            <label className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300">
              Name
            </label>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Project name"
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-stone-100"
              autoFocus
            />
          </div>
          <div className="mb-3">
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
          <button
            onClick={handleCreate}
            disabled={!name.trim()}
            className="rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white transition-colors hover:bg-brand-700 disabled:opacity-50"
          >
            Create Project
          </button>
        </div>
      )}

      <div className="mx-auto w-full max-w-5xl flex-1 overflow-y-auto">
        {projects.length === 0 ? (
          <p className="text-stone-400 dark:text-stone-500">
            No projects yet. Create one to organize conversations and knowledge.
          </p>
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {projects.map((project) => (
              <div
                key={project.id}
                onClick={() => navigate(`/projects/${project.id}`)}
                className="group cursor-pointer rounded-2xl border border-stone-200/80 bg-white p-4 shadow-soft transition-colors hover:border-brand-300 dark:border-white/10 dark:bg-[#15171c] dark:hover:border-brand-500/40"
              >
                <div className="flex items-start justify-between">
                  <h3 className="text-lg font-medium text-stone-900 dark:text-stone-100">
                    {project.name}
                  </h3>
                  <button
                    onClick={(e) => handleDelete(e, project.id)}
                    className="text-stone-400 opacity-0 transition hover:text-red-500 group-hover:opacity-100"
                    title="Delete project"
                  >
                    &times;
                  </button>
                </div>
                {project.description && (
                  <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">
                    {project.description}
                  </p>
                )}
                <p className="mt-3 text-xs text-stone-400 dark:text-stone-500">
                  Created {new Date(project.createdAt).toLocaleDateString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
