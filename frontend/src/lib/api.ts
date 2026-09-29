const API_BASE_URL =
  import.meta.env.VITE_API_BASE_URL || "http://localhost:8000";

const TOKEN_KEY = "quicktodo_access_token";

export type User = {
  id: number;
  name: string;
  email: string;
  created_at: string | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: string;
  user: User;
};

export type TaskStatus = "Completed" | "Running" | "Failed";

export type Task = {
  id: number;
  title: string;
  description: string | null;
  status: TaskStatus;
  progress: number;
  result: string | null;
  error_message: string | null;
  sources: {
    title: string;
    url: string;
    snippet: string;
  }[] | null;
  is_completed: boolean;
  created_at: string | null;
  updated_at: string | null;
};

async function request<T>(
  path: string,
  options: RequestInit = {},
): Promise<T> {
  const token = localStorage.getItem(TOKEN_KEY);

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...options.headers,
    },
  });

  if (!response.ok) {
    const errorData = await response.json().catch(() => null);
    const message =
      errorData?.detail || `Request failed with status ${response.status}`;
    throw new Error(message);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return response.json() as Promise<T>;
}

export const api = {
  register(name: string, email: string, password: string) {
    return request<AuthResponse>("/api/auth/register", {
      method: "POST",
      body: JSON.stringify({ name, email, password }),
    });
  },

  login(email: string, password: string) {
    return request<AuthResponse>("/api/auth/login", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    });
  },

  getTasks() {
    return request<Task[]>("/api/tasks/");
  },

  createTask(title: string, description?: string) {
    return request<Task>("/api/tasks/", {
      method: "POST",
      body: JSON.stringify({ title, description }),
    });
  },

  getTask(taskId: number) {
    return request<Task>(`/api/tasks/${taskId}`);
  },

  deleteTask(taskId: number) {
    return request<void>(`/api/tasks/${taskId}`, {
      method: "DELETE",
    });
  },

  saveToken(token: string) {
    localStorage.setItem(TOKEN_KEY, token);
  },

  getToken() {
    return localStorage.getItem(TOKEN_KEY);
  },

  clearToken() {
    localStorage.removeItem(TOKEN_KEY);
  },
};