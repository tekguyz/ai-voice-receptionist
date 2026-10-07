import { DETAIL_LABELS, Field, SECTION_LABEL, TicketHeader, Transcript } from "@/app/_ui/ticket";
import { DETAIL_FIELDS, tellCallStory } from "@/lib/call-story";
import { SAMPLE_CALL_EVENTS } from "@/lib/sample-call";
import { SAMPLE_BUSINESS, TEST_CALL_TICKET } from "@/lib/sample-business";

// A picture of the app on the landing page: the Sample Call's work order,
// filled in. Built from the stored Sample Call events, so it always matches
// the call a Visitor can play.
export function SampleWorkOrder() {
  const { view } = tellCallStory(SAMPLE_CALL_EVENTS);
  return (
    <figure className="mx-auto w-full max-w-[420px]">
      <figcaption className={`${SECTION_LABEL} mb-2`}>A sample call</figcaption>
      <div className="bg-sheet [filter:drop-shadow(0_2px_2px_rgb(90_74_30/0.16))_drop-shadow(0_14px_24px_rgb(90_74_30/0.22))]">
        <TicketHeader number={TEST_CALL_TICKET} as="p" />
        <dl className="grid gap-1.5 px-5 pt-4 pb-5">
          {DETAIL_FIELDS.map((field) => (
            <Field key={field} label={DETAIL_LABELS[field]} value={view.details[field]} />
          ))}
          <Field label="Booked" value={view.booked} />
        </dl>
        <div className="border-t border-form-rule px-5 pt-5 pb-6">
          <p className={`${SECTION_LABEL} mb-4`}>What was said</p>
          <Transcript lines={view.lines.slice(0, 4)} receptionistName={SAMPLE_BUSINESS.receptionistName} />
        </div>
      </div>
    </figure>
  );
}
