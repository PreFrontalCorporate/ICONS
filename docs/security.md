# Verification & Integrity

* Multipass tokens are validated server‑side only (never in the client).
* `/api/verify` signs its JSON response with a SHA‑256 manifest hash.
* Clients refuse to render files whose id is not in `allowedIds` OR whose
  hash does not match the manifest hash.

## Threat model
…
