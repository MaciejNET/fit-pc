import { auth } from "@clerk/nextjs/server";
import { UserButton } from "@clerk/nextjs";
import Link from "next/link";
import { redirect } from "next/navigation";
import { ModeToggle } from "@/components/mode-toggle";
import OrgAutoSelect from "@/components/admin/OrgAutoSelect";

export default async function AdminLayout({
    children,
}: {
    children: React.ReactNode;
}) {
    const { orgRole } = await auth();

    if (orgRole !== "org:admin") {
        redirect("/");
    }

    return (
        <div className="flex min-h-screen w-full flex-col bg-muted/40">
            {/* Auto-select organization if user has one */}
            <OrgAutoSelect />

            {/* Header */}
            <header className="sticky top-0 z-30 flex h-16 items-center gap-4 border-b bg-background px-6">
                <Link href="/" className="flex items-center gap-2 font-semibold text-lg">
                    FitPC Admin
                </Link>
                <div className="ml-auto flex items-center gap-4">
                    <ModeToggle />
                    <div className="flex items-center gap-2">
                        <UserButton showName />
                    </div>
                </div>
            </header>

            {/* Main Content */}
            <main className="flex-1 p-6">
                <div className="mx-auto max-w-7xl">
                    {children}
                </div>
            </main>
        </div>
    );
}
