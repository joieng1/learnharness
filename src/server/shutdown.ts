/** End long-lived responses while Next drains requests and owns process exit. */
const SHUTDOWN_KEY = Symbol.for("lh.serverShutdown");
const SHUTDOWN_SIGNALS = ["SIGTERM", "SIGINT"] as const;

interface ShutdownState {
	installed: boolean;
	shuttingDown: boolean;
	listeners: Set<() => void>;
}

function shutdownState(): ShutdownState {
	// Instrumentation and route bundles must notify the same connections.
	const shared = globalThis as typeof globalThis & { [SHUTDOWN_KEY]?: ShutdownState };
	return shared[SHUTDOWN_KEY] ??= {
		installed: false,
		shuttingDown: false,
		listeners: new Set(),
	};
}

function notifyListener(listener: () => void): void {
	try { listener(); }
	catch (error) { console.error("[shutdown] Listener failed:", error); }
}

/** Subscribe until cancellation; late subscribers are notified immediately. */
export function onServerShutdown(listener: () => void): () => void {
	const state = shutdownState();
	if (state.shuttingDown) {
		notifyListener(listener);
		return () => {};
	}
	state.listeners.add(listener);
	return () => { state.listeners.delete(listener); };
}

/** Notify once, synchronously. Tests may trigger shutdown without OS signals. */
export function triggerServerShutdown(): void {
	const state = shutdownState();
	if (state.shuttingDown) return;
	state.shuttingDown = true;
	const listeners = [...state.listeners];
	state.listeners.clear();
	for (const listener of listeners) notifyListener(listener);
}

/** Next registers its signal handlers only when the application has not
 * claimed them; this mirrors start-server.js's own check. */
function nextHandlesSignals(): boolean {
	return !process.env.NEXT_MANUAL_SIG_HANDLE;
}

/** Install alongside Next's handlers, never replacing its cleanup or exit.
 * Any signal listener disables Node's default exit, so without Next's
 * handlers a listener here would leave SIGTERM unable to stop the process. */
export function installShutdownSignal(): void {
	if (!nextHandlesSignals()) return;
	const state = shutdownState();
	if (state.installed) return;
	state.installed = true;
	for (const signal of SHUTDOWN_SIGNALS) process.on(signal, triggerServerShutdown);
}
