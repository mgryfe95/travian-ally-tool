import Link from "next/link";

const links = [
  ["/", "Start"],
  ["/inactive", "Inaktive"],
  ["/events", "Ereignisse"],
] as const;

export function Nav() {
  return (
    <nav className="flex gap-4 border-b border-zinc-800 px-6 py-3 text-sm">
      {links.map(([href, label]) => (
        <Link key={href} href={href} className="text-zinc-300 hover:text-amber-400">
          {label}
        </Link>
      ))}
    </nav>
  );
}
