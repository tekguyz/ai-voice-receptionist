// The made-up Sample Business and its Receptionist. Every name the demo shows
// lives here, so the founder can swap them in one place.
// Approved by the founder on 2026-10-04. Never "Sarah" or "Viora".
export const SAMPLE_BUSINESS = {
  name: "Mangrove Air",
  trade: "AC repair",
  area: "South Florida",
  receptionistName: "Luna",
} as const;

// Decoration on a made-up work order, not a real record. The landing page's
// sample and a Test Call that has no ID yet print this number. Once a Test
// Call has an ID it prints its own (lib/ticket-number.ts). Sample calls print
// lower ones.
export const TEST_CALL_TICKET = "04127";
