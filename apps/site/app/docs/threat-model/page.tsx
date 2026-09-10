import type { Metadata } from "next";
import {
  B,
  Callout,
  H2,
  P,
  PageHeader,
  PrevNext,
} from "@/components/docs/primitives";

export const metadata: Metadata = {
  title: "Threat model | cloakx402 docs",
  description:
    "What cloakx402 protects against, what it trusts, and the tradeoffs: auditor visibility, replay, concurrency, withheld proofs, gas sponsorship, key derivation.",
};

export default function ThreatModel() {
  return (
    <>
      <PageHeader
        eyebrow="Concepts"
        title="Threat model"
        lead="What the design protects against, what it deliberately trusts, and where the edges are."
      />

      <H2 id="facilitator-as-auditor">Facilitator as auditor</H2>
      <P>
        Amounts are hidden from the public chain, <B>not</B> from the
        facilitator: its rotatable auditor key decrypts every payment in its
        scheme. That is the compliance feature, and the trust tradeoff is
        explicit. Full-privacy deployments self-host the facilitator next to
        the API server so no third party sees amounts.
      </P>

      <H2 id="replay-and-tampering">Replay and tampering</H2>
      <P>
        Transfer proofs commit to the sender&apos;s exact current balance
        ciphertext, the receiver, the amount, and the auditor ciphertext. A
        settled proof no longer matches the live ciphertext, so every payload
        is single-use; nothing in it can be altered by a relayer.
      </P>

      <H2 id="concurrency">Concurrency</H2>
      <P>
        Two in-flight payments from one account would race on the balance
        ciphertext; the facilitator serializes settlement per sender.
        Different senders settle in parallel.
      </P>
      <Callout label="Deployment note">
        Per-sender serialization is in-process. Single-instance deployments
        get it for free; multi-instance deployments need a shared lock.
      </Callout>

      <H2 id="withheld-proofs">Withheld proofs</H2>
      <P>
        The circuit has no deadline, so an unsettled proof stays valid until
        the sender&apos;s balance ciphertext next changes. The facilitator
        settles immediately after verify; a sender can invalidate an
        outstanding proof with any self-transfer. A deadline signal needs an
        upstream circuit change (proposed as future work).
      </P>

      <H2 id="gas-sponsorship">Gas sponsorship</H2>
      <P>
        The facilitator tops up the payer&apos;s EntryPoint deposit.
        Sponsorship happens only after full payment verification, bounding
        griefing to verified-but-unsettleable edge cases.
      </P>

      <H2 id="key-derivation">Key derivation</H2>
      <P>
        The agent&apos;s BabyJubJub key is derived from its owner EOA&apos;s
        signature; whoever controls the owner EOA controls the encrypted
        balance.
      </P>

      <PrevNext current="/docs/threat-model" />
    </>
  );
}
