# whistledoor-core

Public, Apache-2.0. Holds only code that sees plaintext: `packages/crypto` and `apps/report`. The private product lives in `whistledoor/whistledoor-app`; decisions are in its `docs/PLAN.md`.

Rules:

- Strict zero-knowledge. The server never receives plaintext, case codes, passwords or private keys.
- Crypto uses high-level libsodium calls only (`crypto_box_seal`, `crypto_secretbox`, `crypto_pwhash`). No hand-built constructions. Every function has fixed test vectors that run in Node and the browser.
- No crypto code before `docs/threat-model.md` and `docs/crypto-design.md` exist; the code must match the design doc.
- `apps/report` is a static SPA: no third-party requests, no cookies, no analytics, strict CSP, reproducible build.
