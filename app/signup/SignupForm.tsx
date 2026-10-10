"use client";

import { useActionState } from "react";
import { Loader2 } from "lucide-react";
import { signUp, type AuthFormState } from "@/app/auth/actions";
import { Alert, Button, Input, Label } from "@/components/ui";

export function SignupForm() {
  const [state, action, pending] = useActionState<AuthFormState, FormData>(signUp, {});

  return (
    <form action={action} className="space-y-4" noValidate>
      {state.error ? <Alert tone="error">{state.error}</Alert> : null}
      <div>
        <Label htmlFor="full_name">Full name</Label>
        <Input id="full_name" name="full_name" autoComplete="name" maxLength={120} required />
      </div>
      <div>
        <Label htmlFor="email">Email</Label>
        <Input
          id="email"
          name="email"
          type="email"
          autoComplete="email"
          inputMode="email"
          required
          defaultValue={state.email}
        />
      </div>
      <div>
        <Label htmlFor="password">Password</Label>
        <Input id="password" name="password" type="password" autoComplete="new-password" minLength={8} required />
        <p className="mt-1 text-xs text-slate-500">At least 8 characters.</p>
      </div>
      <Button type="submit" size="lg" className="w-full" disabled={pending}>
        {pending ? <Loader2 aria-hidden className="size-5 animate-spin" /> : null}
        {pending ? "Creating account…" : "Create account"}
      </Button>
    </form>
  );
}
