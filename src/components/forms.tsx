"use client";

import { useActionState, type ReactNode } from "react";
import { useFormStatus } from "react-dom";

export interface ActionState {
  error?: string;
  message?: string;
}

export type FormAction = (state: ActionState, formData: FormData) => Promise<ActionState>;

export function ActionForm({
  action,
  children,
  className,
}: {
  action: FormAction;
  children: ReactNode;
  className?: string;
}) {
  const [state, formAction] = useActionState(action, {});
  return (
    <form action={formAction} className={className}>
      {children}
      {state.error && (
        <p role="alert" className="col-span-full mt-2 basis-full text-sm text-red-700">
          {state.error}
        </p>
      )}
      {state.message && (
        <p role="status" className="col-span-full mt-2 basis-full text-sm text-club-700">
          {state.message}
        </p>
      )}
    </form>
  );
}

const BUTTON = "inline-flex min-h-10 items-center justify-center rounded-lg px-4 text-sm font-semibold";
const VARIANTS = {
  primary: `${BUTTON} bg-club-700 text-white hover:bg-club-800`,
  secondary: `${BUTTON} border border-stone-300 bg-white text-stone-800 hover:bg-stone-50`,
  danger: `${BUTTON} border border-red-300 bg-white text-red-700 hover:bg-red-50`,
  // A small text link, for actions next to a name.
  link: "text-xs text-stone-500 underline hover:text-red-700",
};

export function SubmitButton({
  children,
  variant = "primary",
  name,
  value,
  confirm,
  formNoValidate,
  className = "",
}: {
  children: ReactNode;
  variant?: keyof typeof VARIANTS;
  name?: string;
  value?: string;
  confirm?: string;
  formNoValidate?: boolean;
  className?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={name}
      value={value}
      disabled={pending}
      formNoValidate={formNoValidate}
      onClick={(e) => {
        if (confirm && !window.confirm(confirm)) e.preventDefault();
      }}
      className={`transition disabled:opacity-60 ${VARIANTS[variant]} ${className}`}
    >
      {pending ? "Even geduld…" : children}
    </button>
  );
}
