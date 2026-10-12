// One queue per database owner. Keep reads behind writes as well, so a request
// cannot expose in-memory changes until their transaction has committed.
export function createMutationQueue() {
  let tail = Promise.resolve();
  return {
    run(operation) {
      const result = tail.then(operation);
      tail = result.catch(() => {});
      return result;
    }
  };
}
