export function toHashableString(value) {
  if (value === null) return "null:";

  switch (typeof value) {
    case "string":
      return `string:${value}`;
    case "number":
      return `number:${value}`;
    case "boolean":
      return `boolean:${value}`;
    case "bigint":
      return `bigint:${value}`;
    case "undefined":
    case "function":
    case "symbol":
      throw new TypeError("Filter values must be serializable.");
    default: {
      const serialized = JSON.stringify(value);
      if (serialized === undefined) {
        throw new TypeError("Filter values must be serializable.");
      }
      return `object:${serialized}`;
    }
  }
}

export function hashValue(value, seed = 0x811c9dc5) {
  const input = typeof value === "string" ? value : toHashableString(value);
  let hash = (0x811c9dc5 ^ seed) >>> 0;

  for (let index = 0; index < input.length; index++) {
    hash ^= input.charCodeAt(index);
    hash = Math.imul(hash, 0x01000193);
  }

  hash ^= hash >>> 16;
  hash = Math.imul(hash, 0x85ebca6b);
  hash ^= hash >>> 13;
  hash = Math.imul(hash, 0xc2b2ae35);
  hash ^= hash >>> 16;
  return hash >>> 0;
}

export function encodeValues(values) {
  if (typeof values === "string") {
    return [toHashableString(values)];
  }
  if (values == null || typeof values[Symbol.iterator] !== "function") {
    throw new TypeError("Filter values must be provided as an iterable.");
  }

  return [...new Set(Array.from(values, toHashableString))];
}
