import { getStaffUserByEmail } from "@/domain/staff/repository";
import { verifyPassword } from "@/lib/crypto";

export interface AuthenticatedStaff {
  staffUserId: string;
  email: string;
  name: string;
  role: "OWNER" | "STAFF";
  businessIds: string[];
}

// A bcrypt hash of a random, never-used password — compared against
// when the email doesn't exist, so lookup-miss and wrong-password
// take roughly the same amount of time and an attacker can't use
// response timing to enumerate valid staff emails.
const DUMMY_HASH = "$2a$12$CwTycUXWue0Thq9StjUM0uJ8G5x3ZuDN3v6zRuY8vHbHRJnJQ8oJK";

export async function authenticateStaff(
  email: string,
  password: string
): Promise<AuthenticatedStaff | null> {
  const staffUser = await getStaffUserByEmail(email);

  const validPassword = await verifyPassword(password, staffUser?.passwordHash ?? DUMMY_HASH);

  if (!staffUser || !staffUser.isActive || !validPassword) {
    return null;
  }

  return {
    staffUserId: staffUser.id,
    email: staffUser.email,
    name: staffUser.name,
    role: staffUser.role,
    businessIds: staffUser.businesses.map((b: { id: string }) => b.id)
  };
}
