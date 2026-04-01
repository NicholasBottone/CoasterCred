"use client";
import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { toast } from "sonner";

export function SignInForm() {
  const { signIn } = useAuthActions();
  const [flow, setFlow] = useState<"signIn" | "signUp">("signIn");
  const [submitting, setSubmitting] = useState(false);
  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    confirmPassword: "",
  });

  const resetPasswords = () =>
    setForm((current) => ({ ...current, password: "", confirmPassword: "" }));

  return (
    <div className="w-full">
      <form
        className="flex flex-col gap-form-field"
        onSubmit={async (e) => {
          e.preventDefault();
          if (flow === "signUp" && form.password !== form.confirmPassword) {
            toast.error("Passwords do not match.");
            return;
          }

          setSubmitting(true);
          const formData = new FormData();
          formData.set("flow", flow);
          formData.set("email", form.email.trim().toLowerCase());
          formData.set("password", form.password);
          if (flow === "signUp") {
            formData.set("name", form.name.trim());
          }

          try {
            await signIn("password", formData);
          } catch (error: any) {
            const message = String(error?.message ?? "");
            const toastTitle =
              message.includes("Invalid credentials")
                ? "That email or password did not match."
                : message.includes("Name is required")
                  ? "Please add your name to create an account."
                  : message.includes("at least 8 characters")
                    ? "Use a password with at least 8 characters."
                    : message.includes("one letter and one number")
                      ? "Use a password with at least one letter and one number."
                      : flow === "signIn"
                        ? "Could not sign in. Check your email and password."
                        : "Could not create your account. Try a different email.";
            toast.error(toastTitle);
            setSubmitting(false);
            resetPasswords();
          }
        }}
      >
        {flow === "signUp" && (
        <input
          className="auth-input-field"
          type="text"
          name="name"
          placeholder="Display name"
          maxLength={40}
          value={form.name}
          onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
          required
          />
        )}
        <input
          className="auth-input-field"
          type="email"
          name="email"
          placeholder="Email"
          value={form.email}
          onChange={(e) => setForm((current) => ({ ...current, email: e.target.value }))}
          required
        />
        <input
          className="auth-input-field"
          type="password"
          name="password"
          placeholder="Password"
          value={form.password}
          onChange={(e) => setForm((current) => ({ ...current, password: e.target.value }))}
          required
        />
        {flow === "signUp" && (
          <input
            className="auth-input-field"
            type="password"
            name="confirmPassword"
            placeholder="Confirm password"
            value={form.confirmPassword}
            onChange={(e) =>
              setForm((current) => ({ ...current, confirmPassword: e.target.value }))
            }
            required
          />
        )}
        {flow === "signUp" && (
          <p className="text-xs text-secondary">
            Display names max out at 40 characters. Passwords must be at least 8 characters and include a letter and a number.
          </p>
        )}
        <button className="auth-button" type="submit" disabled={submitting}>
          {flow === "signIn" ? "Sign in" : "Create account"}
        </button>
        <div className="text-center text-sm text-secondary">
          <span>
            {flow === "signIn"
              ? "Don't have an account? "
              : "Already have an account? "}
          </span>
          <button
            type="button"
            className="text-primary hover:text-primary-hover hover:underline font-medium cursor-pointer"
            onClick={() => {
              setFlow(flow === "signIn" ? "signUp" : "signIn");
              setSubmitting(false);
              resetPasswords();
            }}
          >
            {flow === "signIn" ? "Sign up instead" : "Sign in instead"}
          </button>
        </div>
      </form>
    </div>
  );
}
