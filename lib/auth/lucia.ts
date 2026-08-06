import { Lucia, TimeSpan } from "lucia";
import { DrizzlePostgreSQLAdapter } from "@lucia-auth/adapter-drizzle";
import { db } from "@/db/client";
import { sessions, users } from "@/db/schema";
import type { User as DbUser } from "@/db/schema";

const adapter = new DrizzlePostgreSQLAdapter(db, sessions, users);

// This app never calls lucia.createSession() or lucia.validateSession() —
// see lib/auth/session.ts for why (two session lifetimes, normal vs
// "remember me", can't both live on one instance-wide sessionExpiresIn).
// This Lucia instance is only used for: cookie serialization
// (createSessionCookie/createBlankSessionCookie), the cookie name constant,
// and invalidateSession()/invalidateUserSessions() on logout, none of which
// depend on sessionExpiresIn. It's set to a sane value regardless, in case
// future code (e.g. OAuth flows) does call createSession() directly.
export const lucia = new Lucia(adapter, {
  sessionExpiresIn: new TimeSpan(1, "d"),
  sessionCookie: {
    // We set the cookie's Max-Age manually to match each session's actual
    // expiresAt (see session.ts), rather than using Lucia's cookie-lifetime
    // default here.
    expires: false,
    attributes: {
      secure: process.env.NODE_ENV === "production",
    },
  },
  getUserAttributes: (attributes) => {
    return {
      email: attributes.email,
      firstName: attributes.firstName,
      middleName: attributes.middleName,
      lastName: attributes.lastName,
      suffix: attributes.suffix,
      contactNumber: attributes.contactNumber,
      description: attributes.description,
      profilePictureUrl: attributes.profilePictureUrl,
      role: attributes.role,
      status: attributes.status,
    };
  },
});

declare module "lucia" {
  interface Register {
    Lucia: typeof lucia;
    DatabaseUserAttributes: DatabaseUserAttributes;
  }
}

interface DatabaseUserAttributes {
  email: DbUser["email"];
  firstName: DbUser["firstName"];
  middleName: DbUser["middleName"];
  lastName: DbUser["lastName"];
  suffix: DbUser["suffix"];
  contactNumber: DbUser["contactNumber"];
  description: DbUser["description"];
  profilePictureUrl: DbUser["profilePictureUrl"];
  role: DbUser["role"];
  status: DbUser["status"];
}
