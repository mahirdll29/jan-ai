import type { Metadata } from "next";
import { RegisterForm } from "@/components/auth/register-form";

export const metadata: Metadata = {
  title: "Create an account — JAN-AI",
};

export default function RegisterPage() {
  return (
    <div className="space-y-8">
      <div>
        <h1 className="display-wide text-h1 text-ink">Create an account</h1>
        <p className="mt-2 text-ink-muted">
          You need one to file a report. Reading them requires nothing at all.
        </p>
      </div>

      <RegisterForm />
    </div>
  );
}
