"use client";

import { motion } from "motion/react";
import type { ReactNode } from "react";

const ease = [0.22, 1, 0.36, 1] as const;

function Frame({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="overflow-hidden rounded-lg border border-white/10 bg-coal">
      <div className="flex items-center gap-2 border-b border-white/10 px-4 py-2.5">
        <span className="size-2 rounded-full bg-ember/80" />
        <span className="font-mono text-xs text-fog">{title}</span>
      </div>
      <div className="overflow-x-auto p-4 font-mono text-[13px] leading-relaxed">
        {children}
      </div>
    </div>
  );
}

function Step({
  index,
  heading,
  body,
  frame,
  flip = false,
}: {
  index: number;
  heading: string;
  body: string;
  frame: ReactNode;
  flip?: boolean;
}) {
  return (
    <motion.div
      initial={{ y: 28 }}
      whileInView={{ y: 0 }}
      viewport={{ once: true, margin: "-80px" }}
      transition={{ duration: 0.7, ease, delay: index * 0.05 }}
      className={`grid items-center gap-8 md:grid-cols-2 ${flip ? "md:[&>*:first-child]:order-2" : ""}`}
    >
      <div>
        <h3 className="font-display text-2xl font-semibold">{heading}</h3>
        <p className="mt-3 max-w-[46ch] leading-relaxed text-fog">{body}</p>
      </div>
      {frame}
    </motion.div>
  );
}

const CHECKS = [
  "receiver matches payTo",
  "payer + receiver registered",
  "proof sender key = payer's registered key",
  "balance ciphertext is live (single-use)",
  "auditor ciphertext decrypts to exact amount",
  "Groth16 proof verifies on-chain",
];

export default function Flow() {
  return (
    <section id="flow" className="mx-auto max-w-6xl scroll-mt-20 px-5 py-28">
      <h2 className="font-display text-[clamp(1.9rem,4vw,3rem)] font-bold tracking-tight">
        One paid request, <span className="text-ember">zero leaked numbers</span>
      </h2>
      <p className="mt-4 max-w-[56ch] text-lg text-fog">
        The standard x402 dance, with the settlement leg swapped for an
        encrypted eERC transfer inside an ERC-4337 UserOperation.
      </p>

      <div className="mt-16 space-y-20">
        <Step
          index={0}
          heading="The API names its price"
          body="The agent calls a paid endpoint and gets a 402 with eerc-exact terms: the encrypted token, the exact amount, and everything needed to build the payment."
          frame={
            <Frame title="GET /api/alpha">
              <pre className="text-fog">
                <span className="text-ember">HTTP/1.1 402</span> Payment Required{"\n"}
                {"{"}
                {"\n"}  scheme: <span className="text-bone">&quot;eerc-exact&quot;</span>,
                {"\n"}  network: <span className="text-bone">&quot;eip155:43113&quot;</span>,
                {"\n"}  amount: <span className="text-bone">&quot;100000&quot;</span>
                {"  "}
                <span className="text-fog/60">// $0.10, 6 decimals</span>
                {"\n"}  payTo: <span className="text-bone">0xae43…229b</span>
                {"\n"}
                {"}"}
              </pre>
            </Frame>
          }
        />

        <Step
          index={1}
          flip
          heading="The agent proves, not reveals"
          body="Client-side, the agent builds a Groth16 proof of an encrypted transfer: exact amount, receiver, and its current balance ciphertext are all committed inside. About two seconds on a laptop."
          frame={
            <Frame title="transfer.circom — witness">
              <pre className="text-fog">
                ValueToTransfer     <span className="text-ember">▓▓▓▓▓▓</span>{"  "}
                <span className="text-fog/60">// encrypted</span>{"\n"}
                SenderBalance       <span className="text-ember">▓▓▓▓▓▓▓▓</span>{"\n"}
                ReceiverPublicKey   <span className="text-bone">0x11f3…, 0x2a90…</span>{"\n"}
                AuditorPCT          <span className="text-bone">poseidon(amount)</span>{"\n\n"}
                <span className="text-cipher">groth16 proof generated in 1.7s</span>
              </pre>
            </Frame>
          }
        />

        <Step
          index={2}
          heading="The facilitator verifies everything"
          body="The retry carries the signed UserOperation. Before settling, the facilitator runs its checklist against live chain state, and decrypts the in-proof auditor ciphertext to confirm the exact amount."
          frame={
            <Frame title="cloakx402 facilitator — verify">
              <div className="space-y-1.5">
                {CHECKS.map((check, i) => (
                  <motion.div
                    key={check}
                    initial={{ opacity: 0.25, x: -8 }}
                    whileInView={{ opacity: 1, x: 0 }}
                    viewport={{ once: true }}
                    transition={{ duration: 0.35, ease, delay: 0.3 + i * 0.12 }}
                    className="flex items-center gap-2.5 text-fog"
                  >
                    <span className="text-ember">✓</span>
                    {check}
                  </motion.div>
                ))}
                <motion.div
                  initial={{ opacity: 0.25 }}
                  whileInView={{ opacity: 1 }}
                  viewport={{ once: true }}
                  transition={{ delay: 0.3 + CHECKS.length * 0.12 }}
                  className="pt-1 text-cipher"
                >
                  verify OK — payer 0x5197…4E0E
                </motion.div>
              </div>
            </Frame>
          }
        />

        <Step
          index={3}
          flip
          heading="Settled. Sealed."
          body="The facilitator self-bundles the UserOperation through the canonical EntryPoint: no external bundler, no paymaster service, and the agent's owner key never holds gas. On Snowtrace, the amount is ciphertext."
          frame={
            <Frame title="200 OK — settlement">
              <pre className="text-fog">
                <span className="text-cipher">HTTP/1.1 200</span> OK{"\n"}
                tx{" "}
                <a
                  href="https://testnet.snowtrace.io/tx/0x22fa036ae2bccbb35a578cad1540f91b44eadefe6a7c1dee805e8b2b7f629964"
                  className="text-bone underline decoration-white/20 underline-offset-4 hover:text-ember"
                >
                  0x22fa036a…7964
                </a>{"\n"}
                amount visible on-chain:{" "}
                <span className="text-ember">▓▓▓▓▓▓▓▓▓▓</span>{"\n"}
                gas paid by agent owner: <span className="text-bone">0 AVAX</span>
              </pre>
            </Frame>
          }
        />
      </div>
    </section>
  );
}
