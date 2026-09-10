"use client";

import { useState } from "react";
import { motion } from "motion/react";
import DecryptedText from "./bits/DecryptedText";

interface Row {
  tx: string;
  to: string;
  facilitator: string;
  amount: string;
  cloaked: boolean;
}

const ROWS: Row[] = [
  { tx: "0x81ce…40aa", to: "0x7bd1…09c3", facilitator: "plain USDC", amount: "$1.50", cloaked: false },
  { tx: "0x22fa…7964", to: "0xae43…229b", facilitator: "cloakx402", amount: "$0.10", cloaked: true },
  { tx: "0xc4d8…1e7f", to: "0x3f02…88d1", facilitator: "plain USDC", amount: "$0.02", cloaked: false },
  { tx: "0x4da3…eb86", to: "0xae43…229b", facilitator: "cloakx402", amount: "$0.10", cloaked: true },
  { tx: "0x9a17…d2c5", to: "0x510e…4b77", facilitator: "plain USDC", amount: "$12.40", cloaked: false },
];

export default function Ledger() {
  const [auditor, setAuditor] = useState(false);

  return (
    <section id="ledger" className="scroll-mt-20 border-y border-white/5 bg-coal/40 py-28">
      <div className="mx-auto max-w-6xl px-5">
        <div className="flex flex-wrap items-end justify-between gap-6">
          <div>
            <h2 className="font-display text-[clamp(1.9rem,4vw,3rem)] font-bold tracking-tight">
              What the chain sees
            </h2>
            <p className="mt-4 max-w-[54ch] text-lg text-fog">
              Every other x402 facilitator on Avalanche settles plain USDC:
              your agent&apos;s spend is public strategy. cloakx402 rows carry
              ciphertext, and only the auditor key can read them.
            </p>
          </div>

          <button
            type="button"
            onClick={() => setAuditor((v) => !v)}
            aria-pressed={auditor}
            className={`rounded-full border px-5 py-2.5 font-mono text-sm transition-colors ${
              auditor
                ? "border-ember bg-ember/10 text-ember"
                : "border-white/20 text-fog hover:border-ember/60 hover:text-bone"
            }`}
          >
            {auditor ? "auditor key: ACTIVE" : "decrypt with auditor key"}
          </button>
        </div>

        <motion.div
          initial={{ y: 24 }}
          whileInView={{ y: 0 }}
          viewport={{ once: true, margin: "-60px" }}
          transition={{ duration: 0.7, ease: [0.22, 1, 0.36, 1] }}
          className="mt-12 overflow-x-auto rounded-lg border border-white/10 bg-void"
        >
          <table className="w-full min-w-[640px] font-mono text-sm">
            <thead>
              <tr className="border-b border-white/10 text-left text-xs text-fog">
                <th className="px-5 py-3.5 font-normal">tx</th>
                <th className="px-5 py-3.5 font-normal">to</th>
                <th className="px-5 py-3.5 font-normal">settled via</th>
                <th className="px-5 py-3.5 text-right font-normal">amount</th>
              </tr>
            </thead>
            <tbody>
              {ROWS.map((row) => (
                <tr
                  key={row.tx}
                  className={`border-b border-white/5 last:border-0 ${
                    row.cloaked ? "bg-ember/[0.04]" : ""
                  }`}
                >
                  <td className="px-5 py-4 text-fog">{row.tx}</td>
                  <td className="px-5 py-4 text-fog">{row.to}</td>
                  <td className="px-5 py-4">
                    {row.cloaked ? (
                      <span className="text-ember">cloakx402</span>
                    ) : (
                      <span className="text-fog">{row.facilitator}</span>
                    )}
                  </td>
                  <td className="px-5 py-4 text-right">
                    {!row.cloaked ? (
                      <span className="text-bone">{row.amount}</span>
                    ) : auditor ? (
                      <DecryptedText
                        key={`open-${row.tx}`}
                        text={row.amount}
                        animateOn="view"
                        sequential
                        speed={55}
                        characters="0123456789▓"
                        className="text-ember"
                        encryptedClassName="text-cipher/60"
                      />
                    ) : (
                      <span className="tracking-wider text-cipher/80">▓▓▓▓▓▓</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </motion.div>

        <p className="mt-5 font-mono text-xs text-fog/70">
          cloakx402 rows are real Fuji settlements; plain rows are illustrative.
          The auditor key is rotatable and held by the facilitator, or self-hosted for full privacy.
        </p>
      </div>
    </section>
  );
}
