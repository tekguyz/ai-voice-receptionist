export const VISITOR_A = "7b0c6d8e-1f2a-4b3c-8d4e-5f6a7b8c9d0e";
export const VISITOR_B = "0a1b2c3d-4e5f-4a6b-8c7d-9e0f1a2b3c4d";
export const OPEN_TIMES: [string, string] = ["Tuesday, October 6 at 9 AM", "Tuesday, October 6 at 2 PM"];

const toolCall = (name: string, args: object) => ({ id: `tc-${name}`, type: "function", function: { name, arguments: JSON.stringify(args) } });

/** What Vapi sends as `message` when a call ends: a short call that books 9 AM. */
export function endOfCallReport(over: Record<string, unknown> = {}, visitorId: string | null = VISITOR_A) {
  return {
    type: "end-of-call-report",
    endedReason: "assistant-ended-call",
    durationSeconds: 75.4,
    analysis: { summary: "Rosa Diaz called about an AC that blows warm air and booked Tuesday at 9 AM." },
    call: {
      id: "call-123",
      assistantOverrides: {
        ...(visitorId ? { metadata: { visitorId } } : {}),
        variableValues: { openTime1: OPEN_TIMES[0], openTime2: OPEN_TIMES[1] },
      },
    },
    artifact: {
      messages: [
        { role: "system", message: "You are Luna, the receptionist...", secondsFromStart: 0 },
        { role: "bot", message: "Thanks for calling Mangrove Air, this is Luna. How can I help you today?", secondsFromStart: 1.2 },
        { role: "user", message: "Hi, my AC is blowing warm air.", secondsFromStart: 6.5 },
        { role: "tool_calls", toolCalls: [toolCall("recordDetail", { field: "job", value: "AC blowing warm air" })], secondsFromStart: 8 },
        { role: "tool_call_result", name: "recordDetail", result: "Noted.", secondsFromStart: 8.2 },
        { role: "user", message: "Rosa Diaz.", secondsFromStart: 14 },
        { role: "tool_calls", toolCalls: [toolCall("recordDetail", { field: "name", value: "Rosa Diaz" })], secondsFromStart: 15 },
        { role: "user", message: "Tuesday at nine please.", secondsFromStart: 40 },
        { role: "tool_calls", toolCalls: [toolCall("bookTime", { time: "tuesday, october 6 at 9 am" })], secondsFromStart: 41 },
        { role: "bot", message: "You're all set for Tuesday at nine in the morning. Goodbye.", secondsFromStart: 46 },
      ],
    },
    ...over,
  };
}
