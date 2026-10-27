# Threat model

Status: draft, 2026-10-26. Based on the decisions in the private `whistledoor-app/docs/PLAN.md` (settled 2026-10-25). The crypto details (formats, parameters, key flows) belong in `docs/crypto-design.md`; this document only says what each actor can and cannot learn, and why.

## What we protect

1. **Report content**: text, attachments, and the follow-up messages between reporter and handlers.
2. **Reporter identity**: anything that links a report to a person, device or network address.
3. **Case code**: the secret a reporter uses to come back to a case. Whoever holds it can read and write the case as the reporter.
4. **Handler keys**: the private keys that let a tenant's case handlers decrypt reports.

Only the reporter and the tenant's case handlers should ever see 1. Nobody but the reporter should see 3. Nobody but the handler should see their own unlocked key.

## Design choices this model relies on

- **D1 Strict zero-knowledge.** The server only stores ciphertext. It never receives plaintext, case codes, passwords or private keys. No server-side virus scan, search or AI over content; no content in emails. Support sees metadata only.
- **D2 libsodium high-level calls only.** `crypto_box_seal` to encrypt for a public key, `crypto_secretbox` for symmetric encryption, `crypto_pwhash` (Argon2id) for passwords. No hand-built constructions.
- **D3 Case code.** 100 random bits, Base32, 20 characters in 5 groups. Generated in the reporter's browser, shown once, never sent to the server.
- **D4 Per-handler keys.** Each handler has their own key pair. The tenant key is wrapped separately for each handler, so only accounts that hold a wrapped copy can decrypt. When a handler is removed, the tenant key is rotated (offered by default, mandatory on conflict; `docs/crypto-design.md` section 4). That protects later reports; what the removed handler already saw cannot be taken back.
- **D5 Password split.** The handler's browser runs Argon2id on the password and derives two values: `authKey`, which goes to the server for login (and is hashed again there), and `kek`, which never leaves the browser and unwraps the handler's private key. The unlocked key lives in memory only and locks after 15 minutes idle. TOTP 2FA on top.
- **D6 No rescue.** If every key is lost, the reports are gone. Onboarding requires at least two handlers or a confirmed recovery key, so this does not happen by accident.
- **D7 Report domain.** `*.melden.whistledoor.at` serves the static reporter app: no cookies, no analytics, no third-party requests, strict CSP. DNS-only on Hetzner (no Cloudflare or other proxy), no IP logging, no billing or Stripe on this domain.
- **D8 EU hosting, no US-owned service on the report path.** Hetzner Cloud in Germany for servers, object storage and backups; an EU email provider that never sees report content.
- **D9 Open and reproducible reporter app.** `packages/crypto` and `apps/report` are public (Apache-2.0). Builds are reproducible and the hash of every released bundle is published.
- **D10 Device notice.** The report page and the QR poster tell reporters to use a private device on a private network.

## Actors

### 1. Curious employer

Management or anyone at the company who is not a designated case handler, including the company's IT department.

- **Can see:** that the company has a Whistledoor channel and its address; that cases exist and their status, if they have access to the handler app as a handler. Anything the reporter types into the report, if the employer is themselves a handler (that is the role, not a leak; HSchG requires handlers to be impartial and to keep the reporter's identity confidential).
- **Cannot see:** who the reporter is, unless the report content reveals it. There is no reporter account, no email, no IP address stored (D7). They cannot open a case without the case code (D3) or a handler's key (D4, D5).
- **Ensured by:** D1, D3, D4, D7. A non-handler with a company admin role gets no key material, because keys are wrapped per handler (D4), not per company.
- **Limits:** a company-managed device or network is outside our control; see actor 5. Writing style and details in the report itself can identify a reporter; the reporter app should say so, but we cannot prevent it.

### 2. Compromised server

An attacker with full access to the production VM, the database, object storage and backups.

- **Can see:** ciphertext of all reports, messages and attachments; metadata such as tenant, case timestamps, number and size of messages and attachments, handler accounts and emails, the server-side hash of each `authKey`, and each handler's wrapped private key and wrapped tenant key.
- **Cannot see:** report content, case codes, passwords, `kek`s or unlocked private keys (D1, D3, D5). Breaking a case code by guessing is not practical at 100 bits (D3).
- **Can try:**
  - *Offline password guessing.* With a handler's wrapped key and the Argon2id salt, the attacker can guess the handler's password offline at Argon2id cost. Strength depends on the password and on the Argon2id parameters (`docs/crypto-design.md` section 3: 3 passes, 64 MiB, with a client-side floor of 2 passes, 19 MiB).
  - *Serving modified code.* An attacker who controls the server can send reporters or handlers a changed app that leaks plaintext or keys. This is the largest remaining risk for any browser-based end-to-end system. For the reporter app, D9 makes a modified bundle detectable by anyone who compares hashes, but a single browser does not check this automatically. **Open:** whether and how to offer automatic checks (for example a verifier tool or browser extension).
  - *Withholding or reordering ciphertext.* Integrity of individual messages comes from libsodium's authenticated encryption (D2). A hash chain inside each message's encryption lets clients detect deleted, reordered, inserted or replayed messages (`docs/crypto-design.md` section 5). Removing the newest messages stays undetected, because no client keeps state between visits.
  - *Key substitution.* Handing a granting handler its own public key, or reporters a fake `tenantPk`. Grants require an out-of-band fingerprint check; the QR poster carries the tenant fingerprint, which the reporter app checks (`docs/crypto-design.md` section 4). Reporters who type the address by hand are not covered.
- **Ensured by:** D1, D2, D3, D5.

### 3. Curious operator

The person running Whistledoor (solo operator, admin host `admin.`, firewalled), including support.

- **Can see:** everything the compromised server sees, plus billing data in Stripe (tenant, not reporter, and never on the report domain).
- **Cannot see:** report content, case codes, passwords or keys, for the same reasons as actor 2 (D1, D5). Support tools show metadata only (D1). There is no master key and no recovery path the operator can use (D6); "forgot password" is handled by another handler re-granting access, or by the tenant's own recovery key.
- **Can try:** the same code-modification attack as actor 2, with the advantage of controlling the release process. D9 makes this public for the reporter app: the source and the published hash must match. **Open:** the handler app (`apps/app`) also decrypts, but it lives in the private repo and has no published reproducible build yet. It uses the published `packages/crypto`, but a modified handler app could still leak a handler's `kek`. Whether to publish or attest the handler bundle needs a decision.
- **Ensured by:** D1, D4, D6, D9.

### 4. Court order

An Austrian or German court or authority ordering Whistledoor or Hetzner to hand over data about a case or a reporter.

- **Can obtain:** what the server holds (actor 2's "can see" list): ciphertext, metadata, handler accounts. From the email provider, handler email addresses and send logs, but no report content (D1, D8). From Stripe, the tenant's billing records only.
- **Cannot obtain:** report content or reporter identity from us, because we do not have them. There are no IP logs for the report domain (D7) and no reporter accounts. We cannot hand over keys we never receive (D1, D5).
- **Ensured by:** D1, D5, D7, D8. Keeping every service on the report path EU-owned (D8) avoids non-EU disclosure regimes such as the US CLOUD Act.
- **Not covered:** an order to the tenant. The tenant's handlers can decrypt and may be legally required to disclose; that is a legal question under HSchG, not a technical one. An order compelling the operator to ship modified code is the same risk as actor 3's code-modification attack.

### 5. Network observer on the company LAN

The company's network team, a proxy, or anyone watching traffic on the company network or Wi-Fi.

- **Can see:** that a device contacted `<tenant>.melden.whistledoor.at` (from DNS queries and the TLS server name), when, for how long and roughly how much data moved. On a shared company network this can narrow down who reported, by time and device.
- **Cannot see:** report content or the case code, which are encrypted in the browser (D1, D3) and sent over TLS.
- **Breaks down if:** the device is company-managed. A company that installs its own root certificate can intercept TLS and read or change everything on the page, including the plaintext before encryption. Monitoring software, browser extensions or a keylogger on the device defeat any web-based protection.
- **Ensured by / mitigated by:** D1 and D3 for content. For identity, only D10: we tell reporters to use a private device on a private network (for example mobile data). The QR poster supports this by letting people open the page on their own phone. **Open:** whether a single shared report hostname (instead of one per tenant) is worth it; on the company's own network it hides little, since the tenant is already known.

## Out of scope

- A compromised reporter or handler device (malware, shoulder surfing, stolen unlocked laptop within the 15-minute window).
- Content that identifies the reporter by itself.
- Weaknesses in libsodium, the browser or TLS.
- Denial of service and availability.

## Open items

Summary of the points marked **open** above, to be settled in `docs/crypto-design.md` or the plan:

1. ~~Argon2id parameters for handler passwords and recovery keys.~~ Settled in `docs/crypto-design.md` section 3. Recovery keys need no Argon2id: they carry 160 random bits (section 4).
2. How a reporter's case code is turned into something the server can use to find the case, without the server learning the code.
3. ~~Detecting deleted, reordered or replayed messages within a case.~~ Settled in `docs/crypto-design.md` section 5, except removal of the newest messages.
4. Automatic verification of the published reporter bundle hash.
5. Published or attested builds for the handler app.
6. Per-tenant versus shared report hostname.
7. ~~Tenant key rotation when a handler is removed.~~ Settled in `docs/crypto-design.md` section 4.
