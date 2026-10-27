import sodium from 'libsodium-wrappers-sumo';

/**
 * Returns the initialised libsodium instance. Every crypto function in this
 * package goes through here so the WebAssembly module is loaded exactly once.
 */
export async function getSodium(): Promise<typeof sodium> {
  await sodium.ready;
  return sodium;
}
