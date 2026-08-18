import { Button } from "@/components/ui/button";
import { PublicShell } from "@/components/layout/public-shell";
import { InsetGroup } from "@/components/layout/inset-group";
import { PublicCalendar } from "@/components/calendar/public-calendar";
import { ExternalLink } from "lucide-react";

type PublicCalendarPageProps = {
  embed?: boolean;
};

export default function PublicCalendarPage({ embed = false }: PublicCalendarPageProps) {
  if (embed) {
    return (
      <main className="min-h-screen bg-white">
        <div className="mx-auto max-w-[1400px] p-3 sm:p-4">
          <InsetGroup className="p-3 sm:p-4">
            <PublicCalendar sourceUrl="/api/public/events" />
          </InsetGroup>
        </div>
      </main>
    );
  }

  return (
    <PublicShell
      title="Calendar"
      subtitle="Community events, volunteer opportunities, and ministry activities in one shared calendar."
      hideTabs
      titleActions={
        <Button asChild variant="outline">
          <a href="https://www.vfwharrisonoh.org/" target="_blank" rel="noreferrer">
            <ExternalLink className="h-4 w-4" />
            Main site
          </a>
        </Button>
      }
    >
      <InsetGroup className="p-3 sm:p-4">
        <PublicCalendar sourceUrl="/api/public/events" />
      </InsetGroup>
    </PublicShell>
  );
}

export function StandaloneCalendarPage() {
  return <PublicCalendarPage />;
}

export function EmbeddedCalendarPage() {
  return <PublicCalendarPage embed />;
}
