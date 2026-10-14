// A made-up Vapi call (GET /call/{id}) in the shape Vapi sends, for luna:report.
// Shape checked against a real call on 2026-10-13: tool results read
// "Success." in Vapi's log, and Luna's lines say numbers as words.
// Every detail is made up. `edit` swaps parts for one test.

type Message = Record<string, unknown>;

const tool = (id: string, name: string, args: object, at: number): Message[] => [
  { role: "tool_calls", toolCalls: [{ id, type: "function", function: { name, arguments: JSON.stringify(args) } }], secondsFromStart: at },
  { role: "tool_call_result", toolCallId: id, name, result: "Success.", secondsFromStart: at + 0.01 },
];

export function goodMessages(): Message[] {
  return [
    { role: "system", message: "You are Luna...", secondsFromStart: 0 },
    { role: "bot", message: "Thanks for calling Mangrove Air, this is Luna. How can I help you today?", secondsFromStart: 0.5 },
    { role: "user", message: "My AC stopped cooling last night and it's 85 degrees in the house.", secondsFromStart: 4 },
    ...tool("t1", "recordDetail", { field: "job", value: "AC not cooling" }, 8),
    { role: "bot", message: "I'm sorry to hear that. Is anyone at home at risk from the heat?", secondsFromStart: 8.2 },
    { role: "user", message: "My mom is staying with me, so it's urgent.", secondsFromStart: 12 },
    ...tool("t2", "recordDetail", { field: "urgency", value: "Urgent, elderly mother at home" }, 15),
    { role: "bot", message: "Understood. What's your name?", secondsFromStart: 15.1 },
    { role: "user", message: "Marco Delgado.", secondsFromStart: 17 },
    ...tool("t3", "recordDetail", { field: "name", value: "Marco Delgado" }, 18.5),
    { role: "bot", message: "Thanks, Marco. What's the service address?", secondsFromStart: 18.6 },
    { role: "user", message: "4450 Northeast 18th Avenue, Miami, 33137.", secondsFromStart: 21 },
    ...tool("t4", "recordDetail", { field: "address", value: "4450 NE 18th Ave, Miami, FL 33137" }, 24),
    {
      role: "bot",
      message: "That's forty-four fifty Northeast Eighteenth Avenue in Miami, three three one three seven. I can do tomorrow at nine in the morning, or tomorrow at two in the afternoon.",
      secondsFromStart: 24.1,
    },
    { role: "user", message: "Tomorrow at 9 is great.", secondsFromStart: 30 },
    ...tool("t5", "bookTime", { time: "tomorrow at 9 AM" }, 31.5),
    { role: "bot", message: "You're all set for tomorrow at nine in the morning at forty-four fifty Northeast Eighteenth Avenue, Miami, three three one three seven.", secondsFromStart: 32.5 },
    { role: "bot", message: "Thanks for calling Mangrove Air. Goodbye!", secondsFromStart: 37 },
  ];
}

export function lunaCall(edit: { messages?: Message[]; turnLatencies?: number[]; endedReason?: string } = {}) {
  return {
    id: "call-made-up",
    startedAt: "2026-10-13T15:00:00.000Z",
    endedAt: "2026-10-13T15:00:40.500Z",
    endedReason: edit.endedReason ?? "assistant-ended-call",
    cost: 0.21,
    artifact: {
      messages: edit.messages ?? goodMessages(),
      performanceMetrics: { turnLatencies: (edit.turnLatencies ?? [1400, 1600, 1500, 1900, 1700]).map((turnLatency) => ({ turnLatency })) },
    },
  };
}
