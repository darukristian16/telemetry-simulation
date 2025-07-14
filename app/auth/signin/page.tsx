"use client";

import { useState, Suspense } from "react";
import { signIn } from "next-auth/react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { HelpCircle, Mail, Lock, ArrowRight } from "lucide-react";
import { FaGoogle, FaGithub, FaMicrosoft } from "react-icons/fa"; 

function SignInContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const registered = searchParams.get("registered");
  const errorParam = searchParams.get("error");
  const callbackUrl = searchParams.get("callbackUrl") || "/dashboard";

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [rememberMe, setRememberMe] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState(errorParam || "");
  const [statusMessage, setStatusMessage] = useState("");

  // Handle form submission with client-side handling
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsLoading(true);
    setError("");
    setStatusMessage("Signing in...");
    
    try {
      const result = await signIn("credentials", {
        redirect: false,
        email,
        password,
        callbackUrl
      });

      if (result?.error) {
        setError("Authentication failed. Please check your credentials.");
        setStatusMessage("");
        setIsLoading(false);
        return;
      }
      
      if (result?.url) {
        setStatusMessage("Sign-in successful! Redirecting...");
        router.push(result.url);
      } else {
        router.push(callbackUrl);
      }
    } catch (error) {
      console.error("Sign in error:", error);
      setError("An unexpected error occurred. Please try again.");
      setStatusMessage("");
      setIsLoading(false);
    }
  };

  // Social sign-in handlers
  const handleSocialSignIn = (provider: string) => {
    setIsLoading(true);
    setStatusMessage(`Initiating ${provider} sign-in...`);
    signIn(provider, { callbackUrl });
  };

  return (
    <main className="flex min-h-screen items-center justify-center bg-gray-900 p-4 text-gray-200">
      <div className="w-full max-w-md rounded-lg bg-gray-800 p-8 shadow-xl">
        <div className="mb-6 flex justify-center">
          <HelpCircle className="h-12 w-12 text-blue-500" />
        </div>

        <h1 className="mb-2 text-center text-2xl font-bold text-white">
          Welcome Back
        </h1>
        <p className="mb-8 text-center text-sm text-gray-400">
          Sign in to your UAV Telemetry System
        </p>

        {registered && (
           <div className="mb-4 rounded border border-blue-500 bg-blue-900/50 px-4 py-3 text-sm text-blue-200" role="alert">
             <span className="block sm:inline">Registration successful! Please sign in.</span>
           </div>
         )}

        {statusMessage && (
           <div className="mb-4 rounded border border-blue-500 bg-blue-900/50 px-4 py-3 text-sm text-blue-200" role="alert">
             <span className="block sm:inline">{statusMessage}</span>
           </div>
         )}

        {error && (
          <div className="mb-4 rounded border border-red-500 bg-red-900/50 px-4 py-3 text-sm text-red-200" role="alert">
            <span className="block sm:inline">{error}</span>
          </div>
        )}

        {/* Client-side form submission */}
        <form onSubmit={handleSubmit}>
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
              />
            </div>
          </div>

          <div className="mb-6">
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
                placeholder="Enter your password"
                 className="w-full rounded-md border border-gray-600 bg-gray-700 pl-10 pr-3 py-2 text-white placeholder-gray-500 transition duration-200 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-blue-500"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                aria-label="Password"
              />
            </div>
          </div>

          <div className="mb-6 flex items-center justify-between">
            <div className="flex items-center">
              <Checkbox
                id="remember-me"
                checked={rememberMe}
                onCheckedChange={(checked) => setRememberMe(checked === true)}
                className="h-4 w-4 cursor-pointer rounded border-gray-500 bg-gray-700 text-blue-500 focus:ring-blue-500 data-[state=checked]:bg-blue-600 data-[state=checked]:border-blue-600"
                aria-label="Remember me"
              />
              <label
                htmlFor="remember-me"
                className="ml-2 cursor-pointer text-sm text-gray-300"
              >
                Remember me
              </label>
            </div>
            <div>
              <Link
                href="/auth/forgot-password"
                className="text-sm text-blue-500 hover:text-blue-400 hover:underline"
              >
                Forgot password?
              </Link>
            </div>
          </div>

          <Button
            type="submit"
            className="flex w-full items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2 font-bold text-white transition duration-200 hover:bg-blue-700 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 focus:ring-offset-gray-800 disabled:opacity-50"
            disabled={isLoading}
          >
            <ArrowRight className="h-5 w-5" />
            {isLoading ? "Signing in..." : "Sign In"}
          </Button>
        </form>

        <div className="relative my-8">
          <div className="absolute inset-0 flex items-center" aria-hidden="true">
            <div className="w-full border-t border-gray-600" />
          </div>
          <div className="relative flex justify-center">
            <span className="bg-gray-800 px-3 text-sm text-gray-400">
              Or continue with
            </span>
          </div>
        </div>

        <div className="mb-8 grid grid-cols-3 gap-4">
          <Button
            type="button"
            aria-label="Sign in with Google"
            className="
              flex h-10 items-center justify-center rounded-md
              border border-gray-600 bg-gray-700
              text-gray-300
              transition duration-200
              hover:border-gray-500 hover:bg-gray-600
              focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:ring-offset-2 focus:ring-offset-gray-800
            "
            onClick={() => handleSocialSignIn('google')}
          >
            <FaGoogle className="h-5 w-5" />
          </Button>

          <Button
            type="button"
            aria-label="Sign in with Github"
            className="
              flex h-10 items-center justify-center rounded-md
              border border-gray-600 bg-gray-700
              text-gray-300
              transition duration-200
              hover:border-gray-500 hover:bg-gray-600
              focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:ring-offset-2 focus:ring-offset-gray-800
            "
            onClick={() => handleSocialSignIn('github')}
          >
            <FaGithub className="h-5 w-5" />
          </Button>

          <Button
            type="button"
            aria-label="Sign in with Microsoft"
            className="
              flex h-10 items-center justify-center rounded-md
              border border-gray-600 bg-gray-700
              text-gray-300
              transition duration-200
              hover:border-gray-500 hover:bg-gray-600
              focus:outline-none focus:ring-2 focus:ring-blue-500
              focus:ring-offset-2 focus:ring-offset-gray-800
            "
            onClick={() => handleSocialSignIn('azure-ad')}
          >
            <FaMicrosoft className="h-5 w-5" />
          </Button>
        </div>

        <p className="text-center text-sm text-gray-400">
          Don't have an account yet?{" "}
          <Link
            href="/auth/signup"
            className="text-blue-500 hover:text-blue-400 hover:underline"
          >
            Sign up
          </Link>
        </p>
      </div>
    </main>
  );
}

export default function SignIn() {
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <SignInContent />
    </Suspense>
  );
} 