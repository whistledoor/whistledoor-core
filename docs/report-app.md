# Reporter app

Status: decided 2026-11-01. Scope and rules for `apps/report`, the page reporters use. The crypto is in [crypto-design.md](crypto-design.md), the reasoning in [threat-model.md](threat-model.md). This document covers what the app does and how it is built.

## Rules

- Static single-page app: no third-party requests, no cookies, no analytics, strict CSP, reproducible build.
- One bundle for all tenants. Everything tenant-specific comes from the API at runtime, so every tenant runs the same files.
- The case code and `caseKey` live in memory only. A reload starts over, on purpose. Language is the only thing stored (`localStorage`).

## Stack

React, Vite, TanStack Router, Query and Form, as for the other apps. UI components are shadcn/ui on Tailwind: the code lives in this repo under `src/components/ui`, the CSS is built into one static file, and colours are CSS variables, which is what whitelabel changes. Native `<select>` instead of Radix Select, which injects a `<style>` tag the CSP blocks. System fonts only.

- Routing uses memory history, so the URL stays `/` and a reload returns to the start. `#fp=<fingerprint>` belongs to the poster check and is read once on load.
- libsodium runs as WebAssembly, which needs `'wasm-unsafe-eval'` in `script-src`.

Headers set by the host:

```
Content-Security-Policy: default-src 'none'; script-src 'self' 'wasm-unsafe-eval'; style-src 'self';
  img-src 'self' blob:; connect-src 'self'; base-uri 'none'; form-action 'none'; frame-ancestors 'none'
Referrer-Policy: no-referrer
```

`frame-ancestors` only works as a header, not in a `<meta>` tag.

### Hosting

The image (`apps/report/Dockerfile`) is Caddy serving `dist` on port 80. On top of the headers above it sends `X-Content-Type-Options: nosniff`. TLS and `/api` belong to the private deployment, whose proxy sees reporter addresses and needs the same no-log rule (D7).

## Languages

German and English in one bundle. The tenant sets the default, the browser language applies if the tenant has none, and the reporter can switch.

## Screens

Approved wireframes come before UI code, for every app.

1. **Start:** tenant name, what the channel is for, device notice (D10), who reads reports, the external reporting office (BAK), fingerprint check.
2. **Kind:** anonymous or confidential, with optional name and phone.
3. **Content:** category, description, attachments. Warning that details can identify the reporter.
4. **Show case code:** copy, `.txt`, print. Shown once.
5. **Confirm last group:** on a mismatch nothing is sent. The code is confirmed before sending, so no one ends up with a sent report and a lost code.
6. **Sent:** what happens next and by when.
7. **Return with code:** the check character catches typos in the browser.
8. **Case:** status, messages, reply, chain warnings, meeting request.

Error states: outdated poster (fingerprint mismatch, submit blocked), API unreachable (text stays in the form), unknown address.

## Report content

Inside the encrypted report JSON, so the server sees none of it:

- **Anonymous by default.** Confidential adds optional name and phone. There is no reporter email and no notification; reporters come back with their code.
- **Category:** required, from a fixed list of about 8, "Sonstiges" included. Editing per tenant comes later.
- **Text and attachments.** Limits and metadata handling are in `crypto-design.md` section 6.

## Whitelabel

Logo, one primary colour, company name, and a short intro text in each language, all loaded from the API. The app adjusts the colour if contrast is too low. No custom CSS, custom fonts or custom domains: CSS could hide the security notices, fonts would be third-party requests, and a customer-controlled domain could be pointed elsewhere. A small "Bereitgestellt von Whistledoor" line stays.

## Meeting request

Reporters can ask for a meeting (HSchG § 13(5), within 14 calendar days). The request is a normal encrypted message plus a plaintext flag, so the server can track the deadline without reading content. The button says that meeting in person gives up anonymity.

## API

Same origin, `https://<tenant>.melden.whistledoor.at/api/*`, under the no-log rule (D7). The tenant comes from the hostname on the server; the app never parses it. The contract is public, in `packages/api-contract` (oRPC and zod), and the private API implements it.

| Call | Sends | Returns |
| --- | --- | --- |
| Tenant info | nothing | name, `tenantPk`, branding, handler names, default language, whether the channel is active |
| Submit report | `lookupId`, `envelope`, `report` | timestamp |
| Open case | `lookupId` | status, report, messages |
| Post message | `lookupId`, ciphertext, meeting flag | message id |
| Upload / download file | `lookupId`, ciphertext stream | object id / ciphertext stream |

Files go through the API, not to object storage directly, so no second origin appears in the CSP and no storage logs see reporter addresses.

When the channel is inactive, the report page stops taking new reports and points to BAK. Existing reporters can still open their case.

## Releases

CI builds twice in a clean environment and fails if the output differs. Each GitHub Release publishes one SHA-256 of the bundle. The host serves exactly that release, from a prebuilt image; nothing is rebuilt on the server. GHCR (`ghcr.io/whistledoor/report`) holds the image at build time only and reporters never contact it (D8). The app itself does not show the hash: a page cannot vouch for itself, and reporters do not check. This is for auditors and customers who ask.

## Stages

1. **Tracer bullet:** all screens without attachments, DE and EN, fake in-memory API, then the real API (`whistledoor-app#5`).
2. **First paying customer:** attachments, whitelabel, fingerprint check.
3. **After launch:** iframe embed, tenant-edited categories, more languages.

### Iframe (stage 3)

Optional and per tenant. Embedding removes the address bar, so reporters cannot see they are on our domain, and a script on the customer's page could swap in a fake form. So:

- `frame-ancestors` lists the tenant's exact hostnames, maintained by the customer, no wildcards.
- A link to open the page in its own window is always visible when framed.
- Height is sent to the parent with `postMessage`: the height and nothing else.
