import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";
import { getToken } from "next-auth/jwt";

export async function middleware(request: NextRequest) {
  console.log(`Middleware processing path: ${request.nextUrl.pathname}`);
  
  // Get authentication token - add better error handling
  try {
    const token = await getToken({ 
      req: request, 
      secret: process.env.NEXTAUTH_SECRET || "your-fallback-secret-key"
    });
    
    // Log token information for debugging
    console.log(`Authentication status: ${!!token ? "Authenticated" : "Not authenticated"}`);
    
    const isAuthenticated = !!token;

    // Define protected routes
    const isProtectedRoute = 
      request.nextUrl.pathname.startsWith("/dashboard") ||
      request.nextUrl.pathname.startsWith("/telemetry");
    
    // Define auth routes
    const isAuthRoute = 
      request.nextUrl.pathname.startsWith("/auth/signin") || 
      request.nextUrl.pathname.startsWith("/auth/signup") ||
      request.nextUrl.pathname.startsWith("/auth/forgot-password");

    // Special handling for NextAuth callback routes - SKIP middleware for these
    if (
      request.nextUrl.pathname.startsWith("/api/auth") ||
      request.nextUrl.pathname.includes("callback")
    ) {
      console.log("Skipping middleware for auth API route");
      return NextResponse.next();
    }

    // Redirect authenticated users away from auth pages
    if (isAuthenticated && isAuthRoute) {
      console.log("Authenticated user accessing auth page - redirecting to dashboard");
      return NextResponse.redirect(new URL("/dashboard", request.url));
    }

    // Redirect unauthenticated users to login page
    if (!isAuthenticated && isProtectedRoute) {
      console.log("Unauthenticated user accessing protected route - redirecting to signin");
      const signInUrl = new URL("/auth/signin", request.url);
      
      // Add the original URL as the callback URL
      signInUrl.searchParams.set("callbackUrl", request.nextUrl.pathname);
      
      return NextResponse.redirect(signInUrl);
    }

    return NextResponse.next();
  } catch (error) {
    console.error("Middleware error:", error);
    // On error, proceed without middleware intervention
    return NextResponse.next();
  }
}

// Configure the middleware to run on specific paths, but EXCLUDE the API routes
export const config = {
  matcher: [
    /*
     * Match all request paths except:
     * 1. /api/auth routes (NextAuth.js)
     * 2. /_next (Next.js internals)
     * 3. /static (static files)
     */
    "/((?!api/auth|_next|static).*)",
  ],
}; 