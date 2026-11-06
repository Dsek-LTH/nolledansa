import Link from "next/link";
import { Music2, Upload } from "lucide-react";

export default function Navbar() {
  return (
    <nav className="bg-white border-b border-gray-200 sticky top-0 z-50">
      <div className="max-w-5xl mx-auto px-4 py-3 flex items-center justify-between gap-4 max-[420px]:pr-6">
        <div className="flex items-center gap-4">
          <Link href="/" className="flex items-center gap-2 font-bold text-xl text-brand-700">
            <Music2 className="w-6 h-6" />
            NolleDansa
          </Link>
          <Link
            href="/danser"
            className="text-sm font-medium text-gray-700 hover:text-brand-700 transition-colors"
          >
            Danser
          </Link>
          <Link
            href="/sektionsramsor"
            className="text-sm font-medium text-gray-700 hover:text-brand-700 transition-colors"
          >
            Sektionsramsor
          </Link>
        </div>

        <div className="flex items-center gap-2 sm:gap-4">
          <Link
            href="/admin"
            className="text-xs text-gray-400 hover:text-gray-600 transition-colors hidden sm:block"
          >
            Admin
          </Link>
          <Link
            href="/upload"
            aria-label="Ladda upp dans"
            className="inline-flex items-center justify-center bg-brand-600 hover:bg-brand-700 text-white text-sm font-medium px-4 py-2 rounded-lg transition-colors whitespace-nowrap max-[420px]:h-10 max-[420px]:w-10 max-[420px]:px-0"
          >
            <Upload className="hidden h-5 w-5 max-[420px]:block" />
            <span className="max-[420px]:hidden">Ladda upp dans</span>
          </Link>
        </div>
      </div>
    </nav>
  );
}
