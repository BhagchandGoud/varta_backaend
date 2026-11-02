import { hashValue } from "./hashUtils.js";

const MAX_BUILD_ATTEMPTS = 100;

export function validateFingerprintBits(fingerprintBits) {
  if (
    !Number.isInteger(fingerprintBits) ||
    fingerprintBits < 1 ||
    fingerprintBits > 32
  ) {
    throw new RangeError("fingerprintBits must be an integer from 1 to 32.");
  }
}

export function buildXorTable(keys, arraySize, getPositions, fingerprintBits) {
  validateFingerprintBits(fingerprintBits);
  if (keys.length === 0) return { seed: 0, fingerprints: new Uint32Array(0) };

  const fingerprintMask =
    fingerprintBits === 32 ? 0xffffffff : 2 ** fingerprintBits - 1;

  for (let attempt = 0; attempt < MAX_BUILD_ATTEMPTS; attempt++) {
    const seed = Math.imul(attempt + 1, 0x9e3779b1) >>> 0;
    const positionsByKey = keys.map((key) =>
      getPositions(key, seed, arraySize),
    );
    const degrees = new Uint32Array(arraySize);
    const xorEdges = new Uint32Array(arraySize);

    for (let edge = 0; edge < positionsByKey.length; edge++) {
      for (const position of positionsByKey[edge]) {
        degrees[position]++;
        xorEdges[position] ^= edge;
      }
    }

    const queue = [];
    for (let position = 0; position < arraySize; position++) {
      if (degrees[position] === 1) queue.push(position);
    }

    const peeled = [];
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const position = queue[cursor];
      if (degrees[position] !== 1) continue;

      const edge = xorEdges[position];
      peeled.push([edge, position]);
      for (const edgePosition of positionsByKey[edge]) {
        if (degrees[edgePosition] === 0) continue;
        degrees[edgePosition]--;
        xorEdges[edgePosition] ^= edge;
        if (degrees[edgePosition] === 1) queue.push(edgePosition);
      }
    }

    if (peeled.length !== keys.length) continue;

    const fingerprints = new Uint32Array(arraySize);
    for (let index = peeled.length - 1; index >= 0; index--) {
      const [edge, position] = peeled[index];
      let fingerprint = hashValue(keys[edge], seed) & fingerprintMask;
      for (const edgePosition of positionsByKey[edge]) {
        if (edgePosition !== position) fingerprint ^= fingerprints[edgePosition];
      }
      fingerprints[position] = fingerprint >>> 0;
    }

    return { seed, fingerprints };
  }

  throw new Error(
    "Unable to build a peelable XOR filter after 100 attempts.",
  );
}

export function xorFingerprint(
  fingerprints,
  value,
  seed,
  getPositions,
  arraySize,
  bits,
) {
  if (arraySize === 0) return false;

  let fingerprint = hashValue(value, seed);
  if (bits < 32) fingerprint &= 2 ** bits - 1;

  let actual = 0;
  for (const position of getPositions(value, seed, arraySize)) {
    actual ^= fingerprints[position];
  }
  return actual === fingerprint;
}
