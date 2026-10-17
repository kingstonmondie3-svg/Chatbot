import { type FormEvent, useState } from "react";
import { Link, Navigate, useNavigate } from "react-router-dom";
import { useAuthStore } from "../stores/auth";

export function SignUpPage() {
  const { user, signup, error, clearError } = useAuthStore();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [localError, setLocalError] = useState<string | null>(null);

  if (user) {
    return <Navigate to="/" replace />;
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    clearError();
    setLocalError(null);

    if (password !== confirmPassword) {
      setLocalError("Passwords do not match");
      return;
    }

    await signup(email, password);
    if (useAuthStore.getState().user) {
      navigate("/");
    }
  };

  const displayError = localError ?? error;

  return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50 px-4 dark:bg-[#0e0f13]">
      <div className="w-full max-w-sm rounded-2xl border border-stone-200/80 bg-white p-8 shadow-soft dark:border-white/10 dark:bg-[#15171c]">
        <h1 className="mb-6 text-center font-serif text-2xl font-semibold text-stone-900 dark:text-stone-50">
          Create an account
        </h1>

        {displayError && (
          <div className="mb-4 rounded-lg bg-red-50 p-3 text-sm text-red-700 dark:bg-red-900/30 dark:text-red-400">
            {displayError}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label
              htmlFor="email"
              className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300"
            >
              Email
            </label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-stone-900 placeholder-stone-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-stone-100 dark:placeholder-stone-500"
              placeholder="you@example.com"
            />
          </div>

          <div>
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300"
            >
              Password
            </label>
            <input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={8}
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-stone-900 placeholder-stone-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-stone-100 dark:placeholder-stone-500"
              placeholder="At least 8 characters"
            />
          </div>

          <div>
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-stone-700 dark:text-stone-300"
            >
              Confirm password
            </label>
            <input
              id="confirmPassword"
              type="password"
              value={confirmPassword}
              onChange={(e) => setConfirmPassword(e.target.value)}
              required
              className="w-full rounded-xl border border-stone-200 px-3 py-2 text-stone-900 placeholder-stone-400 focus:border-brand-500 focus:outline-none focus:ring-1 focus:ring-brand-500 dark:border-white/10 dark:bg-white/5 dark:text-stone-100 dark:placeholder-stone-500"
              placeholder="Repeat your password"
            />
          </div>

          <button
            type="submit"
            className="w-full rounded-xl bg-brand-600 px-4 py-2 text-sm font-semibold text-white shadow-soft transition-colors hover:bg-brand-700 focus:outline-none focus:ring-2 focus:ring-brand-500 focus:ring-offset-2 dark:focus:ring-offset-[#15171c]"
          >
            Sign up
          </button>
        </form>

        <p className="mt-4 text-center text-sm text-stone-600 dark:text-stone-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-brand-600 hover:text-brand-500 dark:text-brand-400"
          >
            Log in
          </Link>
        </p>
      </div>
    </div>
  );
}
