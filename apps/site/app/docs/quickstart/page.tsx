import type { Metadata } from "next";
import {
  B,
  Code,
  CodeBlock,
  Callout,
  H2,
  P,
  PageHeader,
  PrevNext,
  Ul,
} from "@/components/docs/primitives";

export const metadata: Metadata = {
  title: "Quickstart | cloakx402 docs",
  description:
    "Run the full cloakx402 flow on Fuji: facilitator, demo paid API, and a paying agent.",
};

export default function Quickstart() {
  return (
    <>
      <PageHeader
        eyebrow="Getting started"
        title="Quickstart"
        lead="Run the whole flow yourself on Fuji: facilitator, paid API, and a paying agent. One command each."
      />

      <H2 id="prerequisites">Prerequisites</H2>
      <Ul>
        <li>Node 22</li>
        <li>pnpm 9</li>
        <li>A funded Fuji key that owns the deployed eERC stack</li>
      </Ul>

      <H2 id="install">Install</H2>
      <CodeBlock title="shell">
        {`git clone --recurse-submodules https://github.com/Allen-Saji/cloakx402
cd cloakx402 && pnpm install

export FACILITATOR_PRIVATE_KEY=0x...   # operator key (gas + auditor)`}
      </CodeBlock>

      <H2 id="setup">One-time setup</H2>
      <P>
        The setup script rotates the eERC auditor to the facilitator&apos;s
        derived key, registers a seller and the agent&apos;s smart account,
        and funds the agent&apos;s encrypted balance.
      </P>
      <CodeBlock title="shell">
        {`pnpm --filter @cloakx402/demo run setup`}
      </CodeBlock>

      <H2 id="run">Run the three services</H2>
      <CodeBlock title="terminal 1 — facilitator">
        {`pnpm --filter @cloakx402/facilitator start`}
      </CodeBlock>
      <CodeBlock title="terminal 2 — demo API">
        {`# PAY_TO = seller address printed by setup
PAY_TO=0x... pnpm --filter @cloakx402/server-demo start`}
      </CodeBlock>
      <CodeBlock title="terminal 3 — the paying agent">
        {`pnpm --filter @cloakx402/demo agent`}
      </CodeBlock>

      <H2 id="what-happens">What happens</H2>
      <P>
        The agent hits <Code>GET /api/alpha</Code>, receives a 402 with{" "}
        <Code>eerc-exact</Code> terms, proves an encrypted transfer of exactly
        the required amount, retries with the payment header, and gets the
        resource plus the settlement transaction hash.
      </P>
      <Callout>
        Amounts on Snowtrace are ciphertexts. Open the settlement tx and look
        for the transfer value: there isn&apos;t one. Only the auditor key can
        size the payment.
      </Callout>

      <H2 id="troubleshooting">Notes</H2>
      <Ul>
        <li>
          The facilitator operator key pays gas and holds the auditor role;{" "}
          <B>the agent&apos;s owner EOA never needs AVAX</B>: its EntryPoint
          deposit is topped up by the facilitator after verification.
        </li>
        <li>
          Proof generation runs client-side and takes about 2 seconds on a
          laptop; a full paid request against public Fuji RPC measures about
          9 seconds with settle-before-respond.
        </li>
      </Ul>

      <PrevNext current="/docs/quickstart" />
    </>
  );
}
