"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

const LINKS = [
  { href: "/", label: "Resumo", short: "Resumo" },
  { href: "/contas-fixas", label: "Contas Fixas", short: "Fixas" },
  { href: "/contas-variaveis", label: "Contas Variáveis", short: "Variáveis" },
  { href: "/contas-futuras", label: "Contas Futuras", short: "Futuras" },
  { href: "/investimentos", label: "Investimentos", short: "Invest." },
  { href: "/consorcios", label: "Consórcios", short: "Consórcios" },
  { href: "/cartao-credito", label: "Cartão de Crédito", short: "Cartão" },
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
      <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-2.5 sm:py-3">
        <Link href="/" className="flex min-w-0 items-center gap-2">
          <img
            src="/familia-silva.jpg"
            alt="Família Silva"
            className="h-9 w-9 shrink-0 rounded-full object-cover ring-2 ring-brand-100 sm:h-12 sm:w-12"
          />
          <span className="truncate text-xs font-semibold text-neutral-900 sm:text-sm">
            Finanças da Família Silva
          </span>
        </Link>
        <button
          onClick={handleLogout}
          className="shrink-0 text-xs font-medium text-neutral-500 hover:text-neutral-800"
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
              className={`whitespace-nowrap rounded-full px-2.5 py-1.5 text-xs transition-colors sm:px-3 sm:text-sm ${
                active
                  ? "bg-brand-600 text-white"
                  : "text-neutral-600 hover:bg-neutral-100"
              }`}
            >
              <span className="sm:hidden">{link.short}</span>
              <span className="hidden sm:inline">{link.label}</span>
            </Link>
          );
        })}
      </nav>
    </header>
  );
}
