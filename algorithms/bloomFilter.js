import { hashValue } from "./hashUtils.js";

function getConfiguration(options) {
  if (typeof options === "number") {
    return { size: options, numberOfHashFunctions: 5 };
  }

  if (!options || typeof options !== "object") {
    throw new TypeError("Bloom filter options must be a size or options object.");
  }

  const {
    size,
    expectedItems,
    falsePositiveRate = 0.01,
    numberOfHashFunctions,
  } = options;

  if (expectedItems !== undefined) {
    if (!Number.isInteger(expectedItems) || expectedItems <= 0) {
      throw new RangeError("expectedItems must be a positive integer.");
    }
    if (
      typeof falsePositiveRate !== "number" ||
      falsePositiveRate <= 0 ||
      falsePositiveRate >= 1
    ) {
      throw new RangeError("falsePositiveRate must be between 0 and 1.");
    }
    const calculatedSize = Math.ceil(
      (-expectedItems * Math.log(falsePositiveRate)) / Math.LN2 ** 2,
    );
    return {
      size: Math.max(1, calculatedSize),
      numberOfHashFunctions:
        numberOfHashFunctions ??
        Math.max(
          1,
          Math.round((calculatedSize / expectedItems) * Math.LN2),
        ),
    };
  }

  return { size: size ?? 100000, numberOfHashFunctions: numberOfHashFunctions ?? 5 };
}

class BloomFilter {
  constructor(options = 100000) {
    const config = getConfiguration(options);
    if (!Number.isSafeInteger(config.size) || config.size <= 0) {
      throw new RangeError("Bloom filter size must be a positive safe integer.");
    }
    if (
      !Number.isInteger(config.numberOfHashFunctions) ||
      config.numberOfHashFunctions <= 0
    ) {
      throw new RangeError("numberOfHashFunctions must be a positive integer.");
    }

    this.size = config.size;
    this.numberOfHashFunctions = config.numberOfHashFunctions;
    this.bits = new Uint8Array(this.size);
  }

  getAllHash(value) {
    const normalized = String(value).trim().toLowerCase();
    const firstHash = hashValue(normalized, 0x9e3779b9);
    const secondHash = hashValue(normalized, 0x85ebca6b) | 1;
    return Array.from(
      { length: this.numberOfHashFunctions },
      (_, index) =>
        (firstHash + index * secondHash) % this.size,
    );
  }

  hash1(value) {
    return this.getAllHash(value)[0];
  }

  hash2(value) {
    return this.getAllHash(value)[1] ?? this.hash1(value);
  }

  hash3(value) {
    return this.getAllHash(value)[2] ?? this.hash1(value);
  }

  hash4(value) {
    return this.getAllHash(value)[3] ?? this.hash1(value);
  }

  hash5(value) {
    return this.getAllHash(value)[4] ?? this.hash1(value);
  }

  add(value) {
    for (const index of this.getAllHash(value)) {
      this.bits[index] = 1;
    }
    return this;
  }

  contains(value) {
    return this.getAllHash(value).every((index) => this.bits[index] === 1);
  }

  clear() {
    this.bits.fill(0);
  }
}

export default BloomFilter;
