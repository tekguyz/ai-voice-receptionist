// Spoken numbers as the transcript writes them. Luna says numbers as words, so
// the voice reads a zip code digit by digit and a time the way people say it,
// and the caller's words come back from the transcriber spelled out too. The
// screen shows them the way the work order writes them: "4450 Northeast 18th
// Avenue, Deerfield Beach, FL 33063" and "Wednesday, October 28 at 9 AM", the
// same as the booked time. Only these shapes change; a counting word in a
// sentence ("two open times", "eighty five degrees") stays a word.

const ONES = ["zero", "one", "two", "three", "four", "five", "six", "seven", "eight", "nine", "ten", "eleven", "twelve", "thirteen", "fourteen", "fifteen", "sixteen", "seventeen", "eighteen", "nineteen"];
const TENS = ["", "", "twenty", "thirty", "forty", "fifty", "sixty", "seventy", "eighty", "ninety"];
const ORDINAL_ONES = ["", "first", "second", "third", "fourth", "fifth", "sixth", "seventh", "eighth", "ninth", "tenth", "eleventh", "twelfth", "thirteenth", "fourteenth", "fifteenth", "sixteenth", "seventeenth", "eighteenth", "nineteenth"];
const ORDINAL_TENS = ["", "", "twentieth", "thirtieth", "fortieth", "fiftieth", "sixtieth", "seventieth", "eightieth", "ninetieth"];

const alt = (words: readonly string[]) => words.filter(Boolean).join("|");
const SEP = "[\\s-]+";
// 1 to 99 in words, and the same as an ordinal ("twenty eighth").
const CARDINAL = `(?:(?:${alt(TENS)})(?:${SEP}(?:${alt(ONES.slice(1, 10))}))?|${alt(ONES)})`;
const ORDINAL = `(?:(?:${alt(TENS)})${SEP}(?:${alt(ORDINAL_ONES.slice(1, 10))})|${alt(ORDINAL_TENS)}|${alt(ORDINAL_ONES)})`;

const MONTHS = "January|February|March|April|May|June|July|August|September|October|November|December";
const STREET_WORDS = "Street|St|Avenue|Ave|Road|Rd|Court|Ct|Terrace|Ter|Place|Pl|Drive|Dr|Lane|Ln|Way|Boulevard|Blvd|Circle|Cir|Trail|Parkway";
const DIRECTIONS = "Northeast|Northwest|Southeast|Southwest|North|South|East|West|NE|NW|SE|SW";
const MERIDIEM = "(a\\.\\s?m\\.|p\\.\\s?m\\.|a\\s?m\\b|p\\s?m\\b|in the morning|in the afternoon|in the evening)";
const DIGIT_WORDS = alt(ONES.slice(0, 10));

/** The value of a number word from 1 to 99, cardinal or ordinal. */
function valueOf(words: string): number {
  return words
    .toLowerCase()
    .split(/[\s-]+/)
    .reduce((sum, word) => {
      for (const list of [ONES, TENS, ORDINAL_ONES, ORDINAL_TENS]) {
        const index = list.indexOf(word);
        if (index > 0 || (index === 0 && list === ONES)) return sum + (list === TENS || list === ORDINAL_TENS ? index * 10 : index);
      }
      return sum;
    }, 0);
}

function ordinalSuffix(n: number): string {
  if (n % 100 >= 11 && n % 100 <= 13) return "th";
  return ["th", "st", "nd", "rd"][n % 10] ?? "th";
}

const DIGIT: Record<string, string> = { oh: "0", ...Object.fromEntries(ONES.slice(0, 10).map((word, digit) => [word, String(digit)])) };

export function writtenNumbers(text: string): string {
  return (
    text
      // A date: "October twenty eighth" -> "October 28".
      .replace(new RegExp(`\\b(${MONTHS})\\s+(${ORDINAL}|${CARDINAL})\\b`, "gi"), (match, month: string, day: string) => {
        const n = valueOf(day);
        return n >= 1 && n <= 31 ? `${month} ${n}` : match;
      })
      // A time: "nine AM", "nine thirty a.m.", "two in the afternoon" -> "9 AM", "9:30 AM", "2 PM".
      .replace(
        new RegExp(`\\b(${CARDINAL})(?:\\s+(oh\\s+(?:${alt(ONES.slice(1, 10))})|${CARDINAL}))?\\s+${MERIDIEM}(?=$|[\\s.,!?;:])`, "gi"),
        (match, hourWords: string, minuteWords: string | undefined, meridiem: string) => {
          const hour = valueOf(hourWords);
          const minutes = minuteWords ? valueOf(minuteWords.replace(/^oh\s+/i, "")) : 0;
          if (hour < 1 || hour > 12 || minutes > 59) return match;
          const half = /^p|afternoon|evening/i.test(meridiem) ? "PM" : "AM";
          return `${hour}${minuteWords ? `:${String(minutes).padStart(2, "0")}` : ""} ${half}`;
        },
      )
      // A numbered street: "eighteenth Avenue" -> "18th Avenue".
      .replace(new RegExp(`\\b(${ORDINAL})(\\s+(?:${STREET_WORDS})\\b)`, "gi"), (_match, ordinal: string, street: string) => {
        const n = valueOf(ordinal);
        return `${n}${ordinalSuffix(n)}${street}`;
      })
      // A street number said in pairs before the direction: "forty four fifty Northeast" -> "4450 Northeast".
      .replace(
        new RegExp(`\\b(${CARDINAL})${SEP}(oh${SEP}(?:${alt(ONES.slice(1, 10))})|${CARDINAL})(?=\\s+(?:${DIRECTIONS})\\b)`, "gi"),
        (match, high: string, low: string) => {
          const [h, l] = [valueOf(high), valueOf(low.replace(/^oh[\s-]+/i, ""))];
          return h >= 10 && (l >= 10 || /^oh/i.test(low)) ? `${h}${String(l).padStart(2, "0")}` : match;
        },
      )
      // Three or more digits said one by one: a street number or a zip code.
      .replace(new RegExp(`\\b(?:${DIGIT_WORDS})(?:[\\s,-]+(?:${DIGIT_WORDS}|oh)){2,}\\b`, "gi"), (run) =>
        run
          .toLowerCase()
          .split(/[\s,-]+/)
          .filter(Boolean)
          .map((word) => DIGIT[word])
          .join(""),
      )
      // The state before a zip code, as the work order writes it.
      .replace(/\bFlorida,?\s+(\d{5})\b/g, "FL $1")
  );
}
