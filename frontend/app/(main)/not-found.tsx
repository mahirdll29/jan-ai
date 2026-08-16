import Link from "next/link";

import { PageNotice } from "@/components/design/page-notice";

// THE 404 PAGE, INSIDE THE APP SHELL.
//
// ---- WHY A SECOND not-found.tsx EXISTS -------------------------------------
//
// This is the same content as app/not-found.tsx with none of the chrome,
// because it does not need any: it sits inside the (main) route group, so
// app/(main)/layout.tsx wraps it and the navigation rail is already there.
//
// It exists because of how `notFound()` resolves. Next walks UP from the page
// that threw and renders the FIRST not-found.tsx it meets, inside the layouts
// above that file. With only the root boundary, a signed-in user who opened a
// deleted report would be dropped onto a bare page with no rail — thrown out of
// the application by a missing row.
//
// This file is closer, so it wins, and they keep their navigation.
//
// ---- WHAT ACTUALLY REACHES IT ----------------------------------------------
//
// app/(main)/reports/[id]/page.tsx calls notFound() when the backend returns
// 404 for an id — a deleted report, or a mistyped one. That is the real case,
// and it was already possible before this phase; it just rendered Next's stock
// black-on-white default page instead.
//
// Note that it still sends a genuine 404 STATUS, not a 200 with sad text on it.
// That matters for anything that is not a person: a crawler or a link checker
// reads the status, not the words.

export default function MainNotFound() {
  return (
    <PageNotice
      docket="404 · Not in the register"
      title="That report isn't here."
      actions={
        <>
          <Link
            href="/reports"
            className="py-1 text-signal-ink underline underline-offset-4"
          >
            Browse the register
          </Link>
          <Link
            href="/reports/mine"
            className="py-1 text-signal-ink underline underline-offset-4"
          >
            My reports
          </Link>
        </>
      }
    >
      <p>
        Either this report was deleted, or the reference is wrong. Reports are
        removed by whoever filed them, and nothing is kept afterwards.
      </p>
    </PageNotice>
  );
}
