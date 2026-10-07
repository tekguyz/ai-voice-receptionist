"use client";

// The answering status and its switch. In the demo it changes only this
// screen: nothing is sent anywhere, and the next visit starts "on" again.

import { useId, useState } from "react";
import { SAMPLE_BUSINESS } from "@/lib/sample-business";

export function AnsweringSwitch() {
  const [on, setOn] = useState(true);
  const noteId = useId();
  const name = SAMPLE_BUSINESS.receptionistName;

  return (
    <div className="mt-6 flex flex-wrap items-center gap-x-4 gap-y-2 border-y-2 border-form py-3">
      <p className="flex items-center gap-3 font-form text-2xl font-bold uppercase">
        {/* The lamp: solid while answering, a red ring when not. */}
        <span aria-hidden="true" className={`inline-block size-3 rounded-full border-2 border-form ${on ? "bg-form" : ""}`} />
        {on ? "Answering" : "Not answering"}
      </p>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-describedby={noteId}
        onClick={() => setOn((value) => !value)}
        className="ml-auto inline-flex min-h-12 items-center gap-3 font-form text-lg font-bold tracking-wide text-form uppercase"
      >
        <span className="sr-only">{name} answers calls</span>
        <span aria-hidden="true" className={`flex h-7 w-12 border-2 border-form p-0.5 ${on ? "justify-end bg-form" : "justify-start"}`}>
          <span className={`block aspect-square h-full ${on ? "bg-sheet" : "bg-form"}`} />
        </span>
        <span aria-hidden="true" className="w-8 text-left">
          {on ? "On" : "Off"}
        </span>
      </button>
      <p id={noteId} className="w-full text-sm text-print-soft">
        {on ? `${name} answers every call.` : "Calls would go to voicemail."} In the demo, this switch changes only this screen.
      </p>
    </div>
  );
}
