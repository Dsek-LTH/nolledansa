"use client";

import { LogIn } from "lucide-react";

export default function AuthButton() {
  return (
    <button
      type="button"
      onClick={() => {
        window.location.href = "/api/auth/signin?provider=authentik&callbackUrl=%2Fadmin";
      }}
      className="flex items-center gap-1 text-sm text-gray-600 hover:text-brand-600 transition-colors"
    >
      <LogIn className="w-4 h-4" />
      <span className="hidden sm:block">Logga in</span>
    </button>
  );
}
