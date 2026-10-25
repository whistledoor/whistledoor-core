# whistledoor-core

The open-source part of [Whistledoor](https://whistledoor.at), an end-to-end encrypted whistleblowing channel for Austrian companies under the HinweisgeberInnenschutzgesetz (HSchG).

Everything that touches a report in plaintext lives here, so anyone can check that the server never can:

- `packages/crypto`: key derivation, case codes, sealing and per-handler key wrapping, built on libsodium.
- `apps/report`: the static reporter app served on `*.melden.whistledoor.at`. Builds are reproducible, and the hash of every released bundle is published.

Status: design phase. The threat model and crypto design doc come first, in `docs/`.

## Security

Please report vulnerabilities privately through GitHub's "Report a vulnerability" button on this repository. See [SECURITY.md](SECURITY.md).

## License

[Apache-2.0](LICENSE)
