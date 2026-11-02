import test from "node:test";
import assert from "node:assert/strict";
import BloomFilter from "./bloomFilter.js";
import BinaryFuseFilter from "./binaryFuseFilter.js";
import CuckooFilter from "./cuckooFilter.js";
import XorFilter from "./xorFilter.js";

test("Bloom filter supports default and calculated sizing", () => {
  const filter = new BloomFilter();
  filter.add(" Alice@Example.com ");
  assert.equal(filter.contains("alice@example.com"), true);
  assert.equal(filter.contains("missing@example.com"), false);

  const configured = new BloomFilter({
    expectedItems: 100,
    falsePositiveRate: 0.01,
  });
  assert.ok(configured.size > 0);
  assert.ok(configured.numberOfHashFunctions > 0);

  filter.clear();
  assert.equal(filter.contains("alice@example.com"), false);
  assert.throws(() => new BloomFilter(0), RangeError);
});

test("Cuckoo filter supports insertion, deletion, and safe failed insertions", () => {
  const filter = new CuckooFilter({ capacity: 8 });
  assert.equal(filter.add("first"), true);
  assert.equal(filter.contains("first"), true);
  assert.equal(filter.remove("first"), true);
  assert.equal(filter.contains("first"), false);
  assert.equal(filter.delete("missing"), false);

  const full = new CuckooFilter({
    capacity: 1,
    bucketSize: 1,
    maxKicks: 5,
  });
  assert.equal(full.add("kept"), true);
  assert.equal(full.add("rejected"), false);
  assert.equal(full.contains("kept"), true);
  assert.equal(full.size, 1);
});

for (const [name, Filter] of [
  ["XOR", XorFilter],
  ["binary fuse", BinaryFuseFilter],
]) {
  test(`${name} filter builds and retains all inserted values`, () => {
    const values = Array.from({ length: 1000 }, (_, index) => `value-${index}`);
    const filter = new Filter(values, { fingerprintBits: 12 });
    for (const value of values) {
      assert.equal(filter.contains(value), true, `${value} should be present`);
    }

    const duplicateKeys = new Filter(["same", "same", "other"]);
    assert.equal(duplicateKeys.has("same"), true);
    assert.equal(duplicateKeys.has("other"), true);
    duplicateKeys.clear();
    assert.equal(duplicateKeys.contains("same"), false);
    assert.throws(() => new Filter([], { fingerprintBits: 0 }), RangeError);
  });
}
