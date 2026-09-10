"use client";

import { motion } from "motion/react";

const GITHUB = "https://github.com/Allen-Saji/cloakx402";

export default function Cta() {
  return (
    <section className="mx-auto max-w-6xl px-5 py-28">
      <motion.div
        initial={{ y: 24 }}
        whileInView={{ y: 0 }}
        viewport={{ once: true, margin: "-60px" }}
        transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
        className="overflow-hidden rounded-xl border border-ember/25 bg-gradient-to-b from-ember/[0.08] to-transparent px-8 py-14 text-center md:px-16"
      >
        <h2 className="font-display text-[clamp(1.8rem,3.5vw,2.8rem)] font-bold tracking-tight">
          Run the whole flow yourself
        </h2>
        <p className="mx-auto mt-4 max-w-[48ch] text-fog">
          Facilitator, paid API, and a paying agent: all on Fuji, all open
          source. One command each.
        </p>

        <div className="mx-auto mt-8 max-w-md overflow-x-auto rounded-lg border border-white/10 bg-void px-5 py-4 text-left font-mono text-sm text-fog">
          <div>
            <span className="text-ember">$</span> pnpm --filter @cloakx402/demo agent
          </div>
          <div className="mt-1 text-fog/60">HTTP 200 · amount on-chain: ▓▓▓▓▓▓</div>
        </div>

        <div className="mt-9 flex flex-wrap justify-center gap-4">
          <a
            href={GITHUB}
            className="rounded-full bg-ember px-7 py-3 font-display font-semibold text-void transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            Star the repo
          </a>
          <a
            href="/docs/eerc-exact"
            className="rounded-full border border-white/20 px-7 py-3 font-display font-semibold text-bone transition-colors hover:border-ember hover:text-ember"
          >
            eerc-exact spec
          </a>
        </div>
      </motion.div>
    </section>
  );
}
