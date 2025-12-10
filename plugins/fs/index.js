import { FsaNodeFs, FsaNodeSyncAdapterWorker, } from 'memfs/lib/fsa-to-node'



const demo = async (dir) => {
  // new URL("worker.js", import.meta.url)
  const adapter = await FsaNodeSyncAdapterWorker.start('/vendor/fs/worker.js', dir);
  const fs = new FsaNodeFs(dir, adapter);
  // const fd = fs.openSync('/new-file.txt', 'w');
  fs.writeFileSync('/cool.txt', 'worlds');
  console.log("IT WORKS!!")
  // fs.closeSync(fd)
}

const main = async () => {
  // const button = document.createElement('button');
  // button.textContent = 'Select an empty folder';
  // document.body.appendChild(button);
  // button.onclick = async () => {
  //   const dir = await (window).showDirectoryPicker({ id: 'demo', mode: 'readwrite' });
  //   await demo(dir);
  // };
  //
  // const button2 = document.createElement('button');
  // button2.textContent = 'Run tests in OPFS';
  // button2.style.marginLeft = '1em';
  // document.body.appendChild(button2);
  // button2.onclick = async () => {
  const dir = await navigator.storage.getDirectory();
  await demo(dir);
  console.log("dir dir dir")
  // };
};

main();

class Delme {
  constructor() {
    console.log("DO IT WORKS???")
  }
}

// Export for both browser and module environments
if (typeof module !== 'undefined' && module.exports) {
  module.exports = { Delme };
} else if (typeof window !== 'undefined') {
  window.Delme = Delme;
}
