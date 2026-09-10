import type { Metadata } from "next";
import {
  A,
  B,
  Code,
  CodeBlock,
  Callout,
  DocTable,
  H2,
  Ol,
  P,
  PageHeader,
  PrevNext,
} from "@/components/docs/primitives";

export const metadata: Metadata = {
  title: "The eerc-exact scheme | cloakx402 docs",
  description:
    "Reference for the eerc-exact x402 v2 payment scheme: PaymentRequirements, PaymentPayload, verification checklist, settlement, latency, and the transfer circuit public signal layout.",
};

export default function EercExact() {
  return (
    <>
      <PageHeader
        eyebrow="Reference"
        title="The eerc-exact scheme"
        lead="An x402 v2 payment scheme for confidential payments through eERC (Encrypted ERC) on Avalanche. Registered for eip155:43113 (Fuji)."
      />

      <H2 id="summary">Summary</H2>
      <DocTable
        head={["Field", "Value"]}
        mono={[1]}
        rows={[
          ["Scheme id", "eerc-exact"],
          ["Protocol", "x402 v2"],
          ["Network", "eip155:43113"],
          ["Asset", "the EncryptedERC contract address"],
          ["Amount", "eERC system units (6 decimals)"],
          ["Settlement", "ERC-4337 UserOperation self-bundled by the facilitator"],
        ]}
      />

      <H2 id="payment-requirements">PaymentRequirements</H2>
      <CodeBlock title="402 response — accepts[0]">
        {`{
  "scheme": "eerc-exact",
  "network": "eip155:43113",
  "amount": "100000",
  "asset": "0x2A60EF46E6D65580144c734592AA8D163A97EFdd",
  "payTo": "0xae43...229b",
  "maxTimeoutSeconds": 120,
  "extra": {
    "entryPoint": "0x0000000071727De22E5E9d8BAf0edAc6f37da032",
    "simpleAccountFactory": "0x91E60e0613810449d098b0b5Ec8b51A0FE8c8985",
    "registrar": "0xf851...CD9A",
    "encryptedERC": "0x2A60...EFdd",
    "erc20": "0xB7f1...Ebca",
    "auditorPublicKey": ["...", "..."],
    "decimals": 6
  }
}`}
      </CodeBlock>
      <P>
        <Code>payTo</Code> must be an address registered in the eERC
        Registrar. <Code>extra</Code> is advertised by the facilitator through{" "}
        <Code>GET /supported</Code> and merged into requirements by the
        resource server.
      </P>

      <H2 id="payment-payload">PaymentPayload</H2>
      <P>
        The <Code>X-PAYMENT</Code> / <Code>PAYMENT-SIGNATURE</Code> header
        carries:
      </P>
      <CodeBlock title="X-PAYMENT">
        {`{
  "x402Version": 2,
  "payload": {
    "userOp": {
      "sender": "0x...",
      "nonce": "3",
      "initCode": "0x",
      "callData": "0x...",
      "accountGasLimits": "0x...",
      "preVerificationGas": "100000",
      "gasFees": "0x...",
      "paymasterAndData": "0x",
      "signature": "0x..."
    }
  }
}`}
      </CodeBlock>
      <P>
        <Code>userOp</Code> is an EntryPoint v0.7 PackedUserOperation whose
        callData is{" "}
        <Code>
          SimpleAccount.execute(encryptedERC, 0, transfer(payTo, tokenId,
          proof, balancePCT))
        </Code>
        , where <Code>proof</Code> is a Groth16 transfer proof with 32 public
        signals. The proof commits to the sender&apos;s current balance
        ciphertext, the receiver, the amount, and the auditor ciphertext, so
        the payload is <B>single-use and tamper-evident by construction</B>.
        eERC binds <Code>transfer</Code> to <Code>msg.sender</Code>, which the
        EntryPoint sets to the smart account.
      </P>

      <H2 id="verification">Verification (facilitator)</H2>
      <P>All checks are static reads; verify never mutates chain state.</P>
      <Ol>
        <li>
          <Code>requirements.scheme</Code>, <Code>network</Code>, and{" "}
          <Code>asset</Code> match the deployment.
        </li>
        <li>
          The UserOperation decodes to{" "}
          <Code>execute(encryptedERC, 0, transfer(...))</Code>.
        </li>
        <li>
          <Code>transfer.to == requirements.payTo</Code> and the token id
          matches the converter&apos;s registered ERC20.
        </li>
        <li>Payer and receiver are registered in the Registrar.</li>
        <li>
          Public signals [0,1] equal the payer&apos;s registered BabyJubJub
          key; [10,11] equal the receiver&apos;s.
        </li>
        <li>
          Public signals [2..5] equal the payer&apos;s live on-chain balance
          ciphertext (freshness: a spent or superseded proof cannot match).
        </li>
        <li>
          Public signals [23,24] equal the facilitator&apos;s auditor key, and
          the auditor PCT [25..31] decrypts to exactly{" "}
          <Code>requirements.amount</Code>.
        </li>
        <li>
          The Groth16 proof verifies against the audited on-chain
          TransferVerifier (staticcall).
        </li>
        <li>
          The UserOperation nonce equals the account&apos;s current EntryPoint
          nonce.
        </li>
      </Ol>
      <Callout>
        The decrypted amount check is the confidential analogue of checking a
        USDC transfer value: only the auditor (the facilitator by default)
        can size the payment; the public chain cannot.
      </Callout>

      <H2 id="settlement">Settlement (facilitator)</H2>
      <Ol>
        <li>Re-verify.</li>
        <li>
          Serialize per sender: proofs commit to the balance ciphertext, so
          concurrent settlements from one account would revert. Different
          senders settle in parallel.
        </li>
        <li>
          Sponsor gas: top up the account&apos;s EntryPoint deposit when below
          a threshold. The agent&apos;s owner EOA never holds AVAX.
        </li>
        <li>
          Self-bundle: <Code>entryPoint.handleOps([userOp], facilitator)</Code>
          . No external bundler or paymaster service.
        </li>
        <li>
          Confirm the <Code>UserOperationEvent.success</Code> flag (
          <Code>handleOps</Code> itself succeeds even when the inner call
          reverts).
        </li>
      </Ol>

      <H2 id="latency">Latency</H2>
      <P>
        Transfer proof generation is about 2.4s client side. A full paid
        request (402, proof, verify, settle with on-chain inclusion, 200)
        measures about 8.7s against public Fuji RPC with settle-before-respond:
        batched verify reads (one RPC round trip), 1s receipt polling matched
        to Fuji&apos;s 2s blocks, and a client that builds the payment
        UserOperation with batched reads. The floor is proof time plus one
        block of inclusion. Verify-only response with async settlement would
        cut this to roughly proof time plus one roundtrip.
      </P>

      <H2 id="signal-layout">Transfer circuit public signal layout</H2>
      <P>
        Order follows the signal declaration order in{" "}
        <Code>circom/transfer.circom</Code> (public inputs only),
        cross-checked against <Code>EncryptedERC._executePrivateTransfer</Code>
        . Also published in the repo at{" "}
        <A href="https://github.com/Allen-Saji/cloakx402/blob/main/docs/eerc-exact.md">
          docs/eerc-exact.md
        </A>
        .
      </P>
      <DocTable
        head={["Index", "Signal"]}
        mono={[0, 1]}
        rows={[
          ["0-1", "SenderPublicKey"],
          ["2-3", "SenderBalanceC1"],
          ["4-5", "SenderBalanceC2"],
          ["6-7", "SenderVTTC1"],
          ["8-9", "SenderVTTC2"],
          ["10-11", "ReceiverPublicKey"],
          ["12-13", "ReceiverVTTC1"],
          ["14-15", "ReceiverVTTC2"],
          ["16-19", "ReceiverPCT"],
          ["20-21", "ReceiverPCTAuthKey"],
          ["22", "ReceiverPCTNonce"],
          ["23-24", "AuditorPublicKey"],
          ["25-28", "AuditorPCT"],
          ["29-30", "AuditorPCTAuthKey"],
          ["31", "AuditorPCTNonce"],
        ]}
      />

      <PrevNext current="/docs/eerc-exact" />
    </>
  );
}
