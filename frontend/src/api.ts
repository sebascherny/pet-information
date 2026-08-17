// Empty string uses same-origin /api (nginx or Vite dev proxy) for Safari-compatible cookies.
const API_URL = import.meta.env.VITE_API_URL ?? "";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const res = await fetch(`${API_URL}${path}`, {
    ...options,
    credentials: "include",
    headers: {
      ...(options.body instanceof FormData
        ? {}
        : { "Content-Type": "application/json" }),
      ...options.headers,
    },
  });

  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }

  return data as T;
}

export const api = {
  register: (body: {
    name: string;
    username: string;
    email: string;
    password: string;
  }) => request<{ user: User }>("/api/auth/register", { method: "POST", body: JSON.stringify(body) }),

  login: (body: { username: string; password: string }) =>
    request<{ user: User }>("/api/auth/login", { method: "POST", body: JSON.stringify(body) }),

  logout: () => request<{ message: string }>("/api/auth/logout", { method: "POST" }),

  me: () => request<{ user: User }>("/api/auth/me"),

  updateSettings: (body: {
    name?: string;
    email?: string;
    openai_api_key?: string | null;
    anthropic_api_key?: string | null;
  }) =>
    request<{ user: User }>("/api/users/settings", { method: "PUT", body: JSON.stringify(body) }),

  getPets: () => request<{ pets: Pet[] }>("/api/pets"),

  createPet: (body: Partial<Pet> & { name: string }) =>
    request<{ pet: Pet }>("/api/pets", { method: "POST", body: JSON.stringify(body) }),

  deletePet: (id: number) =>
    request<{ message: string }>(`/api/pets/${id}`, { method: "DELETE" }),

  getFiles: (params?: { pet_id?: number; from?: string; to?: string }) => {
    const qs = new URLSearchParams();
    if (params?.pet_id) qs.set("pet_id", String(params.pet_id));
    if (params?.from) qs.set("from", params.from);
    if (params?.to) qs.set("to", params.to);
    const query = qs.toString();
    return request<{ files: ClinicalFile[] }>(`/api/files${query ? `?${query}` : ""}`);
  },

  uploadFile: (petId: number, file: File) => {
    const form = new FormData();
    form.append("pet_id", String(petId));
    form.append("file", file);
    return request<{ file: ClinicalFile }>("/api/files", { method: "POST", body: form });
  },

  deleteFile: (id: number) =>
    request<{ message: string }>(`/api/files/${id}`, { method: "DELETE" }),

  downloadFile: async (id: number) => {
    const res = await fetch(`${API_URL}/api/files/${id}/download`, {
      credentials: "include",
    });
    if (!res.ok) throw new Error("Download failed");
    const blob = await res.blob();
    const disposition = res.headers.get("Content-Disposition");
    const match = disposition?.match(/filename="?([^"]+)"?/);
    const filename = match?.[1] || "download";
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = filename;
    a.click();
    URL.revokeObjectURL(url);
  },

  getAppointments: () => request<{ appointments: Appointment[] }>("/api/appointments"),

  createAppointment: (body: {
    pet_id: number;
    title: string;
    appointment_at: string;
    veterinarian?: string;
    location?: string;
    notes?: string;
  }) =>
    request<{ appointment: Appointment }>("/api/appointments", {
      method: "POST",
      body: JSON.stringify(body),
    }),

  updateAppointment: (
    id: number,
    body: {
      pet_id?: number;
      title?: string;
      appointment_at?: string;
      veterinarian?: string | null;
      location?: string | null;
      notes?: string | null;
    }
  ) =>
    request<{ appointment: Appointment }>(`/api/appointments/${id}`, {
      method: "PUT",
      body: JSON.stringify(body),
    }),

  deleteAppointment: (id: number) =>
    request<{ message: string }>(`/api/appointments/${id}`, { method: "DELETE" }),
};

export interface User {
  id: number;
  name: string;
  username: string;
  email: string;
  has_openai_key?: boolean;
  has_anthropic_key?: boolean;
  created_at: string;
}

export interface Pet {
  id: number;
  name: string;
  species: string | null;
  breed: string | null;
  date_of_birth: string | null;
  sex: string | null;
  notes: string | null;
  created_at: string;
}

export interface ClinicalFile {
  id: number;
  pet_id: number;
  pet_name?: string;
  original_name: string;
  mime_type: string;
  summary: string | null;
  uploaded_at: string;
}

export interface Appointment {
  id: number;
  pet_id: number;
  pet_name?: string;
  title: string;
  appointment_at: string;
  veterinarian: string | null;
  location: string | null;
  notes: string | null;
  reminder_sent: boolean;
  created_at: string;
}
