"use client";

import dynamic from "next/dynamic";
import DecryptedText from "./bits/DecryptedText";

const DarkVeil = dynamic(() => import("./bits/DarkVeil"), { ssr: false });

const GITHUB = "https://github.com/Allen-Saji/cloakx402";
const SETTLE_TX =
  "0x22fa036ae2bccbb35a578cad1540f91b44eadefe6a7c1dee805e8b2b7f629964";

export default function Hero() {
  return (
    <section className="relative flex min-h-[92svh] flex-col justify-center overflow-hidden">
      <div className="absolute inset-0 opacity-60" aria-hidden>
        <DarkVeil hueShift={240} noiseIntensity={0.04} speed={0.6} warpAmount={0.9} />
      </div>
      <div className="absolute inset-0 bg-gradient-to-b from-void/30 via-void/55 to-void" aria-hidden />

      <div className="relative mx-auto w-full max-w-6xl px-5 pt-24">
        <h1 className="font-display text-[clamp(2.6rem,7.5vw,5.5rem)] font-bold leading-[1.02] tracking-tight">
          Pay the API.
          <br />
          <span className="text-ember">
            <DecryptedText
              text="Hide the amount."
              animateOn="view"
              sequential
              speed={38}
              characters="0123456789abcdef▓"
              encryptedClassName="text-cipher/70"
            />
          </span>
        </h1>

        <p className="mt-7 max-w-[52ch] text-lg leading-relaxed text-fog">
          cloakx402 is a confidential x402 facilitator on Avalanche. Agents pay
          per request in encrypted eERC: the transfer is public, the amount is
          nobody&apos;s business.
        </p>

        <div className="mt-10 flex flex-wrap items-center gap-4">
          <a
            href={GITHUB}
            className="rounded-full bg-ember px-7 py-3 font-display font-semibold text-void transition-transform hover:scale-[1.03] active:scale-[0.98]"
          >
            View on GitHub
          </a>
          <a
            href="/docs"
            className="rounded-full border border-white/20 px-7 py-3 font-display font-semibold text-bone transition-colors hover:border-ember hover:text-ember"
          >
            Read the docs
          </a>
        </div>
      </div>

      <div className="relative mt-16 border-t border-white/5 py-3">
        <div className="flex overflow-hidden whitespace-nowrap [mask-image:linear-gradient(90deg,transparent,black_10%,black_90%,transparent)]">
          <div className="flex min-w-full shrink-0 animate-ticker items-center gap-10 pr-10 font-mono text-xs text-fog/80">
            {[0, 1].map((i) => (
              <span key={i} className="flex items-center gap-10">
                <span>settled on Fuji</span>
                <a
                  href={`https://testnet.snowtrace.io/tx/${SETTLE_TX}`}
                  className="text-cipher transition-colors hover:text-ember"
                >
                  {SETTLE_TX.slice(0, 22)}…
                </a>
                <span>
                  amount on-chain: <span className="text-ember">▓▓▓▓▓▓▓▓</span>
                </span>
                <span>proof 1.7s</span>
                <span>gas paid by agent: 0 AVAX</span>
              </span>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
