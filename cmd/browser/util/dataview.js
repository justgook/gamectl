
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

  setUint16(n) {
    this.operations.push({ type: 'Uint16', value: n });
    return this;
  }

  setUint32(n) {
    this.operations.push({ type: 'Uint32', value: n });
    return this;
  }

  setInt16(n) {
    this.operations.push({ type: 'Int16', value: n });
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
        'Uint16': 2,
        'Uint32': 4,
        'Int16': 2,
        'Int32': 4,
        'Float32': 4
      })[op.type]
    }, 0)

    // Create buffer and DataView
    const buffer = new ArrayBuffer(totalSize);
    const view = new DataView(buffer);
    let offset = 0;

    // Apply all operations (little-endian for native x86/ARM compatibility)
    for (const op of this.operations) {
      switch (op.type) {
        case 'Uint8':
          view.setUint8(offset, op.value)
          offset += 1
          break
        case 'Uint16':
          view.setUint16(offset, op.value, true)
          offset += 2
          break
        case 'Uint32':
          view.setUint32(offset, op.value, true)
          offset += 4
          break
        case 'Int16':
          view.setInt16(offset, op.value, true)
          offset += 2
          break
        case 'Int32':
          view.setInt32(offset, op.value, true)
          offset += 4
          break
        case 'Float32':
          view.setFloat32(offset, op.value, true)
          offset += 4
          break
      }
    }

    return buffer
  }
}

