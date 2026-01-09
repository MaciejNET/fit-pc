import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";
import { NextResponse } from "next/server";

const isAdminPage = createRouteMatcher(["/admin(.*)"]);
const isAdminApi = createRouteMatcher(["/api/admin(.*)"]);

export default clerkMiddleware(async (auth, req) => {
    const { userId, has } = await auth();

    // Check admin page routes
    if (isAdminPage(req)) {
        if (!userId || !has({ role: "org:admin" })) {
            return NextResponse.redirect(new URL("/no-access", req.url));
        }
    }

    // Check admin API routes
    if (isAdminApi(req)) {
        if (!userId || !has({ role: "org:admin" })) {
            return NextResponse.json({ error: "No access" }, { status: 403 });
        }
    }
});

export const config = {
    matcher: [
        // Skip Next.js internals and all static files, unless found in search params
        '/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest)).*)',
        // Always run for API routes
        '/(api|trpc)(.*)',
    ],
};
