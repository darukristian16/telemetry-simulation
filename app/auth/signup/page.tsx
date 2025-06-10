"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { HelpCircle, User, Mail, Lock, UserPlus } from "lucide-react";

export default function SignUp() {
  const router = useRouter();
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [saveTelemetry, setSaveTelemetry] = useState(false);
  const [error, setError] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");

    if (password !== confirmPassword) {
      setError("Passwords do not match");
      setIsLoading(false);
      return;
    }
    if (password.length < 8) {
        setError("Password must be at least 8 characters long");
        setIsLoading(false);
        return;
    }

    try {
      const response = await fetch("/api/auth/register", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          username,
          email,
          password,
          saveTelemetryToCloud: saveTelemetry,
        }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.message || "Registration failed. Please try again.");
      }

      router.push("/auth/signin?registered=true");
    } catch (error) {
      setError(error instanceof Error ? error.message : "An unexpected error occurred.");
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
          Create your account
        </h1>
        <p className="mb-8 text-center text-sm text-gray-400">
          Join to use the UAV Telemetry System
        </p>

        {error && (
          <div className="mb-4 rounded border border-red-500 bg-red-900/50 px-4 py-3 text-sm text-red-200" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label
              htmlFor="username"
              className="mb-1 block text-sm font-medium text-gray-300"
            >
              Username
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <User className="h-5 w-5 text-gray-400" />
              </span>
              <Input
                id="username"
                name="username"
                type="text"
                placeholder="Choose a username"
                className="w-full rounded-md border border-gray-600 bg-gray-700 pl-10 pr-3 py-2 text-white placeholder-gray-500 transition duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                required
                aria-label="Username"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="mb-4">
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
                name="email"
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

          <div className="mb-4">
            <label
              htmlFor="password"
              className="mb-1 block text-sm font-medium text-gray-300"
            >
              Password
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-5 w-5 text-gray-400" />
              </span>
              <Input
                id="password"
                name="password"
                type="password"
                placeholder="Create a password (min. 8 characters)"
                className="w-full rounded-md border border-gray-600 bg-gray-700 pl-10 pr-3 py-2 text-white placeholder-gray-500 transition duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                minLength={8}
                aria-label="Password"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="mb-6">
            <label
              htmlFor="confirmPassword"
              className="mb-1 block text-sm font-medium text-gray-300"
            >
              Confirm Password
            </label>
            <div className="relative">
              <span className="pointer-events-none absolute inset-y-0 left-0 flex items-center pl-3">
                <Lock className="h-5 w-5 text-gray-400" />
              </span>
              <Input
                id="confirmPassword"
                name="confirmPassword"
                type="password"
                placeholder="Confirm your password"
                className="w-full rounded-md border border-gray-600 bg-gray-700 pl-10 pr-3 py-2 text-white placeholder-gray-500 transition duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={8}
                aria-label="Confirm Password"
                disabled={isLoading}
              />
            </div>
          </div>

          <div className="mb-6 flex items-center">
            <Checkbox
              id="saveTelemetry"
              checked={saveTelemetry}
              onCheckedChange={(checked) => setSaveTelemetry(checked === true)}
              className="h-4 w-4 cursor-pointer rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
              aria-label="Save telemetry configurations to cloud"
              disabled={isLoading}
            />
            <label
              htmlFor="saveTelemetry"
              className="ml-2 cursor-pointer text-sm text-gray-300"
            >
              Save telemetry configurations to cloud (optional)
            </label>
          </div>

          <Button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-bold text-white transition duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50"
            disabled={isLoading}
          >
            <UserPlus className="h-5 w-5" />
            {isLoading ? "Creating Account..." : "Create Account"}
          </Button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account?{' '}
          <Link
            href="/auth/signin"
            className="font-medium text-blue-500 hover:text-blue-400 hover:underline"
          >
            Sign in
          </Link>
        </p>

        <p className="mt-4 text-center text-xs text-gray-500">
          By signing up, you agree to our{' '}
          <Link href="#" className="text-blue-500 hover:text-blue-400 hover:underline">
            Terms of Service
          </Link>{' '}
          and{' '}
          <Link href="#" className="text-blue-500 hover:text-blue-400 hover:underline">
            Privacy Policy
          </Link>
        </p>
      </div>
    </main>
  );
} 