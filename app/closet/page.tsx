import Link from "next/link";

// Placeholder owned by the closet lane. /closet/add belongs to the entry lane.
export default function ClosetPage() {
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-2xl font-semibold">Your closet</h1>
      <Link href="/closet/add" className="self-start rounded-full border px-4 py-2">
        Add clothes
      </Link>
    </div>
  );
}
