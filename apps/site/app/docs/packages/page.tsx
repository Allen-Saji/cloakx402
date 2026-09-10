import type { Metadata } from "next";
import {
  A,
  Code,
  DocTable,
  H2,
  P,
  PageHeader,
  PrevNext,
} from "@/components/docs/primitives";

export const metadata: Metadata = {
  title: "Packages | cloakx402 docs",
  description:
    "The cloakx402 monorepo: eERC crypto core, facilitator, agent SDK, demo paid API, and the Fuji end-to-end demo.",
};

export default function Packages() {
  return (
    <>
      <PageHeader
        eyebrow="Reference"
        title="Packages"
        lead="A pnpm workspace: crypto core, facilitator, agent-side SDK, and two demo packages, plus a pinned eERC fork."
      />

      <H2 id="workspace">Workspace layout</H2>
      <DocTable
        head={["Package", "Purpose"]}
        mono={[0]}
        rows={[
          [
            "packages/eerc",
            "eERC crypto core: key derivation, PCT encryption, transfer proofs, 4337 UserOp helpers",
          ],
          [
            "packages/facilitator",
            <>
              x402 facilitator with the <Code>eerc-exact</Code> scheme (verify
              + settle) and HTTP app
            </>,
          ],
          [
            "packages/client",
            "Agent-side SDK: CloakAgent, x402 scheme client, payment-enabled fetch",
          ],
          [
            "packages/server-demo",
            <>
              Demo paid API using the <Code>eerc-exact</Code> scheme via{" "}
              <Code>@x402/express</Code>
            </>,
          ],
          [
            "packages/demo",
            "Fuji end-to-end demo: setup script and a paying agent",
          ],
          [
            "vendor/EncryptedERC",
            "Pinned fork of ava-labs/EncryptedERC with Fuji deploy config and zk artifacts",
          ],
        ]}
      />

      <H2 id="x402-fit">Built on x402 v2</H2>
      <P>
        cloakx402 builds on the x402 v2 packages (<Code>@x402/core</Code>,{" "}
        <Code>@x402/express</Code>, <Code>@x402/fetch</Code>):{" "}
        <Code>eerc-exact</Code> plugs in as a scheme registration, without
        forking the protocol. The scheme is specified in{" "}
        <A href="/docs/eerc-exact">the eerc-exact reference</A>.
      </P>

      <H2 id="source">Source</H2>
      <P>
        Everything is MIT-licensed at{" "}
        <A href="https://github.com/Allen-Saji/cloakx402">
          github.com/Allen-Saji/cloakx402
        </A>
        . The packages are workspace-internal for now (not published to npm);
        the <A href="/docs/quickstart">quickstart</A> runs everything from the
        repo.
      </P>

      <PrevNext current="/docs/packages" />
    </>
  );
}
