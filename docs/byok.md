# BYOK — Bring Your Own Key

VisaWorker's open edition runs against **the user's own Anthropic API
key**, not a shared key held by the server. This is a deliberate design
choice: your petition drafts, exhibits, and chat transcripts are only
ever sent to Anthropic through your own account, under your own quota,
governed by your own contract with Anthropic.

## How it works

1. On the **Settings** tab of any project, the user pastes an Anthropic
   API key (`sk-ant-...`).
2. The key is encrypted with `BYOK_ENCRYPTION_KEY` (server-side,
   AES-GCM) and stored on the `projects` row.
3. Every agent turn, tool call, exhibit-review pass, and letter-draft
   call decrypts the key inside the server function and passes it
   directly to the Anthropic SDK.
4. The plaintext key never leaves the server function's memory and is
   never logged, cached, or forwarded to a third party.

The relevant code is open — see:
- `src/lib/ai-key-crypto.server.ts` — encryption primitives
- `src/lib/ai-config.server.ts` — resolver used by every agent path
- `src/components/workspace/ByokPanel.tsx` — the UI

## Rotating `BYOK_ENCRYPTION_KEY`

If you rotate the deployment-level key, every stored user key must be
re-encrypted (decrypt with the old key, encrypt with the new one)
before the old key is discarded. There is no automatic re-encryption
job — treat the encryption key as a long-lived secret and back it up.

## Threat model

- **Server operator can read user keys.** BYOK protects against
  passive database compromise (the key at rest is encrypted), not
  against a malicious server operator. If you're self-hosting for
  multiple third parties, tell them so.
- **Anthropic sees the prompts.** BYOK routes calls through the user's
  own Anthropic account. Anthropic's data-handling policy applies to
  those calls, not VisaWorker's.
- **The `BYOK_ENCRYPTION_KEY` is the single point of failure** at rest.
  Store it in a secret manager, not in git.

## Managed AI mode (hosted product only)

The hosted product at visaworker.ai offers a managed mode that uses a
server-held Anthropic key with metering and billing. That resolver
lives in `src/ee/ai-managed/` and is replaced by an `ee_required` stub
in the open edition.
