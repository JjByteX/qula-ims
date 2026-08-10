"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { LogOut, Settings } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

type ProfileMenuUser = {
  firstName: string;
  lastName: string;
  profilePictureUrl: string | null;
};

// Top-right profile trigger (dashboard header). Opens a menu with Settings
// and Logout — the only two account-level actions that exist in the app
// (app/settings/page.tsx, app/api/auth/logout/route.ts), so nothing else
// belongs here per the one-action-one-place rule in
// docs/ux-ui-guidelines.md.
export function ProfileMenu({ user }: { user: ProfileMenuUser }) {
  const router = useRouter();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const initials = `${user.firstName.charAt(0)}${user.lastName.charAt(0)}`.toUpperCase();
  const fullName = `${user.firstName} ${user.lastName}`;

  async function handleLogout() {
    if (isLoggingOut) return;
    setIsLoggingOut(true);
    try {
      await fetch("/api/auth/logout", { method: "POST" });
    } finally {
      router.push("/login");
      router.refresh();
    }
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          aria-label={`Open profile menu for ${fullName}`}
          className="rounded-full outline-none transition-opacity hover:opacity-80 focus-visible:ring-2 focus-visible:ring-[var(--ring)] focus-visible:ring-offset-2 focus-visible:ring-offset-[var(--background)]"
        >
          <Avatar className="border border-[var(--border)]">
            {user.profilePictureUrl && <AvatarImage src={user.profilePictureUrl} alt="" />}
            <AvatarFallback>{initials}</AvatarFallback>
          </Avatar>
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        <DropdownMenuItem onSelect={() => router.push("/settings")}>
          <Settings className="size-4" aria-hidden="true" />
          Settings
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuItem variant="destructive" disabled={isLoggingOut} onSelect={handleLogout}>
          <LogOut className="size-4" aria-hidden="true" />
          {isLoggingOut ? "Logging out..." : "Logout"}
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
