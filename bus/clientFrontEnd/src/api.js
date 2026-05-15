// ── Constants ─────────────────────────────────────────────────────────────────
export const BASE_URL = import.meta.env.VITE_API_URL || "http://localhost:5000/api";

export const STOPS = [
  "Vavuniya",
  "Kurumankadu",
  "Veppangulam",
  "Nelukulam",
  "University",
];

export const DIRECTIONS = ["TO_UNIVERSITY", "TO_VAVUNIYA"];

export const DIRECTION_LABELS = {
  TO_UNIVERSITY: "→ To University",
  TO_VAVUNIYA: "← To Vavuniya",
};

export const CROWD_LEVELS = [
  { value: "seats_available", label: "🟢 Seats Available" },
  { value: "standing_only",   label: "🟡 Standing Only"   },
  { value: "fully_crowded",   label: "🔴 Fully Crowded"   },
];

export const UPDATE_TYPES = [
  { value: "spotted",  label: "Spotted" },
  { value: "onboard",  label: "On Board" },
];

// ── Token helpers ──────────────────────────────────────────────────────────────
export const getToken = () => localStorage.getItem("bustrack_token");
export const setToken = (t) => localStorage.setItem("bustrack_token", t);
export const clearToken = () => localStorage.removeItem("bustrack_token");

export const getUser = () => {
  try { return JSON.parse(localStorage.getItem("bustrack_user")); }
  catch { return null; }
};
export const setUser  = (u) => localStorage.setItem("bustrack_user", JSON.stringify(u));
export const clearUser = () => localStorage.removeItem("bustrack_user");

// ── Core fetch wrapper ────────────────────────────────────────────────────────
async function request(method, path, body = null, auth = false) {
  const headers = { "Content-Type": "application/json" };
  if (auth) {
    const token = getToken();
    if (token) headers["Authorization"] = `Bearer ${token}`;
  }
  try {
    const res = await fetch(`${BASE_URL}${path}`, {
      method,
      headers,
      body: body ? JSON.stringify(body) : undefined,
    });
    const data = await res.json().catch(() => ({}));
    return { ok: res.ok, status: res.status, data };
  } catch (err) {
    return { ok: false, status: 0, data: { message: err.message } };
  }
}

// ── Auth API ──────────────────────────────────────────────────────────────────
export const authApi = {
  register: (body)    => request("POST", "/auth/register", body),
  login:    (body)    => request("POST", "/auth/login", body),
  me:       ()        => request("GET",  "/auth/me", null, true),
};

// ── Bus API ───────────────────────────────────────────────────────────────────
export const busApi = {
  getAll:     ()            => request("GET",    "/bus/getall"),
  create:     (body)        => request("POST",   "/bus/create", body, true),
  update:     (id, body)    => request("PUT",    `/bus/update/${id}`, body, true),
  delete:     (id)          => request("DELETE", `/bus/delete/${id}`, null, true),

  // Schedule
  getSchedule:   (id)               => request("GET",    `/bus/${id}/schedule`),
  addTrip:       (id, body)         => request("POST",   `/bus/${id}/schedule`, body, true),
  updateTrip:    (id, tripId, body) => request("PUT",    `/bus/${id}/schedule/${tripId}`, body, true),
  deleteTrip:    (id, tripId)       => request("DELETE", `/bus/${id}/schedule/${tripId}`, null, true),
  nextDeparture: (id, direction, stop) =>
    request("GET", `/bus/${id}/next-departure?direction=${direction}&stop=${encodeURIComponent(stop)}`),
};

// ── Update API ────────────────────────────────────────────────────────────────
export const updateApi = {
  create:  (body) => request("POST",   "/update/create", body, true),
  getAll:  (busId) => request("GET",   `/update/getall/${busId}`),
  latest:  (busId) => request("GET",   `/update/latest/${busId}`),
  delete:  (id)    => request("DELETE",`/update/delete/${id}`, null, true),
};

// ── Time helper ───────────────────────────────────────────────────────────────
export function timeAgo(ts) {
  const mins = Math.round((Date.now() - new Date(ts)) / 60000);
  if (mins < 1)  return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  return `${hrs}h ${mins % 60}m ago`;
}

// ── Device ID ─────────────────────────────────────────────────────────────────
export function getDeviceId() {
  let id = localStorage.getItem("bustrack_device");
  if (!id) {
    id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).slice(2);
    localStorage.setItem("bustrack_device", id);
  }
  return id;
}
