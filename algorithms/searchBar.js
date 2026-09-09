import UserModel from "../models/UserModel.js";

class TrieNode {
  constructor() {
    this.userId = null;
    this.childrens = {};
    this.endOfWord = false;
  }
}

class Trie {
  constructor() {
    this.root = new TrieNode();
  }

  insert(word, userId) {
    let curr = this.root;
    for (let ch of word.toLowerCase()) {
      if (!curr.childrens[ch]) {
        curr.childrens[ch] = new TrieNode();
      }

      curr = curr.childrens[ch];
    }
    curr.endOfWord = true;
    if (!curr.userIds) curr.userIds = [];
    if (!curr.userIds.includes(userId)) curr.userIds.push(userId);
  }

  collect(node, result) {
    if (node.endOfWord && node.userIds) {
      result.push(...node.userIds);
    }

    for (let ch in node.childrens) {
      this.collect(node.childrens[ch], result);
    }
  }

  search(key) {
    let curr = this.root;

    for (let ch of key.toLowerCase()) {
      if (!curr.childrens[ch]) {
        return [];
      }
      curr = curr.childrens[ch];
    }
    let result = [];

    this.collect(curr, result);
    return result;
  }

  async buildFromUsers() {
    const users = await UserModel.find().select("username _id");
    for (const user of users) {
      this.insert(user.username, user?._id.toString());
    }
  }
}

export default Trie;
