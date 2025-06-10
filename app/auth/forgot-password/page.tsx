"use client";

import { useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { HelpCircle, Mail, ArrowRight, CheckCircle } from "lucide-react";

export default function ForgotPassword() {
  const [email, setEmail] = useState("");
  const [isSubmitted, setIsSubmitted] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    try {
      // Simulate API call
      console.log("Sending password reset link to:", email);
      await new Promise((resolve) => setTimeout(resolve, 1000)); // Simulate network delay

      setIsSubmitted(true);
      setIsLoading(false);
    } catch (err) {
      console.error("Forgot password error:", err);
      setError("An error occurred while sending the reset link. Please try again.");
      setIsLoading(false);
    }
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-900 p-4 text-gray-200">
      <div className="w-full max-w-md rounded-lg bg-gray-800 p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <HelpCircle className="h-12 w-12 text-blue-500" />
        </div>

        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          Reset Password
        </h1>
        {!isSubmitted && (
          <p className="mb-8 text-center text-sm text-gray-400">
            Enter your email address and we'll send you a link to reset your password.
          </p>
        )}

        {error && !isSubmitted && (
          <div className="mb-4 rounded border border-red-500 bg-red-900/50 px-4 py-3 text-sm text-red-200" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {isSubmitted ? (
          <div className="text-center">
            <div className="mb-4 flex justify-center">
              <CheckCircle className="h-12 w-12 text-green-500" />
            </div>
            <h2 className="mb-2 text-xl font-semibold text-white">Check your email</h2>
            <p className="mb-6 text-sm text-gray-400">
              We've sent a password reset link to <span className="font-medium text-white">{email}</span>. Please check your inbox (and spam folder).
            </p>
            <Link
              href="/auth/signin"
              className="font-medium text-blue-500 hover:text-blue-400 hover:underline"
            >
              Return to Sign In
            </Link>
          </div>
        ) : (
          <form onSubmit={handleSubmit}>
            <div className="mb-6">
              <label
                htmlFor="email"
                className="mb-1 block text-sm font-medium text-gray-300"
              >
                Email Address
              </label>
              <div className="relative">
                <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                  <Mail className="h-5 w-5 text-gray-400" />
                </span>
                <Input
                  id="email"
                  type="email"
                  placeholder="Enter your email"
                  className="w-full rounded-md border border-gray-600 bg-gray-700 pl-10 pr-3 py-2 text-white placeholder-gray-500 transition duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                  aria-label="Email Address"
                  disabled={isLoading}
                />
              </div>
            </div>

            <Button
              type="submit"
              className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-bold text-white transition duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50"
              disabled={isLoading}
            >
              <ArrowRight className="h-5 w-5" />
              {isLoading ? "Sending..." : "Send Reset Link"}
            </Button>

            <p className="mt-6 text-center text-sm text-gray-400">
              Remember your password?{' '}
              <Link
                href="/auth/signin"
                className="font-medium text-blue-500 hover:text-blue-400 hover:underline"
              >
                Sign in
              </Link>
            </p>
          </form>
        )}
      </div>
    </main>
  );
} 