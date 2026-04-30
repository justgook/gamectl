/*
===========================================================
NON-LINEAR UNDO HISTORY USAGE GUIDE
===========================================================

Core idea:
- Each command represents one reversible action.
- Each command must implement:
    redo() -> apply action
    undo() -> revert action
- History supports:
    execute(command) -> apply + store
    undo()           -> go backward
    redo()           -> go forward
- If you undo and then add a new command,
  history branches instead of deleting old future states.

===========================================================
1. SIMPLE TEXT EDITOR EXAMPLE
===========================================================
*/

let text = "";

class InsertTextCommand {
  constructor(value) {
    this.value = value;
    this.prev = "";
  }

  redo() {
    this.prev = text;
    text += this.value;
  }

  undo() {
    text = this.prev;
  }
}

/*
===========================================================
2. CREATE HISTORY
===========================================================
*/

const history = new UndoHistory();

/*
===========================================================
3. EXECUTE COMMANDS
===========================================================
*/

history.execute(new InsertTextCommand("Hello"));
console.log(text); // "Hello"

history.execute(new InsertTextCommand(" World"));
console.log(text); // "Hello World"

history.execute(new InsertTextCommand("!"));
console.log(text); // "Hello World!"

/*
History chain:
Hello -> Hello World -> Hello World!
Current = last state
*/

/*
===========================================================
4. UNDO
===========================================================
*/

history.undo();
console.log(text); // "Hello World"

history.undo();
console.log(text); // "Hello"

/*
===========================================================
5. REDO
===========================================================
*/

history.redo();
console.log(text); // "Hello World"

/*
===========================================================
6. BRANCHING (NON-LINEAR HISTORY)
===========================================================
*/

history.undo();
console.log(text); // "Hello"

history.execute(new InsertTextCommand(" JS"));
console.log(text); // "Hello JS"

/*
Now history branches:

Original branch:
Hello -> Hello World -> Hello World!

New branch:
Hello -> Hello JS

Current state = Hello JS
Old future still exists in history
*/

/*
===========================================================
7. MOVE BETWEEN BRANCHES
===========================================================
*/

const allStates = history.toArray();

/*
You can manually jump to any stored state:
*/
history.moveTo(allStates[2]); // move to "Hello World!"
console.log(text); // "Hello World!"

history.moveTo(allStates[3]); // move to "Hello JS"
console.log(text); // "Hello JS"

/*
The system automatically:
- undoes back to common ancestor
- redoes down target branch
*/

/*
===========================================================
8. OPTIONAL CLEANUP
===========================================================
*/

history.clearRedo();

/*
Deletes all future states after current state.
Useful when you want traditional linear undo behavior.
*/

/*
===========================================================
9. OPTIONAL DELEGATE
===========================================================
*/

const historyWithDelegate = new UndoHistory({
  onDeleteUndoState(state) {
    console.log("Deleted state:", state);
  }
});

/*
Useful for:
- freeing resources
- removing snapshots
- logging
*/

/*
===========================================================
10. BEST PRACTICES
===========================================================

✔ Use execute(command) for normal actions
✔ Use add(command) only if command already ran
✔ Each command should fully store enough state to undo itself
✔ Keep commands small and isolated
✔ Use moveTo(state) for history tree navigation
✔ Use clearRedo() if you want linear mode
✔ Use dispose() when done

===========================================================
11. COMMON PATTERNS
===========================================================

Text:
- insert
- delete
- replace

Drawing:
- add shape
- move shape
- delete layer

Game editors:
- place tile
- remove object
- property change

State editors:
- property mutation
- list reorder
- scene graph edits

===========================================================
12. FULL MINI EXAMPLE
===========================================================
*/

let counter = 0;

class AddCommand {
  constructor(amount) {
    this.amount = amount;
  }

  redo() {
    counter += this.amount;
  }

  undo() {
    counter -= this.amount;
  }
}

const h = new UndoHistory();

h.execute(new AddCommand(5));
console.log(counter); // 5

h.execute(new AddCommand(10));
console.log(counter); // 15

h.undo();
console.log(counter); // 5

h.execute(new AddCommand(3));
console.log(counter); // 8

/*
Branches:
0 -> 5 -> 15
     \
      -> 8
*/

/*
===========================================================
SUMMARY
===========================================================

UndoHistory gives you:
- Standard undo/redo
- Branching timelines
- Arbitrary state jumping
- Reusable command architecture
- Browser-friendly pure JS

Perfect for:
- editors
- games
- drawing tools
- workflow tools
- state machines
===========================================================
*/
