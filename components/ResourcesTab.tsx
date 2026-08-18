const LINKS = [
  {
    href: "https://zerodha.com/varsity/chapter/the-retirement-problem-part-2/",
    title: "Retirement Corpus Generation (Zerodha Varsity)",
    note: "How to size a retirement corpus and the SIP needed to reach it.",
  },
  {
    href: "https://www.whitecoatinvestor.com/retirement-bucket-strategy/",
    title: "Retirement Bucket Strategy (White Coat Investor)",
    note: "The safe/growth bucket approach this app's drawdown mode is based on.",
  },
  {
    href: "https://www.morningstar.com/content/cs-assets/v3/assets/blt9415ea4cc4157833/blt2da7af775da0d57e/65aacbb9c7bb160246a29912/Bucket_Strategies_Comparison_(3)_(1).pdf",
    title: "Bucket Strategies Comparison (Morningstar, PDF)",
    note: "Compares bucket-strategy variants side by side.",
  },
];

export default function ResourcesTab() {
  return (
    <div className="space-y-4">
      <h2 className="text-lg font-semibold">Further reading</h2>
      <ul className="space-y-3">
        {LINKS.map((l) => (
          <li key={l.href}>
            <a href={l.href} target="_blank" rel="noopener noreferrer" className="text-blue-600 underline dark:text-blue-400">
              {l.title}
            </a>
            <p className="text-sm text-gray-500 dark:text-gray-400">{l.note}</p>
          </li>
        ))}
      </ul>
    </div>
  );
}
