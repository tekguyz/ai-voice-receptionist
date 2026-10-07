// The app's public address and the words every link preview uses.

export const SITE_NAME = "AI Voice Receptionist";
export const SITE_DESCRIPTION =
  "Call an AI receptionist in your browser. It answers for a made-up AC repair shop, takes the job and books a time. No signup.";

/**
 * The address search engines and link previews use: the project's production
 * domain on Vercel (also on a Preview, so a shared Preview link still shows the
 * live picture), localhost on the laptop.
 */
export function siteUrl(): URL {
  const production = process.env.VERCEL_PROJECT_PRODUCTION_URL;
  return new URL(production ? `https://${production}` : "http://localhost:3000");
}
