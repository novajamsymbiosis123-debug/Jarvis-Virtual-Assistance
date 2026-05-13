/**
 * API client for the Jarvis backend.
 * Handles token storage, auto-refresh, and request helpers.
 */

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "";

// ── Token management ───────────────────────────────────────

export function getTokens() {
  if (typeof window === "undefined") return {};
  return {
    access: localStorage.getItem("jarvis_access_token"),
    refresh: localStorage.getItem("jarvis_refresh_token"),
  };
}

export function setTokens(access, refresh) {
  localStorage.setItem("jarvis_access_token", access);
  localStorage.setItem("jarvis_refresh_token", refresh);
}

export function clearTokens() {
  localStorage.removeItem("jarvis_access_token");
  localStorage.removeItem("jarvis_refresh_token");
}

// ── Request helper ─────────────────────────────────────────

async function request(path, options = {}) {
  const { access } = getTokens();
  const headers = {
    "Content-Type": "application/json",
    ...options.headers,
  };
  if (access) {
    headers["Authorization"] = `Bearer ${access}`;
  }

  const res = await fetch(`${API_BASE}${path}`, {
    ...options,
    headers,
  });

  // Auto-refresh on 401
  if (res.status === 401 && !options._retried) {
    const refreshed = await refreshToken();
    if (refreshed) {
      return request(path, { ...options, _retried: true });
    }
    clearTokens();
    if (typeof window !== "undefined") {
      window.location.href = "/login";
    }
    throw new Error("Session expired");
  }

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new Error(body.detail || `Request failed: ${res.status}`);
  }

  return res.json();
}

async function refreshToken() {
  const { refresh } = getTokens();
  if (!refresh) return false;
  try {
    const res = await fetch(`${API_BASE}/api/auth/refresh`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ refresh_token: refresh }),
    });
    if (!res.ok) return false;
    const data = await res.json();
    setTokens(data.access_token, data.refresh_token);
    return true;
  } catch {
    return false;
  }
}

// ── Auth API ───────────────────────────────────────────────

export async function apiRegister(email, username, password, fullName) {
  const data = await request("/api/auth/register", {
    method: "POST",
    body: JSON.stringify({ email, username, password, full_name: fullName }),
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export async function apiLogin(email, password) {
  const data = await request("/api/auth/login", {
    method: "POST",
    body: JSON.stringify({ email, password }),
  });
  setTokens(data.access_token, data.refresh_token);
  return data;
}

export function apiLogout() {
  clearTokens();
}

export async function apiGetProfile() {
  return request("/api/auth/me");
}

export async function apiUpdateProfile(updates) {
  return request("/api/auth/me", {
    method: "PATCH",
    body: JSON.stringify(updates),
  });
}

// ── Chat API ───────────────────────────────────────────────

export async function apiListConversations() {
  return request("/api/chat/conversations");
}

export async function apiCreateConversation(title) {
  return request("/api/chat/conversations", {
    method: "POST",
    body: JSON.stringify({ title }),
  });
}

export async function apiGetMessages(conversationId) {
  return request(`/api/chat/conversations/${conversationId}/messages`);
}

export async function apiDeleteConversation(conversationId) {
  return request(`/api/chat/conversations/${conversationId}`, { method: "DELETE" });
}

export async function apiSendMessage(message, conversationId = null) {
  return request("/api/chat/send", {
    method: "POST",
    body: JSON.stringify({ message, conversation_id: conversationId }),
  });
}

// ── Voice API ──────────────────────────────────────────────

export async function apiTranscribeAudio(audioBlob) {
  const { access } = getTokens();
  const formData = new FormData();
  formData.append("file", audioBlob, "recording.webm");

  const res = await fetch(`${API_BASE}/api/voice/transcribe`, {
    method: "POST",
    headers: { Authorization: `Bearer ${access}` },
    body: formData,
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || "Transcription failed");
  }
  return res.json();
}

export async function apiSynthesizeSpeech(text) {
  const { access } = getTokens();
  const res = await fetch(
    `${API_BASE}/api/voice/synthesize?text=${encodeURIComponent(text)}`,
    {
      method: "POST",
      headers: { Authorization: `Bearer ${access}` },
    }
  );
  if (!res.ok) throw new Error("Speech synthesis failed");
  return res.blob();
}

// ── Admin API ──────────────────────────────────────────────

export async function apiAdminStats() {
  return request("/api/admin/stats");
}

export async function apiAdminUsers() {
  return request("/api/admin/users");
}

export async function apiAdminToggleUser(userId) {
  return request(`/api/admin/users/${userId}/toggle-active`, { method: "PATCH" });
}
