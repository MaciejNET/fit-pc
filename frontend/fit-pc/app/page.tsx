import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { SignInButton, SignUpButton, SignedIn, SignedOut, UserButton } from "@clerk/nextjs";
import { ModeToggle } from "@/components/mode-toggle";
import BuilderView from "@/components/builder/BuilderView";

export default async function Page() {
    const { orgRole } = await auth();

    // If user is admin, redirect to admin panel
    if (orgRole === "org:admin") {
        redirect("/admin");
    }

    return (
        <div className="flex flex-col h-screen">
            <header className="flex justify-between items-center px-6 gap-4 h-16 border-b flex-shrink-0">
                <h1 className="text-xl font-bold">FitPC Builder</h1>
                <div className="flex gap-4 items-center">
                    <ModeToggle />
                    <SignedOut>
                        <SignInButton />
                        <SignUpButton />
                    </SignedOut>
                    <SignedIn>
                        <UserButton />
                    </SignedIn>
                </div>
            </header>
            <main className="flex-1 p-4 overflow-hidden">
                <BuilderView />
            </main>
        </div>
    );
}