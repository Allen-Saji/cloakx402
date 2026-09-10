import type { Metadata } from "next";
import {
  A,
  B,
  Code,
  Callout,
  H2,
  P,
  PageHeader,
  PrevNext,
  Ul,
} from "@/components/docs/primitives";

export const metadata: Metadata = {
  title: "Introduction | cloakx402 docs",
  description:
    "What cloakx402 is: a confidential x402 facilitator on Avalanche that settles paid API requests in encrypted eERC.",
};

export default function Introduction() {
  return (
    <>
      <PageHeader
        eyebrow="Getting started"
        title="Introduction"
        lead="cloakx402 is a confidential x402 facilitator on Avalanche. Agents pay for APIs per request; the transfer is public, the amount is nobody's business."
      />

      <H2 id="the-problem">The problem</H2>
      <P>
        x402 lets clients and AI agents pay for HTTP APIs per request. Today
        every x402 payment on Avalanche settles as a plain USDC transfer:
        anyone watching the chain can see which services an agent uses, how
        often, and how much it spends. An agent&apos;s spend is its strategy,
        and it is sitting in a public ledger.
      </P>

      <H2 id="the-approach">The approach</H2>
      <P>
        cloakx402 keeps the rails and hides the numbers. Payments settle through
        eERC (Encrypted ERC), AvaCloud&apos;s confidential token standard.
        Balances and transfer amounts stay encrypted on-chain under ElGamal +
        zk-SNARKs (Groth16). A rotatable auditor key gives compliance-grade
        visibility to exactly one designated party and nobody else.
      </P>
      <Ul>
        <li>
          The agent&apos;s wallet is an <B>ERC-4337 smart account</B>. eERC
          binds transfers to <Code>msg.sender</Code>, so the account submits
          its own transfer through the EntryPoint while the facilitator
          sponsors gas. The agent never needs AVAX.
        </li>
        <li>
          The facilitator implements a custom x402 v2 scheme,{" "}
          <A href="/docs/eerc-exact">eerc-exact</A>, registered for{" "}
          <Code>eip155:43113</Code> (Fuji). It verifies the zk proof against
          the payer&apos;s live balance ciphertext, decrypts the in-proof
          auditor ciphertext to confirm the exact amount, and self-bundles
          settlement via <Code>entryPoint.handleOps</Code>, with no external
          bundler or paymaster service.
        </li>
        <li>
          Amounts are hidden from the public chain. The auditor role is held
          by the facilitator by default, or self-hosted by the API server for
          full privacy.
        </li>
      </Ul>

      <H2 id="verified-on-fuji">Verified on Fuji</H2>
      <Ul>
        <li>
          eERC converter stack with audited prod verifiers:{" "}
          <A href="https://testnet.snowtrace.io/address/0x2A60EF46E6D65580144c734592AA8D163A97EFdd">
            contract on Snowtrace
          </A>
        </li>
        <li>
          Gasless 4337 leg (smart account pays, owner EOA holds zero gas):{" "}
          <A href="https://testnet.snowtrace.io/tx/0x04732f489e4610bd2cb35529137570412a0d63d895591d29e97c8586d9c2eef6">
            0x04732f48…
          </A>
        </li>
        <li>
          Full x402 paid request through the facilitator:{" "}
          <A href="https://testnet.snowtrace.io/tx/0x22fa036ae2bccbb35a578cad1540f91b44eadefe6a7c1dee805e8b2b7f629964">
            0x22fa036a…
          </A>
        </li>
      </Ul>

      <Callout label="Status">
        Built for the Team1 India Speedrun: Privacy on Avalanche (July 2026).
        Testnet (Fuji) only. Not audited beyond the upstream eERC audit; do
        not use with real funds.
      </Callout>

      <H2 id="prior-art">Prior art</H2>
      <P>
        cloakx402 ports the idea behind{" "}
        <A href="https://px402.allensaji.dev">px402</A> (private x402 on
        Solana / MagicBlock private ephemeral rollups) to the Avalanche stack.
      </P>

      <PrevNext current="/docs" />
    </>
  );
}
