class List {
  constructor(data) {
    this.data = data;
    this.next = null;
  }
}

class Queue {
  constructor() {
    this.front = null;
    this.rear = null;
    this.size = 0;
  }

  enqueue(message) {
    const node = new List(message);

    if (this.isEmpty()) {
      this.front = node;
      this.rear = node;
    } else {
      this.rear.next = node;
      this.rear = node;
    }

    this.size++;
  }

  dequeue() {
    if (this.isEmpty()) {
      return null;
    }

    const removed = this.front.data;

    this.front = this.front.next;
    this.size--;

    if (this.front === null) {
      this.rear = null;
    }

    return removed;
  }

  peek() {
    return this.isEmpty() ? null : this.front.data;
  }

  isEmpty() {
    return this.front === null;
  }

  getSize() {
    return this.size;
  }

  clear() {
    this.front = null;
    this.rear = null;
    this.size = 0;
  }
}

export default  Queue;