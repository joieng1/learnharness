import assert from "node:assert/strict";
import { afterEach, beforeEach, describe, it } from "node:test";
import { emit } from "../src/core/events.ts";
import { eventsResponse } from "../src/server/events-stream.ts";
import { installShutdownSignal, onServerShutdown, triggerServerShutdown } from "../src/server/shutdown.ts";

const SHUTDOWN_KEY = Symbol.for("lh.serverShutdown");
const TEST_TIMEOUT_MS = 1_000;
const SHUTDOWN_SIGNALS = ["SIGTERM", "SIGINT"] as const;

interface TestShutdownGlobal {
	[SHUTDOWN_KEY]?: { listeners: Set<() => void> };
	__lhEventBus?: Set<unknown>;
}

const shared = globalThis as typeof globalThis & TestShutdownGlobal;
let signalListeners: Map<NodeJS.Signals, Set<NodeJS.SignalsListener>>;

beforeEach(() => {
	delete shared[SHUTDOWN_KEY];
	signalListeners = new Map(SHUTDOWN_SIGNALS.map((signal) => [signal, new Set(process.listeners(signal))]));
});

afterEach(() => {
	for (const signal of SHUTDOWN_SIGNALS) {
		for (const listener of process.listeners(signal)) {
			if (!signalListeners.get(signal)?.has(listener)) process.removeListener(signal, listener);
		}
	}
	delete shared[SHUTDOWN_KEY];
});

describe("server shutdown", () => {
	it("notifies once across repeated shutdowns and skips unsubscribed listeners", () => {
		let calls = 0;
		const unsubscribe = onServerShutdown(() => assert.fail("unsubscribed listener ran"));
		onServerShutdown(() => calls++);
		unsubscribe();
		unsubscribe();
		triggerServerShutdown();
		triggerServerShutdown();
		assert.equal(calls, 1);
		assert.equal(shared[SHUTDOWN_KEY]?.listeners.size, 0);
	});

	it("immediately notifies a listener registered after shutdown began", () => {
		triggerServerShutdown();
		let calls = 0;
		const unsubscribe = onServerShutdown(() => calls++);
		triggerServerShutdown();
		unsubscribe();
		assert.equal(calls, 1);
		assert.equal(shared[SHUTDOWN_KEY]?.listeners.size, 0);
	});

	it("isolates listener failures so every connection can close", (t) => {
		const failure = new Error("shutdown listener failed");
		const errors = t.mock.method(console, "error", () => {});
		onServerShutdown(() => { throw failure; });
		let calls = 0;
		onServerShutdown(() => calls++);
		assert.doesNotThrow(triggerServerShutdown);
		assert.equal(calls, 1);
		assert.equal(errors.mock.calls[0]?.arguments[1], failure);
		assert.doesNotThrow(() => onServerShutdown(() => { throw failure; }));
	});

	it("shares shutdown state across separately loaded module entries", async () => {
		const entry = "../src/server/shutdown.ts?entry=route";
		const other = await import(entry) as typeof import("../src/server/shutdown.ts");
		let calls = 0;
		other.onServerShutdown(() => calls++);
		triggerServerShutdown();
		other.triggerServerShutdown();
		assert.equal(calls, 1);
	});

	it("installs no signal listeners when the application owns signal handling", (t) => {
		// A listener alone would disable Node's default exit while Next's are off.
		const previous = process.env.NEXT_MANUAL_SIG_HANDLE;
		t.after(() => {
			if (previous === undefined) delete process.env.NEXT_MANUAL_SIG_HANDLE;
			else process.env.NEXT_MANUAL_SIG_HANDLE = previous;
		});
		process.env.NEXT_MANUAL_SIG_HANDLE = "1";
		const originalCounts = SHUTDOWN_SIGNALS.map((signal) => process.listenerCount(signal));
		installShutdownSignal();
		assert.deepEqual(SHUTDOWN_SIGNALS.map((signal) => process.listenerCount(signal)), originalCounts);
	});

	for (const signal of SHUTDOWN_SIGNALS) {
		it(`installs ${signal} once and leaves process exit to Next`, (t) => {
			const exit = t.mock.method(process, "exit", () => { throw new Error("must not exit"); });
			const originalCount = process.listenerCount(signal);
			installShutdownSignal();
			installShutdownSignal();
			assert.equal(process.listenerCount(signal), originalCount + 1);
			let calls = 0;
			onServerShutdown(() => calls++);
			process.emit(signal);
			process.emit(signal === "SIGTERM" ? "SIGINT" : "SIGTERM");
			assert.equal(calls, 1);
			assert.equal(exit.mock.callCount(), 0);
		});
	}
});

describe("notification stream shutdown", { timeout: TEST_TIMEOUT_MS }, () => {
	it("finishes every open reader and removes subscriptions and heartbeats", async (t) => {
		const clearHeartbeat = t.mock.method(globalThis, "clearInterval");
		const initialBusSize = shared.__lhEventBus?.size ?? 0;
		const readers = [eventsResponse(), eventsResponse()].map((response) => response.body!.getReader());
		t.after(async () => { await Promise.all(readers.map((reader) => reader.cancel())); });
		const pendingReads = readers.map((reader) => reader.read());
		triggerServerShutdown();
		assert.deepEqual(await Promise.all(pendingReads), [
			{ done: true, value: undefined },
			{ done: true, value: undefined },
		]);
		assert.equal(shared.__lhEventBus?.size, initialBusSize);
		assert.equal(shared[SHUTDOWN_KEY]?.listeners.size, 0);
		assert.equal(clearHeartbeat.mock.callCount(), readers.length);
		emit("chats-changed", {});
		triggerServerShutdown();
		assert.equal(clearHeartbeat.mock.callCount(), readers.length);
	});

	it("client cancellation removes the shutdown listener, bus listener, and timer", async (t) => {
		const clearHeartbeat = t.mock.method(globalThis, "clearInterval");
		const initialBusSize = shared.__lhEventBus?.size ?? 0;
		const reader = eventsResponse().body!.getReader();
		t.after(() => reader.cancel());
		assert.equal(shared[SHUTDOWN_KEY]?.listeners.size, 1);
		await reader.cancel();
		assert.equal(shared[SHUTDOWN_KEY]?.listeners.size, 0);
		assert.equal(shared.__lhEventBus?.size, initialBusSize);
		assert.equal(clearHeartbeat.mock.callCount(), 1);
		triggerServerShutdown();
		assert.equal(clearHeartbeat.mock.callCount(), 1);
		assert.equal((await reader.read()).done, true);
	});

	it("immediately closes streams opened during shutdown without leaking resources", async (t) => {
		triggerServerShutdown();
		const clearHeartbeat = t.mock.method(globalThis, "clearInterval");
		const initialBusSize = shared.__lhEventBus?.size ?? 0;
		const reader = eventsResponse().body!.getReader();
		t.after(() => reader.cancel());
		assert.equal((await reader.read()).done, true);
		assert.equal(shared.__lhEventBus?.size, initialBusSize);
		assert.equal(shared[SHUTDOWN_KEY]?.listeners.size, 0);
		assert.equal(clearHeartbeat.mock.callCount(), 1);
	});
});
