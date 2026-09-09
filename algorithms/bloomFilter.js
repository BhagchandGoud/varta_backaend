class BloomFilter {
  constructor(size = 100000) {
    this.size = size;
    this.bits = new Array(size).fill(0); // declare a array size =100000
    this.numberOfHashFunctions = 5;
  }

  hash1(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 31 + str.charCodeAt(i)) % this.size;
    }
    return hash;
  }

  hash2(str) {
    let hash = 7;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 35 + str.charCodeAt(i)) % this.size;
    }
    return hash;
  }

  hash3(str) {
    let hash = 11;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 41 + str.charCodeAt(i)) % this.size;
    }
    return hash;
  }

  hash4(str) {
    let hash = 15;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 51 + str.charCodeAt(i)) % this.size;
    }
    return hash;
  }

  hash5(str) {
    let hash = 19;
    for (let i = 0; i < str.length; i++) {
      hash = (hash * 57 + str.charCodeAt(i)) % this.size;
    }
    return hash;
  }



  getAllHash(value) {
    value = value.trim().toLowerCase();
    return [
      this.hash1(value),
      this.hash2(value),
      this.hash3(value),
      this.hash4(value),
      this.hash5(value),
    ];
  }

  add(value){
    const indexes = this.getAllHash(value);

    for (const index of indexes) {
      this.bits[index] = 1;
    }
  }

  contains(value) {
    const indexes = this.getAllHash(value);

    for (const index of indexes) {
      if (this.bits[index] === 0) {
        return false;
      }
    }
    return true;
  }
  clear() {
    this.bits.fill(0);
  }
}

export default BloomFilter;
