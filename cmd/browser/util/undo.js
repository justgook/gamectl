/*
 * Non-linear undo history, converted from the provided C++ UndoHistory.
 *
 * Command contract:
 *   const command = {
 *     undo() { ... },
 *     redo() { ... },
 *     dispose() { ... } // optional
 *   };
 *
 * Important: add(command) assumes the command has already been executed.
 * Use execute(command) if you want redo() to be called before adding it.
 */

class UndoState {
  constructor(command) {
    if (!command || typeof command.undo !== "function" || typeof command.redo !== "function") {
      throw new TypeError("UndoState command must provide undo() and redo() methods.");
    }

    this.prev = null;
    this.next = null;
    this.parent = null;
    this.command = command;
  }

  dispose() {
    if (this.command && typeof this.command.dispose === "function") {
      this.command.dispose();
    }

    this.prev = null;
    this.next = null;
    this.parent = null;
    this.command = null;
  }
}

export class UndoHistory {
  constructor(delegate = null) {
    this.delegate = delegate;
    this.first = null;
    this.last = null;
    this.current = null;
  }

  canUndo() {
    return this.current !== null;
  }

  canRedo() {
    return this.current !== this.last;
  }

  add(command) {
    const state = new UndoState(command);

    state.prev = this.last;
    state.parent = this.current;

    if (!this.first) {
      this.first = state;
    }

    if (this.last) {
      this.last.next = state;
    }

    this.last = state;
    this.current = state;

    return state;
  }

  execute(command) {
    command.redo();
    return this.add(command);
  }

  undo() {
    if (!this.current) return false;
    this.moveTo(this.current.parent);
    return true;
  }

  redo() {
    if (!this.canRedo()) return false;

    if (!this.current) {
      this.moveTo(this.first);
    } else {
      this.moveTo(this.current.next);
    }

    return true;
  }

  moveTo(newState) {
    if (newState === this.current) return;

    const common = this.findCommonParent(this.current, newState);

    while (this.current && this.current !== common) {
      this.current.command.undo();
      this.current = this.current.parent;
    }

    if (newState) {
      const redoStack = [];
      let p = newState;

      while (p !== common) {
        redoStack.push(p);
        p = p.parent;
      }

      while (redoStack.length > 0) {
        redoStack.pop().command.redo();
      }
    }

    this.current = newState;
  }

  findCommonParent(a, b) {
    if (!a || !b) return null;

    let pA = a;
    let pB = b;

    while (pA !== pB) {
      pA = pA.parent;

      if (!pA) {
        pA = a;
        pB = pB.parent;
        if (!pB) return null;
      }
    }

    return pA;
  }

  clearRedo() {
    let state = this.last;

    if (this.current) {
      this.current.next = null;
      this.last = this.current;
    } else {
      this.first = null;
      this.last = null;
    }

    while (state && state !== this.current) {
      const prev = state.prev;
      this.deleteState(state);
      state = prev;
    }
  }

  deleteFirstState() {
    if (!this.first) return false;
    if (this.current === this.first) return false;

    let i = this.last;

    while (i) {
      if (i.parent === this.first) {
        let j = this.first;

        while (j !== i) {
          if (this.current === j) return false;
          j = j.next;
        }

        j = this.first;

        while (j !== i) {
          const k = j;
          j = j.next;
          this.deleteState(k);
        }

        i.prev = null;
        i.parent = null;
        this.first = i;

        return true;
      }

      i = i.prev;
    }

    const state = this.first;

    this.first = null;
    this.last = null;
    this.current = null;

    this.deleteState(state);

    return true;
  }

  deleteState(state) {
    if (this.delegate && typeof this.delegate.onDeleteUndoState === "function") {
      this.delegate.onDeleteUndoState(state);
    }

    state.dispose();
  }

  dispose() {
    this.current = null;
    this.clearRedo();
    this.delegate = null;
  }

  toArray() {
    const result = [];

    for (let state = this.first; state; state = state.next) {
      result.push(state);
    }

    return result;
  }
}

