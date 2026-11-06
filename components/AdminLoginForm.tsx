"use client";

import { Loader2, Lock } from "lucide-react";
import { useState } from "react";

export default function AdminLoginForm() {
  const [loading, setLoading] = useState(false);

  const handleLogin = () => {
    setLoading(true);
    window.location.href = "/api/auth/signin?provider=authentik&callbackUrl=%2Fadmin";
  };

  return (
    <div className="max-w-sm mx-auto mt-16 px-4">
      <div className="bg-white border border-gray-200 rounded-2xl p-8 shadow-sm">
        <div className="flex items-center gap-2 mb-6">
          <Lock className="w-5 h-5 text-brand-600" />
          <h1 className="text-lg font-bold text-gray-900">Admin-inloggning</h1>
        </div>

        <p className="text-sm text-gray-600 mb-4">
          Logga in med Authentik för att komma åt adminpanelen.
        </p>

        <button
          type="button"
          onClick={handleLogin}
          disabled={loading}
          className="w-full bg-brand-600 hover:bg-brand-700 disabled:opacity-60 text-white font-medium py-2.5 rounded-lg text-sm transition-colors flex items-center justify-center gap-2"
        >
          {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : "Logga in med Authentik"}
        </button>

        <p className="text-xs text-gray-400 mt-4 text-center">
          Inloggning och behörighet styrs av Authentik-policys.
        </p>
      </div>
    </div>
  );
}
