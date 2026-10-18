export function createRequestCoordinator() {
  let sequence = 0;
  let activeController = null;

  function cancel() {
    sequence += 1;
    activeController?.abort();
    activeController = null;
  }

  async function run(task, handlers = {}) {
    activeController?.abort();
    const controller = new AbortController();
    activeController = controller;
    const token = ++sequence;
    try {
      const value = await task(controller.signal, token);
      if (token !== sequence || controller.signal.aborted) return undefined;
      handlers.onSuccess?.(value, token);
      return value;
    } catch (error) {
      if (token !== sequence || controller.signal.aborted || error?.name === 'AbortError' || error?.code === 'cancelled') return undefined;
      handlers.onError?.(error, token);
      throw error;
    } finally {
      if (token === sequence) activeController = null;
    }
  }

  return {
    run,
    cancel,
    isCurrent: (token) => token === sequence,
  };
}
