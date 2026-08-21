import Link from "next/link";
import Nav from "@/components/Nav";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen">
      <Nav />
      <div className="mx-auto flex max-w-6xl items-start gap-8 px-4">
        <Link href="/" className="sticky top-6 hidden shrink-0 2xl:block">
          <img
            src="/familia-silva.jpg"
            alt="Família Silva"
            className="h-64 w-64 rounded-full object-cover ring-4 ring-brand-100"
          />
        </Link>
        <main className="min-w-0 flex-1 py-6">{children}</main>
      </div>
    </div>
  );
}
