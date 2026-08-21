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
        <img
          src="/familia-silva.jpg"
          alt="Família Silva"
          className="sticky top-6 hidden h-64 w-64 shrink-0 rounded-full object-cover ring-4 ring-brand-100 2xl:block"
        />
        <main className="min-w-0 flex-1 py-6">{children}</main>
      </div>
    </div>
  );
}
