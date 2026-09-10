export default function Footer() {
  return (
    <footer className="border-t border-white/5">
      <div className="mx-auto flex max-w-6xl flex-wrap items-center justify-between gap-4 px-5 py-8 text-sm text-fog">
        <span className="font-display font-semibold text-bone">
          cloakx<span className="text-ember">402</span>
        </span>
        <p className="font-mono text-xs">
          Fuji testnet only · not audited beyond upstream eERC · MIT
        </p>
      </div>
    </footer>
  );
}
