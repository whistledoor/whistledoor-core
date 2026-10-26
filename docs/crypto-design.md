# Crypto design

Status: draft, 2026-10-26. Implements the decisions in the private `whistledoor-app/docs/PLAN.md` and issue #2, against the actors in [threat-model.md](threat-model.md). `packages/crypto` must match this document; a change here comes first, code second.

Items marked **(proposed)** go beyond the settled decisions and need sign-off in review. Items marked **open** are not decided.

## 1. Rules

- libsodium only, through libsodium.js (`libsodium-wrappers-sumo`, because the standard build lacks `crypto_pwhash`). Same library in the browser and in Node tests.
- High-level calls only. Allowed:
  - `crypto_box_keypair`, `crypto_box_seed_keypair`, `crypto_box_seal`, `crypto_box_seal_open`
  - `crypto_secretbox_easy`, `crypto_secretbox_open_easy`
  - `crypto_pwhash` (Argon2id13)
  - `crypto_generichash`, `crypto_kdf_derive_from_key` **(proposed)**: needed to split one secret into independent keys (sections 2 and 3)
  - `crypto_secretstream_xchacha20poly1305_*` **(proposed)**: for files (section 6)
  - `randombytes_buf`, `memzero`
- No hand-built constructions: no custom modes, no manual nonce counters, no raw ChaCha or HMAC.
- Every key derivation uses its own `crypto_kdf` context (8 bytes) so keys from different purposes can never collide: `WDcase01`, `WDpass01`, `WDrcvr01`.
- Every stored ciphertext starts with a 1-byte format version (`0x01`), so formats and parameters can change later without guessing. **(proposed)**
- Every function has fixed test vectors that run in Node and the browser. Randomness is passed in as a parameter in tests, never mocked globally.

## 2. Case code

Decided: 100 random bits, 20 Base32 characters in 5 groups, shown once, last group confirmed, copy / .txt / print, error-tolerant input. The server never receives the code.

- **Alphabet:** Crockford Base32 (`0-9 A-Z` without `I L O U`). **(proposed)** On input: uppercase, drop spaces and dashes, read `I`/`L` as `1` and `O` as `0`. Display: `XXXX-XXXX-XXXX-XXXX-XXXX`.
- **Generate:** `randombytes_buf(13)`, clear the last 4 bits, encode the first 100 bits as 20 characters.
- **Derive:**
  ```
  seed      = crypto_generichash(32, codeBytes)          // 13 decoded bytes
  lookupId  = crypto_kdf_derive_from_key(32, 1, "WDcase01", seed)
  caseKey   = crypto_kdf_derive_from_key(32, 2, "WDcase01", seed)
  ```
- `lookupId` goes to the server and identifies the case. The server stores only `crypto_generichash(lookupId)`, so a database leak does not let anyone log in as the reporter. **(proposed)**
- `caseKey` never leaves the reporter's browser except sealed to the tenant (section 5).
- 100 bits makes guessing a `lookupId` or `caseKey` impractical, so no slow hash is needed here. The API still rate-limits lookups.
- **Open:** a Crockford check symbol to catch typos before the lookup request. Without it, a typo simply finds no case.

## 3. Handler password: authKey and kek

Decided: browser Argon2id, split into `authKey` (to better-auth, hashed again there) and `kek` (never leaves the browser). TOTP 2FA on top.

```
master  = crypto_pwhash(32, password, salt, opslimit, memlimit, ARGON2ID13)
authKey = crypto_kdf_derive_from_key(32, 1, "WDpass01", master)
kek     = crypto_kdf_derive_from_key(32, 2, "WDpass01", master)
```

- `salt`: 16 random bytes per handler, stored on the server next to `opslimit` and `memlimit`, fetched by email before login. For unknown emails the server returns a deterministic fake salt (keyed hash of the email) so the endpoint does not reveal who has an account. **(proposed)**
- `authKey` is sent hex-encoded as the better-auth "password"; better-auth hashes it again. A server that only stores that hash cannot recover `kek`.
- **Parameters (proposed):** `opslimit = 3`, `memlimit = 64 MiB`. This is close to Bitwarden's Argon2id default and runs in about a second on a recent laptop. Stored per handler, so they can be raised later by re-deriving at the next login.
- `master` is wiped with `memzero` right after the two subkeys are derived.
- Changing the password: derive new `authKey` and `kek`, re-wrap the handler's private key, update both on the server in one request. The key pair stays the same.

## 4. Keys: handlers, tenants, recovery

Decided: one X25519 key pair per handler; the tenant key is wrapped once per handler; re-grant by another handler; recovery key at onboarding.

**Handler key pair.** Created in the browser at signup with `crypto_box_keypair`. The server stores:
```
handlerPk
wrappedHandlerSk = nonce(24) || crypto_secretbox_easy(handlerSk, nonce, kek)
```
One handler key pair serves every tenant the handler belongs to, which keeps the later ombudsperson mode possible.

**Tenant key pair.** Created by the first handler's browser at onboarding with `crypto_box_keypair`. `tenantPk` is public and is what reporters encrypt to. `tenantSk` is stored only wrapped:
```
grant(handler) = crypto_box_seal(tenantSk, handlerPk)
```
- **Unlock:** password → `kek` → open `wrappedHandlerSk` → `handlerSk` → `crypto_box_seal_open(grant)` → `tenantSk`.
- **Grant / re-grant:** an unlocked handler fetches the new handler's `handlerPk` and uploads `crypto_box_seal(tenantSk, newHandlerPk)`. This covers adding a handler and restoring one who forgot their password (the forgotten handler gets a new key pair first).
- **Remove:** delete that handler's grant. **Open:** rotating the tenant key afterwards, since a removed handler may have kept `tenantSk`. Rotation means a new tenant key pair and re-sealing every case's envelope (section 5), not re-encrypting content.
- **Open, key substitution:** a compromised server could hand an unlocked handler its own public key instead of the new handler's, and receive `tenantSk`. Likewise it could serve reporters a fake `tenantPk`. Candidate fix: show a short fingerprint (`crypto_generichash` of the public key, grouped) on both screens during a grant, and print the tenant fingerprint on the QR poster. This is the same class of risk as serving modified code in the threat model.

**Recovery key.** Decided: mandatory at onboarding unless there are at least two handlers.
```
recoveryKey = randombytes_buf(20)                       // 160 bits, 32 Crockford chars, 8 groups
seed        = crypto_kdf_derive_from_key(32, 1, "WDrcvr01", crypto_generichash(32, recoveryKey))
(recoveryPk, recoverySk) = crypto_box_seed_keypair(seed)
grant(recovery) = crypto_box_seal(tenantSk, recoveryPk)
```
- The recovery key acts as one more handler, so unlock and grant work the same way. **(proposed)**
- Shown once, confirmed by re-typing the last group, then offered as print / .txt. The server stores `recoveryPk` and the grant, never the key.
- Using it: enter the recovery key → `tenantSk` → grant to a (new) handler key pair → done.

## 5. Report and messages

Decided: the report is sealed to the tenant, plus a reporter copy under the case-code key.

On submit, the reporter's browser does:
```
envelope = crypto_box_seal({ v, caseKey }, tenantPk)
report   = nonce(24) || crypto_secretbox_easy(reportJson, nonce, caseKey)
```
and sends `lookupId`, `envelope` and `report`.

- Handlers open `envelope` with `tenantSk` to get `caseKey`, then read `report`. The reporter reads the same `report` with `caseKey` from the code. So "sealed to the tenant" seals the case key, and the content is stored once. **(proposed)** Sealing the full report twice would store every attachment twice for no gain.
- Follow-up messages, in both directions: `nonce(24) || crypto_secretbox_easy(messageJson, nonce, caseKey)`, with a fresh random nonce each time.
- Who sent a message (reporter or which handler) is recorded by the API from the authenticated session, not proven by the crypto. **Open:** whether to sign messages, and how to detect deleted or reordered messages (for example a hash chain over message IDs).
- Tenant key rotation only re-seals `envelope` per case.

## 6. Files

Decided: files are encrypted in the browser.

- Each file gets its own random 32-byte `fileKey`. The file is encrypted with `crypto_secretstream_xchacha20poly1305` in 64 KiB chunks, the last chunk tagged `FINAL`, so truncation and reordering are detected. **(proposed)**
- File name, type, size, `fileKey` and the stream header go into the report or message JSON, so they are under `caseKey` too. The server sees only an opaque object and its size.
- **Open:** padding file sizes into buckets to hide exact length; maximum file size; stripping metadata (EXIF, document author) before encryption. Metadata stripping is not crypto but matters for reporter identity.

## 7. Keys in memory

Decided: unlocked keys live in memory only; auto-lock after 15 minutes idle.

- Nothing secret goes to `localStorage`, `sessionStorage`, IndexedDB, cookies or the service worker. A page reload means unlocking again.
- Keys are held as `Uint8Array` in one module. Lock calls `memzero` on `kek`, `handlerSk`, every `tenantSk` and every `caseKey`, then drops the references. JavaScript gives no guarantee that copies are gone; this is best effort.
- The reporter app keeps `caseKey` only for the open session and never stores the case code.
- Web Crypto non-extractable keys are not used, because libsodium needs raw bytes. **(noted, not a goal)**

## 8. What the server stores

| Item | Form |
| --- | --- |
| Handler | email, `salt`, Argon2id params, hash of `authKey`, `handlerPk`, `wrappedHandlerSk`, TOTP secret |
| Tenant | `tenantPk`, one grant per handler, recovery `recoveryPk` and grant |
| Case | hash of `lookupId`, `envelope`, `report`, timestamps |
| Message / file | ciphertext, size, timestamps, sender role |

Nothing in this table lets the server read content without a handler password, a recovery key or a case code.

## Open items

1. Crockford check symbol for the case code.
2. Tenant key rotation when a handler is removed.
3. Key substitution: fingerprints for grants and for `tenantPk`.
4. Message signing and detecting deleted or reordered messages.
5. File size padding, size limit, metadata stripping.
6. Final Argon2id parameters after measuring on low-end devices.
