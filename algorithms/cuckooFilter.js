import { hashValue, toHashableString } from "./hashUtils.js";

function nextPowerOfTwo(value) {
  let power = 1;
  while (power < value) power *= 2;
  return power;
}

class CuckooFilter {
  constructor({
    capacity = 10000,
    bucketSize = 4,
    fingerprintBits = 8,
    maxKicks = 500,
  } = {}) {
    if (!Number.isInteger(capacity) || capacity <= 0) {
      throw new RangeError("capacity must be a positive integer.");
    }
    if (!Number.isInteger(bucketSize) || bucketSize <= 0) {
      throw new RangeError("bucketSize must be a positive integer.");
    }
    if (
      !Number.isInteger(fingerprintBits) ||
      fingerprintBits < 1 ||
      fingerprintBits > 32
    ) {
      throw new RangeError("fingerprintBits must be an integer from 1 to 32.");
    }
    if (!Number.isInteger(maxKicks) || maxKicks <= 0) {
      throw new RangeError("maxKicks must be a positive integer.");
    }

    this.bucketSize = bucketSize;
    this.fingerprintBits = fingerprintBits;
    this.maxKicks = maxKicks;
    this.bucketCount = nextPowerOfTwo(Math.ceil(capacity / bucketSize));
    this.capacity = this.bucketCount * bucketSize;
    this.fingerprintMask =
      fingerprintBits === 32 ? 0xffffffff : 2 ** fingerprintBits - 1;
    this.buckets = Array.from({ length: this.bucketCount }, () => []);
    this.size = 0;
  }

  getFingerprint(value) {
    const fingerprint = hashValue(value, 0x6a09e667) & this.fingerprintMask;
    return fingerprint || 1;
  }

  getIndexes(value, fingerprint) {
    const first = hashValue(value, 0xbb67ae85) & (this.bucketCount - 1);
    const fingerprintHash =
      hashValue(String(fingerprint), 0x3c6ef372) & (this.bucketCount - 1);
    return [first, first ^ fingerprintHash];
  }

  add(value) {
    const encoded = toHashableString(value);
    const fingerprint = this.getFingerprint(encoded);
    const [first, second] = this.getIndexes(encoded, fingerprint);

    for (const bucketIndex of first === second ? [first] : [first, second]) {
      const bucket = this.buckets[bucketIndex];
      if (bucket.length < this.bucketSize) {
        bucket.push(fingerprint);
        this.size++;
        return true;
      }
    }

    let bucketIndex = hashValue(encoded, 0xbb67ae85) & (this.bucketCount - 1);
    let currentFingerprint = fingerprint;
    const changes = [];

    for (let kick = 0; kick < this.maxKicks; kick++) {
      const bucket = this.buckets[bucketIndex];
      const slot = hashValue(`${kick}:${currentFingerprint}`, 0x510e527f) % bucket.length;
      const displaced = bucket[slot];
      changes.push([bucket, slot, displaced]);
      bucket[slot] = currentFingerprint;
      currentFingerprint = displaced;
      bucketIndex = this.alternateIndex(bucketIndex, currentFingerprint);

      const alternateBucket = this.buckets[bucketIndex];
      if (alternateBucket.length < this.bucketSize) {
        alternateBucket.push(currentFingerprint);
        this.size++;
        return true;
      }
    }

    for (let index = changes.length - 1; index >= 0; index--) {
      const [bucket, slot, previousFingerprint] = changes[index];
      bucket[slot] = previousFingerprint;
    }
    return false;
  }

  alternateIndex(bucketIndex, fingerprint) {
    const fingerprintHash =
      hashValue(String(fingerprint), 0x3c6ef372) & (this.bucketCount - 1);
    return bucketIndex ^ fingerprintHash;
  }

  contains(value) {
    const encoded = toHashableString(value);
    const fingerprint = this.getFingerprint(encoded);
    const [first, second] = this.getIndexes(encoded, fingerprint);
    return (
      this.buckets[first].includes(fingerprint) ||
      this.buckets[second].includes(fingerprint)
    );
  }

  has(value) {
    return this.contains(value);
  }

  remove(value) {
    const encoded = toHashableString(value);
    const fingerprint = this.getFingerprint(encoded);
    const [first, second] = this.getIndexes(encoded, fingerprint);

    for (const bucketIndex of first === second ? [first] : [first, second]) {
      const bucket = this.buckets[bucketIndex];
      const slot = bucket.indexOf(fingerprint);
      if (slot !== -1) {
        bucket.splice(slot, 1);
        this.size--;
        return true;
      }
    }
    return false;
  }

  delete(value) {
    return this.remove(value);
  }

  clear() {
    for (const bucket of this.buckets) bucket.length = 0;
    this.size = 0;
  }
}

export default CuckooFilter;