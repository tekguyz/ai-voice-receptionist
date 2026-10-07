// Not NODE_ENV: Vercel Preview and a local `next start` are "production" builds
// but must use the dev limits and the avr:dev: keys. Only VERCEL_ENV says which.
export const isProduction = () => process.env.VERCEL_ENV === "production";

/** Every Redis key this app writes starts with this, so the shared Redis stays tidy. */
export const keyPrefix = () => (isProduction() ? "avr:" : "avr:dev:");
