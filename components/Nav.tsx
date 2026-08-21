"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "Resumo" },
  { href: "/contas-fixas", label: "Contas Fixas" },
  { href: "/contas-variaveis", label: "Contas Variáveis" },
  { href: "/contas-futuras", label: "Contas Futuras" },
  { href: "/investimentos", label: "Investimentos" },
];

export default function Nav() {
  const pathname = usePathname();
  const router = useRouter();
  const supabase = createClient();

  async function handleLogout() {
    await supabase.auth.signOut();
    router.push("/login");
    router.refresh();
  }

  return (
    <header className="border-b border-neutral-200 bg-white">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-2">
          <img
            src="/familia-silva.jpg"
            alt="Família Silva"
            className="h-8 w-8 rounded-full object-cover ring-1 ring-neutral-200"
          />
          <span className="text-sm font-semibold text-neutral-900">
            Finanças da Família Silva
          </span>
        </div>
        <button
          onClick={handleLogout}
          className="text-xs font-medium text-neutral-500 hover:text-neutral-800"
        >
          Sair
        </button>
      </div>
      <nav className="mx-auto flex max-w-5xl gap-1 overflow-x-auto px-4 pb-2 text-sm">
        {LINKS.map((link) => {
          const active = pathname === link.href;
          return (
            <Link
              key={link.href}
              href={link.href}
              className={`whitespace-nowrap rounded-full px-3 py-1.5 transition-colors ${
                active
                  ? "bg-brand-600 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              {link.label}
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
