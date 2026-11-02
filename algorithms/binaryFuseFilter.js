import { encodeValues, hashValue, toHashableString } from "./hashUtils.js";
import {
  buildXorTable,
  validateFingerprintBits,
  xorFingerprint,
} from "./xorFilterUtils.js";

function segmentLengthFor(size) {
  return Math.max(2, Math.ceil(size * 0.5));
}

function createPositions(segmentLength) {
  return (value, seed) => {
    const positions = [
      hashValue(value, seed ^ 0xa4093822) % segmentLength,
      segmentLength +
        (hashValue(value, seed ^ 0x299f31d0) % segmentLength),
      2 * segmentLength +
        (hashValue(value, seed ^ 0x082efa98) % segmentLength),
    ];

    return positions;
  };
}

class BinaryFuseFilter {
  constructor(values = [], options = {}) {
    this.fingerprintBits = options.fingerprintBits ?? 8;
    validateFingerprintBits(this.fingerprintBits);
    this.seed = 0;
    this.segmentLength = 0;
    this.segmentCount = 0;
    this.fingerprints = new Uint32Array(0);
    this.build(values);
  }

  build(values) {
    const keys = encodeValues(values);
    if (keys.length === 0) {
      this.clear();
      return this;
    }

    const segmentLength = segmentLengthFor(keys.length);
    const segmentCount = 3;
    const arraySize = segmentLength * segmentCount;
    const getPositions = createPositions(segmentLength);
    const built = buildXorTable(
      keys,
      arraySize,
      getPositions,
      this.fingerprintBits,
    );

    this.seed = built.seed;
    this.segmentLength = segmentLength;
    this.segmentCount = segmentCount;
    this.fingerprints = built.fingerprints;
    return this;
  }

  contains(value) {
    if (this.fingerprints.length === 0) return false;
    const getPositions = createPositions(this.segmentLength);
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
    this.segmentLength = 0;
    this.segmentCount = 0;
    this.fingerprints = new Uint32Array(0);
  }
}

export default BinaryFuseFilter;