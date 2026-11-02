import { encodeValues, hashValue, toHashableString } from "./hashUtils.js";
import {
  buildXorTable,
  validateFingerprintBits,
  xorFingerprint,
} from "./xorFilterUtils.js";

function getPositions(value, seed, size) {
  const positions = [
    hashValue(value, seed ^ 0x243f6a88) % size,
    hashValue(value, seed ^ 0x85a308d3) % size,
    hashValue(value, seed ^ 0x13198a2e) % size,
  ];

  for (let index = 1; index < positions.length; index++) {
    while (positions.slice(0, index).includes(positions[index])) {
      positions[index] = (positions[index] + 1) % size;
    }
  }
  return positions;
}

class XorFilter {
  constructor(values = [], options = {}) {
    this.fingerprintBits = options.fingerprintBits ?? 8;
    validateFingerprintBits(this.fingerprintBits);
    this.seed = 0;
    this.fingerprints = new Uint32Array(0);
    this.build(values);
  }

  build(values) {
    const keys = encodeValues(values);
    if (keys.length === 0) {
      this.seed = 0;
      this.fingerprints = new Uint32Array(0);
      return this;
    }

    const size = Math.max(4, Math.ceil(keys.length * 1.3));
    const built = buildXorTable(
      keys,
      size,
      getPositions,
      this.fingerprintBits,
    );
    this.seed = built.seed;
    this.fingerprints = built.fingerprints;
    return this;
  }

  contains(value) {
    return xorFingerprint(
      this.fingerprints,
      toHashableString(value),
      this.seed,
      getPositions,
      this.fingerprints.length,
      this.fingerprintBits,
    );
  }

  has(value) {
    return this.contains(value);
  }

  clear() {
    this.seed = 0;
    this.fingerprints = new Uint32Array(0);
  }
}

export default XorFilter;