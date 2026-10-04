import Link from "next/link";

// Placeholder. The landing page comes in a later step of the rebuild.
export default function Home() {
  return (
    <main className="p-4">
      <h1>AI Voice Receptionist</h1>
      <p>The landing page is not built yet.</p>
      <p>
        <Link href="/demo" className="underline">
          Play the Sample Call
        </Link>
      </p>
    </main>
  );
}
