import type { Metadata } from "next";
import {
  A,
  B,
  Code,
  CodeBlock,
  H2,
  Ol,
  P,
  PageHeader,
  PrevNext,
} from "@/components/docs/primitives";

export const metadata: Metadata = {
  title: "How it works | cloakx402 docs",
  description:
    "The cloakx402 payment flow: 402 terms, client-side zk proof, facilitator verification, and self-bundled 4337 settlement.",
};

export default function HowItWorks() {
  return (
    <>
      <PageHeader
        eyebrow="Concepts"
        title="How it works"
        lead="The standard x402 dance, with the settlement leg swapped for an encrypted eERC transfer inside an ERC-4337 UserOperation."
      />

      <H2 id="the-flow">The flow</H2>
      <Ol>
        <li>
          <B>The API names its price.</B> The agent calls a paid endpoint and
          gets a 402 with <Code>eerc-exact</Code> terms: the encrypted token,
          the exact amount, and everything needed to build the payment.
        </li>
        <li>
          <B>The agent proves, not reveals.</B> Client-side, the agent builds
          a Groth16 proof of an encrypted transfer: exact amount, receiver,
          and its current balance ciphertext are all committed inside. About
          two seconds on a laptop.
        </li>
        <li>
          <B>The facilitator verifies everything.</B> The retry carries the
          signed UserOperation. Before settling, the facilitator runs its
          nine-point checklist against live chain state and decrypts the
          in-proof auditor ciphertext to confirm the exact amount.
        </li>
        <li>
          <B>Settled, sealed.</B> The facilitator self-bundles the
          UserOperation through the canonical EntryPoint. On Snowtrace, the
          amount is ciphertext.
        </li>
      </Ol>

      <CodeBlock title="one paid request">
        {`agent                facilitator              Avalanche C-Chain
  |  GET /api/alpha       |                            |
  |<--- 402 eerc-exact ---|                            |
  |  groth16 proof (~2s)  |                            |
  |--- X-PAYMENT -------->|  9 static checks           |
  |                       |  decrypt auditor PCT       |
  |                       |--- handleOps([userOp]) --->|  amount = ciphertext
  |<--- 200 + tx hash ----|                            |`}
      </CodeBlock>

      <H2 id="gasless">Why the agent never holds gas</H2>
      <P>
        The agent&apos;s wallet is an ERC-4337 smart account. eERC binds
        transfers to <Code>msg.sender</Code>, so the account submits its own
        transfer through the EntryPoint while the facilitator sponsors gas by
        topping up the account&apos;s EntryPoint deposit. Sponsorship happens
        only after full payment verification. No external bundler, no
        paymaster service: the facilitator calls{" "}
        <Code>entryPoint.handleOps</Code> itself.
      </P>

      <H2 id="auditor">The auditor role</H2>
      <P>
        Every transfer proof includes a ciphertext of the amount encrypted to
        the auditor&apos;s public key. The auditor is the one party who can
        size payments; the public chain cannot. By default the facilitator
        holds the (rotatable) auditor key, which is what lets it confirm the
        exact amount during verification. Deployments that want full privacy
        self-host the facilitator next to the API server, so no third party
        ever sees amounts. The trust tradeoff is explicit and covered in the{" "}
        <A href="/docs/threat-model">threat model</A>.
      </P>

      <H2 id="protocol-fit">Where it sits in x402</H2>
      <P>
        cloakx402 is built on the x402 v2 packages (<Code>@x402/core</Code>,{" "}
        <Code>@x402/express</Code>, <Code>@x402/fetch</Code>):{" "}
        <Code>eerc-exact</Code> plugs in as a scheme registration, without
        forking the protocol. Any x402 resource server can price endpoints in
        encrypted eERC by pointing at a cloakx402 facilitator.
      </P>

      <PrevNext current="/docs/how-it-works" />
    </>
  );
}
