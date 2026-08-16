import { AppShell } from "@/components/shell/app-shell";

// Everything except /login and /register renders inside the shell.
//
// Two route groups, two layouts:
//   (main)  this one  — the navigation rail
//   (auth)  the other — no rail, a signed-out visitor has nowhere to navigate
//
// Neither name appears in a URL. This is the reason route groups exist: giving
// a SUBSET of routes their own layout without inventing a URL segment to hang
// it on. The alternative — putting the shell in the root layout and having the
// auth pages somehow opt out — is not really possible, because a layout cannot
// remove a parent layout. Layouts nest; they do not override.

export default function MainLayout({ children }: LayoutProps<"/">) {
  return <AppShell>{children}</AppShell>;
}
