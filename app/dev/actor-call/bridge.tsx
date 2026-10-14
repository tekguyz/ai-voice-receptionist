"use client";

// Dev only. Joins a Luna web call and a Caller actor web call in this tab.
// Each call's microphone is a Web Audio stream; the other call's speaker
// (the "Vapi Speaker" participant) feeds it. No real microphone is used.
// Luna's call goes through /api/test-call, like any Test Call.
//
//   /dev/actor-call?lang=es&seconds=50   Spanish actor, both calls stopped after 50 s

import { useState } from "react";

type VapiCall = {
  on(event: string, listener: (payload: any) => void): void;
  reconnect(call: { webCallUrl: string; id?: string }): Promise<void>;
  stop(): void | Promise<void>;
  getDailyCallObject(): any;
};

// Daily allows one call object per page unless told otherwise, and the Vapi
// SDK does not pass that option on. Wrap it once.
function allowTwoCalls(Daily: any) {
  if (Daily.__twoCalls) return;
  const create = Daily.createCallObject.bind(Daily);
  Daily.createCallObject = (options: object = {}) => {
    Daily.__made = (Daily.__made ?? 0) + 1;
    return create({ ...options, allowMultipleCallInstances: true });
  };
  Daily.__twoCalls = true;
}

// Feeds `from`'s remote voice into `into`, once per track.
function pipe(from: VapiCall, context: AudioContext, into: MediaStreamAudioDestinationNode) {
  const daily = from.getDailyCallObject();
  const seen = new Set<string>();
  const connect = (track: MediaStreamTrack | undefined, participant: any) => {
    if (!track || participant?.local || participant?.user_name !== "Vapi Speaker" || track.kind !== "audio" || seen.has(track.id)) return;
    seen.add(track.id);
    context.createMediaStreamSource(new MediaStream([track])).connect(into);
  };
  for (const p of Object.values<any>(daily.participants())) connect(p.tracks?.audio?.persistentTrack, p);
  daily.on("track-started", (e: any) => connect(e?.track, e?.participant));
}

async function post(url: string) {
  const response = await fetch(url, { method: "POST" });
  const body = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(`${url} answered ${response.status}: ${JSON.stringify(body)}`);
  return body as { callId: string; webCallUrl: string };
}

export function ActorBridge() {
  const [log, setLog] = useState<string[]>([]);
  const [running, setRunning] = useState(false);

  async function start() {
    setRunning(true);
    const say = (line: string) => {
      console.log(`[bridge] ${line}`);
      setLog((all) => [...all, line]);
    };
    const params = new URLSearchParams(location.search);
    const lang = params.get("lang") === "es" ? "es" : "en";
    const capSeconds = Number(params.get("seconds") ?? 170);
    const t0 = performance.now();
    const mark = (step: string) => say(`${Math.round(performance.now() - t0)} ms: ${step}`);
    // Stops both calls, once, on any end or failure.
    const calls: VapiCall[] = [];
    let over = false;
    const hangUp = (why: string) => {
      if (over) return;
      over = true;
      say(why);
      for (const call of calls) void Promise.resolve(call.stop()).catch(() => {});
      setRunning(false);
    };
    try {
      const context = new AudioContext();
      const toLuna = context.createMediaStreamDestination();
      const toActor = context.createMediaStreamDestination();
      const Daily = (await import("@daily-co/daily-js")).default as any;
      allowTwoCalls(Daily);
      const { default: Vapi } = await import("@vapi-ai/web");
      mark("SDK loaded");
      const make = (into: MediaStreamAudioDestinationNode) =>
        new Vapi("no-key-needed-for-reconnect", undefined, undefined, { audioSource: into.stream.getAudioTracks()[0] }) as unknown as VapiCall;
      const actor = make(toActor);
      const luna = make(toLuna);
      calls.push(actor, luna);

      // ?check=1: can this page hold two calls? Joins a room that does not exist, twice. Costs nothing.
      if (params.has("check")) {
        const fake = { webCallUrl: "https://vapi.daily.co/no-such-room-actor-check" };
        for (const [who, call] of [["Actor", actor], ["Luna", luna]] as const) {
          await call.reconnect(fake).then(
            () => say(`${who}: joined?`),
            (error: unknown) => say(`${who}: ${error instanceof Error ? error.message : JSON.stringify(error)}`),
          );
        }
        // Both made through the wrap: the SDK shares this page's Daily, so two calls are allowed.
        say(`Call objects made through the wrap: ${Daily.__made ?? 0}`);
        const a = Daily.createCallObject();
        const b = Daily.createCallObject();
        say(`Two live call objects at once: ${a && b ? "yes" : "no"}`);
        await Promise.all([a.destroy(), b.destroy()]);
        setRunning(false);
        return;
      }

      await fetch("/api/visit", { method: "POST", redirect: "manual" });
      // The Actor joins first: it waits for Luna to speak.
      const actorCall = await post(`/dev/actor-call/start?lang=${lang}`);
      actor.on("call-end", () => hangUp("The Actor's call ended."));
      say(`Actor call ${actorCall.callId}`);
      await actor.reconnect({ webCallUrl: actorCall.webCallUrl, id: actorCall.callId });
      pipe(actor, context, toLuna);
      mark("Actor joined");

      const lunaCall = await post("/api/test-call");
      say(`Luna call ${lunaCall.callId}`);
      mark("Luna call created (/api/test-call)");
      let heardLuna = false;
      luna.on("message", (m: any) => {
        if (String(m?.type).startsWith("transcript") && m.transcriptType === "final") {
          if (!heardLuna && m.role !== "user") mark("Luna's first words");
          heardLuna ||= m.role !== "user";
          say(`${m.role === "user" ? "Actor" : "Luna"}: ${m.transcript}`);
        }
        if (m?.type === "tool-calls") for (const t of m.toolCallList ?? []) say(`  [${t.function?.name}] ${JSON.stringify(t.function?.arguments)}`);
      });
      luna.on("call-end", () => hangUp("Luna's call ended."));
      await luna.reconnect({ webCallUrl: lunaCall.webCallUrl, id: lunaCall.callId });
      pipe(luna, context, toActor);
      mark("Luna joined");
      setTimeout(() => hangUp(`Stopped at the ${capSeconds} s cap.`), capSeconds * 1000);
    } catch (error) {
      hangUp(`Failed: ${error instanceof Error ? error.message : String(error)}`);
    }
  }

  return (
    <main className="mx-auto max-w-2xl p-6 font-mono text-sm">
      <h1 className="mb-4 text-lg font-bold">AI actor calls Luna (dev only)</h1>
      <button type="button" className="border px-3 py-2" onClick={start} disabled={running}>
        Start the call
      </button>
      <ol className="mt-4 space-y-1">
        {log.map((line, i) => (
          <li key={i}>{line}</li>
        ))}
      </ol>
    </main>
  );
}
