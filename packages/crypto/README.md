# @whistledoor/crypto

The encryption behind [Whistledoor](https://whistledoor.at), an end-to-end encrypted whistleblowing channel. Everything that sees a report in plaintext uses this package, in the reporter's and the handler's browser. The server only ever receives what these functions output.

It implements [`docs/crypto-design.md`](https://github.com/whistledoor/whistledoor-core/blob/main/docs/crypto-design.md) on top of `libsodium-wrappers-sumo`, using only the high-level calls listed in section 1 of that document. The threat model is in [`docs/threat-model.md`](https://github.com/whistledoor/whistledoor-core/blob/main/docs/threat-model.md).

| Module | Design doc | Functions |
| --- | --- | --- |
| Case code | §2 | `generateCaseCode`, `formatCaseCode`, `parseCaseCode`, `deriveCaseKeys` |
| Handler password | §3 | `generatePasswordSalt`, `derivePasswordKeys`, `encodeAuthKey` |
| Keys and grants | §4 | `generateKeyPair`, `wrapHandlerSecretKey`, `unwrapHandlerSecretKey`, `grantTenantKey`, `openTenantGrant`, `regrantTenantKey` |
| Recovery key | §4 | `generateRecoveryKey`, `formatRecoveryKey`, `parseRecoveryKey`, `deriveRecoveryKeyPair` |
| Report and messages | §5 | `sealReport`, `sealEnvelope`, `openEnvelope`, `encryptMessage`, `decryptMessage` |
| Message chain | §5 | `createChainLink`, `parseChainLink`, `checkChain`, `messageHash` |
| Files | §6 | `encryptFile`, `decryptFile`, `paddedLength` |

Every function has fixed test vectors, computed without libsodium by the scripts in [`vectors/`](https://github.com/whistledoor/whistledoor-core/tree/main/packages/crypto/vectors), and the tests run in Node and in Chromium.

## Verifying a release

Releases are published from GitHub Actions with [npm provenance](https://docs.npmjs.com/generating-provenance-statements), which links each version to the commit and workflow run that built it. To check the packages you installed:

```sh
npm audit signatures
```

The published package includes the TypeScript sources next to the build output, so what you install can be compared with this repository.

## License

[Apache-2.0](LICENSE)
