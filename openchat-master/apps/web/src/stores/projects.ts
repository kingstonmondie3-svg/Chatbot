import { create } from "zustand";

interface Project {
  id: string;
  name: string;
  description: string | null;
  customInstructions: string | null;
  createdAt: string;
  updatedAt: string;
}

interface ProjectFile {
  id: string;
  projectId: string;
  filename: string;
  mime: string;
  size: number;
  status: "processing" | "ready" | "error";
  chunkCount: number;
  createdAt: string;
}

interface ProjectsState {
  projects: Project[];
  currentProject: Project | null;
  projectFiles: ProjectFile[];
  isLoading: boolean;

  fetchProjects: () => Promise<void>;
  fetchProject: (id: string) => Promise<void>;
  createProject: (data: {
    name: string;
    description?: string;
    customInstructions?: string;
  }) => Promise<string>;
  updateProject: (id: string, updates: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  fetchProjectFiles: (projectId: string) => Promise<void>;
  uploadProjectFiles: (projectId: string, files: File[]) => Promise<void>;
  deleteProjectFile: (projectId: string, fileId: string) => Promise<void>;
  setCurrentProject: (project: Project | null) => void;
}

export const useProjectsStore = create<ProjectsState>((set, get) => ({
  projects: [],
  currentProject: null,
  projectFiles: [],
  isLoading: false,

  fetchProjects: async () => {
    set({ isLoading: true });
    try {
      const res = await fetch("/api/projects");
      if (res.ok) {
        const data = await res.json();
        set({ projects: data, isLoading: false });
      } else {
        set({ isLoading: false });
      }
    } catch {
      set({ isLoading: false });
    }
  },

  fetchProject: async (id) => {
    try {
      const res = await fetch(`/api/projects/${id}`);
      if (res.ok) {
        const data = await res.json();
        set({ currentProject: data });
      }
    } catch {
      // ignore
    }
  },

  createProject: async (data) => {
    try {
      const res = await fetch("/api/projects", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });
      if (res.ok) {
        const project = await res.json();
        set((state) => ({
          projects: [project, ...state.projects],
        }));
        return project.id;
      }
    } catch {
      // ignore
    }
    return "";
  },

  updateProject: async (id, updates) => {
    try {
      const res = await fetch(`/api/projects/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(updates),
      });
      if (res.ok) {
        const updated = await res.json();
        set((state) => ({
          projects: state.projects.map((p) =>
            p.id === id ? { ...p, ...updated } : p,
          ),
          currentProject:
            state.currentProject?.id === id
              ? { ...state.currentProject, ...updated }
              : state.currentProject,
        }));
      }
    } catch {
      // ignore
    }
  },

  deleteProject: async (id) => {
    try {
      const res = await fetch(`/api/projects/${id}`, { method: "DELETE" });
      if (res.ok) {
        set((state) => ({
          projects: state.projects.filter((p) => p.id !== id),
          currentProject:
            state.currentProject?.id === id ? null : state.currentProject,
        }));
      }
    } catch {
      // ignore
    }
  },

  fetchProjectFiles: async (projectId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/files`);
      if (res.ok) {
        const data = await res.json();
        set({ projectFiles: data });
      }
    } catch {
      // ignore
    }
  },

  uploadProjectFiles: async (projectId, files) => {
    const formData = new FormData();
    for (const file of files) {
      formData.append("files", file);
    }
    try {
      const res = await fetch(`/api/projects/${projectId}/files`, {
        method: "POST",
        body: formData,
      });
      if (res.ok) {
        // Refresh the file list
        await get().fetchProjectFiles(projectId);
      }
    } catch {
      // ignore
    }
  },

  deleteProjectFile: async (projectId, fileId) => {
    try {
      const res = await fetch(`/api/projects/${projectId}/files/${fileId}`, {
        method: "DELETE",
      });
      if (res.ok) {
        set((state) => ({
          projectFiles: state.projectFiles.filter((f) => f.id !== fileId),
        }));
      }
    } catch {
      // ignore
    }
  },

  setCurrentProject: (project) => set({ currentProject: project }),
}));

export type { Project, ProjectFile };
