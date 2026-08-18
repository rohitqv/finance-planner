"use client";

export default function SectionNav({ items }: { items: { id: string; label: string }[] }) {
  return (
    <nav className="sticky top-0 z-10 -mx-1 mb-2 flex flex-wrap gap-x-4 gap-y-1 border-b border-gray-200 bg-white/95 px-1 py-2 text-sm backdrop-blur dark:border-gray-700 dark:bg-gray-950/95">
      {items.map((item) => (
        <a key={item.id} href={`#${item.id}`} className="text-gray-600 hover:text-blue-600 dark:text-gray-300 dark:hover:text-blue-400">
          {item.label}
        </a>
      ))}
    </nav>
  );
}
