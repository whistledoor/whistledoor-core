# Crypto design

Status: draft, 2026-10-26. Implements the decisions in the private `whistledoor-app/docs/PLAN.md` and issue #2, against the actors in [threat-model.md](threat-model.md). `packages/crypto` must match this document; a change here comes first, code second.

Items marked **(proposed)** go beyond the settled decisions and need sign-off in review. Items marked **open** are not decided.

## 1. Rules

- libsodium only, through libsodium.js (`libsodium-wrappers-sumo`, because the standard build lacks `crypto_pwhash`). Same library in the browser and in Node tests.
- High-level calls only. Allowed:
  - `crypto_box_keypair`, `crypto_box_seed_keypair`, `crypto_box_seal`, `crypto_box_seal_open`
  - `crypto_secretbox_easy`, `crypto_secretbox_open_easy`
  - `crypto_pwhash` (Argon2id13)
  - `crypto_generichash`, `crypto_kdf_derive_from_key`: needed to split one secret into independent keys (sections 2 and 3)
  - `crypto_secretstream_xchacha20poly1305_*`: for files (section 6)
  - `randombytes_buf`, `memzero`
- No hand-built constructions: no custom modes, no manual nonce counters, no raw ChaCha or HMAC.
- Every key derivation uses its own `crypto_kdf` context (8 bytes) so keys from different purposes can never collide: `WDcase01`, `WDpass01`, `WDrcvr01`.
- Every stored ciphertext starts with a 1-byte format version (`0x01`), so formats and parameters can change later without guessing. Formats below show it as `0x01 ||`. A reader rejects any other version.
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
master  = crypto_pwhash(32, utf8(nfc(password)), salt, opslimit, memlimit, ARGON2ID13)
authKey = crypto_kdf_derive_from_key(32, 1, "WDpass01", master)
kek     = crypto_kdf_derive_from_key(32, 2, "WDpass01", master)
```

- `password` is normalized to Unicode NFC, then UTF-8 encoded. The same password with umlauts can otherwise arrive as NFC or NFD depending on OS, keyboard or copy-paste, and the handler would be locked out. No other changes: no trimming, no case folding. **(proposed)**
- `salt`: 16 random bytes per handler, stored on the server next to `opslimit` and `memlimit`, fetched by email before login. For unknown emails the server returns a deterministic fake salt (keyed hash of the email) so the endpoint does not reveal who has an account. **(proposed)**
- `authKey` is sent hex-encoded as the better-auth "password"; better-auth hashes it again. A server that only stores that hash cannot recover `kek`.
- **Parameters (proposed):** `opslimit = 3`, `memlimit = 64 MiB`. This is close to Bitwarden's Argon2id default and runs in about a second on a recent laptop. Stored per handler, so they can be raised later by re-deriving at the next login.
- **Client minimum (proposed):** `opslimit >= 2`, `memlimit >= 19 MiB` (19,922,944 bytes), OWASP's minimum Argon2id configuration. Parameters come from the server, so a compromised server (threat model, actor 2) could serve cheap ones, receive an `authKey` from a weak hash, and guess the password offline far faster, which also yields `kek`. The browser therefore refuses to derive with parameters below this floor and stops the login without sending anything. The floor is a constant in `packages/crypto`, never fetched from the server.
  - The fake-salt response for unknown emails returns the current defaults, so it never trips the floor.
  - The final defaults (open item 2) must stay at or above the floor. The floor can only be raised once every stored handler's parameters are above the new value, otherwise those handlers cannot log in.
- `master` is wiped with `memzero` right after the two subkeys are derived.
- Changing the password: derive new `authKey` and `kek`, re-wrap the handler's private key, update both on the server in one request. The key pair stays the same.

## 4. Keys: handlers, tenants, recovery

Decided: one X25519 key pair per handler; the tenant key is wrapped once per handler; re-grant by another handler; recovery key at onboarding.

**Handler key pair.** Created in the browser at signup with `crypto_box_keypair`. The server stores:
```
handlerPk
wrappedHandlerSk = 0x01 || nonce(24) || crypto_secretbox_easy(handlerSk, nonce, kek)
```
One handler key pair serves every tenant the handler belongs to, which keeps the later ombudsperson mode possible.

**Tenant key pair.** Created by the first handler's browser at onboarding with `crypto_box_keypair`. `tenantPk` is public and is what reporters encrypt to. `tenantSk` is stored only wrapped:
```
grant(handler) = 0x01 || crypto_box_seal(tenantSk, handlerPk)
```
- **Unlock:** password → `kek` → open `wrappedHandlerSk` → `handlerSk` → `crypto_box_seal_open(grant)` → `tenantSk`.
- **Grant / re-grant:** an unlocked handler fetches the new handler's `handlerPk` and uploads `0x01 || crypto_box_seal(tenantSk, newHandlerPk)`. This covers adding a handler and restoring one who forgot their password (the forgotten handler gets a new key pair first). The grant is only uploaded after the fingerprint check below.
- **Remove:** delete that handler's grant, then rotate the tenant key (below).

**Fingerprints.** Decided 2026-10-27. A compromised server could hand an unlocked handler its own public key instead of the new handler's and receive `tenantSk`, or serve reporters a fake `tenantPk`. Public keys are therefore checked by fingerprint:
```
fingerprint(pk) = crypto_generichash(13, pk) with the last 4 bits cleared   // 100 bits
```
shown in the case-code format (section 2): 20 Crockford characters, `XXXX-XXXX-XXXX-XXXX-XXXX`. 100 bits make finding another key with the same fingerprint impractical.
- **Grant:** the new handler's app shows their own fingerprint. They read it to the granting handler in person or by phone; the granting handler types the last group, as when confirming a case code. Only on a match is the grant uploaded. This step cannot be skipped.
- **Recovery key:** no check needed; `recoveryPk` is derived in the same browser that holds the key.
- **Reporters:** the QR poster links to `https://<tenant>.melden.whistledoor.at/#fp=<20 characters>`. Browsers never send the fragment to the server. The reporter app compares it with the fetched `tenantPk` and refuses to submit on a mismatch. This turns key substitution into code substitution, which the published bundle hash makes detectable (threat model D9). Reporters who type the address by hand get no check.

**Tenant key rotation.** Decided 2026-10-27. A removed handler keeps whatever they have already seen: `tenantSk` and every `caseKey` they could open. Rotation cannot undo that. It protects reports filed after the removal, in case the removed handler later obtains ciphertext (a database leak, or someone helping them).
- Offered on every removal, on by default, and mandatory when the removal reason is "conflict".
- Done by the removing handler's browser, in one request: new tenant key pair; for every case, open `envelope` with the old `tenantSk` and seal `caseKey` to the new `tenantPk`; new grants for every remaining handler; a new recovery grant, which needs only `recoveryPk`, not the recovery key. No report content is re-encrypted.
- The tenant fingerprint changes, so old posters stop working. The handler app says so and offers new posters. On a mismatch the reporter page says the poster is out of date and points to the current one or to typing the address.

**Recovery key.** Decided: mandatory at onboarding unless there are at least two handlers.
```
recoveryKey = randombytes_buf(20)                       // 160 bits, 32 Crockford chars, 8 groups
seed        = crypto_kdf_derive_from_key(32, 1, "WDrcvr01", crypto_generichash(32, recoveryKey))
(recoveryPk, recoverySk) = crypto_box_seed_keypair(seed)
grant(recovery) = 0x01 || crypto_box_seal(tenantSk, recoveryPk)
```
- The recovery key acts as one more handler, so unlock and grant work the same way. **(proposed)**
- Shown once, confirmed by re-typing the last group, then offered as print / .txt. The server stores `recoveryPk` and the grant, never the key.
- Using it: enter the recovery key → `tenantSk` → grant to a (new) handler key pair → done.

## 5. Report and messages

Decided: the report is sealed to the tenant, plus a reporter copy under the case-code key.

On submit, the reporter's browser does:
```
envelope = 0x01 || crypto_box_seal(caseKey, tenantPk)   // the version byte does the job of a version field
report   = 0x01 || nonce(24) || crypto_secretbox_easy(reportJson, nonce, caseKey)
```
and sends `lookupId`, `envelope` and `report`.

- Handlers open `envelope` with `tenantSk` to get `caseKey`, then read `report`. The reporter reads the same `report` with `caseKey` from the code. So "sealed to the tenant" seals the case key, and the content is stored once. **(proposed)** Sealing the full report twice would store every attachment twice for no gain.
- Follow-up messages, in both directions: `0x01 || nonce(24) || crypto_secretbox_easy(messageJson, nonce, caseKey)`, with a fresh random nonce each time.
- **Message chain.** Decided 2026-10-27. The report is message 0. Every message's JSON, inside the encryption, carries:
  ```
  seq   = seq of prev + 1                                  // report: 0
  prev  = crypto_generichash(32, stored ciphertext of the previous message)   // report: absent
  role  = "reporter" | "handler"
  ```
  The server cannot change these fields. Clients check the chain and warn about gaps, reordering or inserted messages. `role` inside the encryption stops the server from relabeling who wrote a message.
  - Two messages written at the same time share the same `prev`. Both are shown, ordered by `seq` and time, without a warning. The next message chains to the newest one its writer saw.
  - Not detected: removal of the newest messages (no client keeps state between visits), and removal of one branch of such a fork.
  - Not proven: which person wrote a message. Everyone holding `caseKey` (the reporter and every handler) can write as any role. The API still records the authenticated handler. Signatures (`crypto_sign`) would add only that, so they are not used and not on the list in section 1.
- Tenant key rotation only re-seals `envelope` per case.

## 6. Files

Decided: files are encrypted in the browser.

- Each file gets its own random 32-byte `fileKey`. The file is encrypted with `crypto_secretstream_xchacha20poly1305` in 64 KiB chunks, the last chunk tagged `FINAL`, so truncation and reordering are detected. **(proposed)**
- File name, type, size, `fileKey` and the stream header go into the report or message JSON, so they are under `caseKey` too. The server sees only an opaque object and its size.
- Stored file object: `0x01 || chunk_1 || … || chunk_n`, each chunk being the `crypto_secretstream` output for up to 64 KiB of padded plaintext plus 17 bytes. An empty file is one empty `FINAL` chunk. The reader derives the chunk count from the true size and rejects anything else.
- **Padding.** Decided 2026-10-27. Before encryption the file is padded with zero bytes to the Padmé length, which leaks only O(log log L) bits of the size at a cost of at most 12%:
  ```
  E = floor(log2(L)), S = floor(log2(E)) + 1, mask = 2^(E - S) - 1
  padded(L) = (L + mask) & ~mask
  ```
  Files of 0 or 1 bytes are not padded (`log2` is undefined there). The true size is in the encrypted JSON; the reader cuts the padding off.
- **Limits.** Decided 2026-10-27: 25 MiB per file, 100 MiB per message (the report counts as one). Enforced in the browser before encryption and by the API on the padded size. Can be raised later.
- **Metadata.** Decided 2026-10-27. Not crypto, but it identifies reporters.
  - JPEG, PNG and WebP are re-encoded in the browser through a canvas, which drops EXIF including GPS.
  - Other files (PDF, Office, HEIC outside Safari) cannot be cleaned reliably in the browser. The reporter app warns that documents can contain the author's name and suggests a screenshot or printing to PDF.
  - The file name defaults to "Anhang 1", "Anhang 2", …; the reporter can rename it. The original name is not kept.

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
2. Final Argon2id parameters after measuring on low-end devices; they must stay at or above the client minimum in section 3.
