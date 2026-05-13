"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "../../lib/auth";
import { apiAdminStats, apiAdminUsers, apiAdminToggleUser } from "../../lib/api";
import { ArrowLeft, Users, MessageSquare, BarChart3, ToggleLeft, ToggleRight, Loader2, Shield } from "lucide-react";

export default function AdminPage() {
  const { user, loading: authLoading } = useAuth();
  const router = useRouter();
  const [stats, setStats] = useState(null);
  const [users, setUsers] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!authLoading && (!user || !user.is_admin)) {
      router.push("/dashboard");
    }
  }, [user, authLoading, router]);

  useEffect(() => {
    if (!user?.is_admin) return;
    (async () => {
      try {
        const [s, u] = await Promise.all([apiAdminStats(), apiAdminUsers()]);
        setStats(s);
        setUsers(u);
      } catch (err) {
        console.error("Admin load error:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, [user]);

  const toggleUser = async (userId) => {
    try {
      const result = await apiAdminToggleUser(userId);
      setUsers((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, is_active: result.is_active } : u))
      );
    } catch (err) {
      console.error("Toggle error:", err);
    }
  };

  if (authLoading || loading) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <Loader2 className="animate-spin text-jarvis-600" size={32} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-surface-50">
      {/* Header */}
      <header className="bg-white dark:bg-surface-100 border-b border-surface-200 px-6 py-4">
        <div className="max-w-6xl mx-auto flex items-center gap-4">
          <button onClick={() => router.push("/dashboard")} className="p-2 hover:bg-surface-100 rounded-lg transition">
            <ArrowLeft size={18} />
          </button>
          <div className="flex items-center gap-2">
            <Shield size={18} className="text-jarvis-600" />
            <h1 className="font-display font-bold text-lg">Admin Dashboard</h1>
          </div>
        </div>
      </header>

      <main className="max-w-6xl mx-auto px-6 py-8 space-y-8">
        {/* Stats cards */}
        {stats && (
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            {[
              { icon: Users, label: "Total Users", value: stats.total_users, sub: `${stats.active_users} active` },
              { icon: MessageSquare, label: "Total Messages", value: stats.total_messages, sub: "all time" },
              { icon: BarChart3, label: "Conversations", value: stats.total_conversations, sub: "all time" },
            ].map(({ icon: Icon, label, value, sub }) => (
              <div
                key={label}
                className="p-6 bg-white dark:bg-surface-100 rounded-2xl border border-surface-200"
              >
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-jarvis-100 dark:bg-jarvis-950 flex items-center justify-center">
                    <Icon size={18} className="text-jarvis-600" />
                  </div>
                  <span className="text-sm text-surface-700">{label}</span>
                </div>
                <p className="font-display font-bold text-3xl">{value?.toLocaleString() || 0}</p>
                <p className="text-xs text-surface-700 mt-1">{sub}</p>
              </div>
            ))}
          </div>
        )}

        {/* Users table */}
        <div className="bg-white dark:bg-surface-100 rounded-2xl border border-surface-200 overflow-hidden">
          <div className="px-6 py-4 border-b border-surface-200">
            <h2 className="font-display font-bold">Users ({users.length})</h2>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-surface-200 bg-surface-50 dark:bg-surface-200">
                  <th className="text-left px-6 py-3 font-medium text-surface-700">User</th>
                  <th className="text-left px-6 py-3 font-medium text-surface-700">Email</th>
                  <th className="text-left px-6 py-3 font-medium text-surface-700">Messages</th>
                  <th className="text-left px-6 py-3 font-medium text-surface-700">Joined</th>
                  <th className="text-left px-6 py-3 font-medium text-surface-700">Status</th>
                  <th className="text-left px-6 py-3 font-medium text-surface-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {users.map((u) => (
                  <tr key={u.id} className="border-b border-surface-200 last:border-0 hover:bg-surface-50 dark:hover:bg-surface-200 transition">
                    <td className="px-6 py-3 font-medium">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-jarvis-200 dark:bg-jarvis-900 flex items-center justify-center text-xs font-bold text-jarvis-700 dark:text-jarvis-300">
                          {u.username[0].toUpperCase()}
                        </div>
                        {u.username}
                        {u.is_admin && (
                          <span className="px-1.5 py-0.5 text-[10px] bg-jarvis-100 dark:bg-jarvis-950 text-jarvis-700 dark:text-jarvis-300 rounded font-medium">
                            ADMIN
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-3 text-surface-700">{u.email}</td>
                    <td className="px-6 py-3">{u.message_count}</td>
                    <td className="px-6 py-3 text-surface-700">
                      {new Date(u.created_at).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-medium ${
                          u.is_active
                            ? "bg-green-100 dark:bg-green-950 text-green-700 dark:text-green-400"
                            : "bg-red-100 dark:bg-red-950 text-red-700 dark:text-red-400"
                        }`}
                      >
                        {u.is_active ? "Active" : "Disabled"}
                      </span>
                    </td>
                    <td className="px-6 py-3">
                      {!u.is_admin && (
                        <button
                          onClick={() => toggleUser(u.id)}
                          className="p-1.5 hover:bg-surface-200 rounded transition"
                          title={u.is_active ? "Disable user" : "Enable user"}
                        >
                          {u.is_active ? (
                            <ToggleRight size={18} className="text-green-600" />
                          ) : (
                            <ToggleLeft size={18} className="text-surface-700" />
                          )}
                        </button>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </main>
    </div>
  );
}
