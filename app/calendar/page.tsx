import { Suspense } from "react";
import { CalendarSkeleton, CalendarView } from "@/components/calendar/calendar-view";

export default function CalendarPage({ searchParams }: PageProps<"/calendar">) {
  return (
    <div className="flex flex-col gap-10">
      <h1 className="text-xl font-medium">Calendar</h1>
      <Suspense fallback={<CalendarSkeleton />}>
        <CalendarView searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
