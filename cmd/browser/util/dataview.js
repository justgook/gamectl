
export function bytes() {
  return new MyDataView
}

class MyDataView {
  constructor() {
    this.operations = [];
  }

  setUint8(n) {
    this.operations.push({ type: 'Uint8', value: n });
    return this;
  }

  setInt32(n) {
    this.operations.push({ type: 'Int32', value: n });
    return this;
  }

  setFloat32(n) {
    this.operations.push({ type: 'Float32', value: n });
    return this;
  }

  commit() {
    // Calculate total buffer size needed
    const totalSize = this.operations.reduce((acc, op) => {
      return acc + ({
        'Uint8': 1,
        'Int32': 4,
        'Float32': 4
      })[op.type]
    }, 0)

    // Create buffer and DataView
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Apply all operations
    for (const op of this.operations) {
      switch (op.type) {
        case 'Uint8':
          view.setUint8(offset, op.value)
          offset += 1
          break
        case 'Int32':
          view.setInt32(offset, op.value, false)
          offset += 4
          break
        case 'Float32':
          view.setFloat32(offset, op.value, false)
          offset += 4
          break
      }
    }

    return buffer
  }
}

