// Admin tool: set a new password for an account. Usage: npm run reset-password -- someone@example.com
// The new password is typed in hidden, so it never appears on screen or in shell history.
import nextEnv from "@next/env";
import { hashPassword } from "better-auth/crypto";
import pg from "pg";

nextEnv.loadEnvConfig(process.cwd());

const email = process.argv[2]?.trim().toLowerCase();
if (!email) {
  console.error("Usage: npm run reset-password -- someone@example.com");
  process.exit(1);
}

/** Reads a line from the terminal without echoing it. */
function askHidden(question) {
  return new Promise((resolve) => {
    const { stdin, stdout } = process;
    stdout.write(question);
    stdin.setRawMode(true);
    stdin.resume();
    stdin.setEncoding("utf8");
    let value = "";
    const onData = (ch) => {
      if (ch === "\r" || ch === "\n" || ch === "\u0004") {
        stdin.setRawMode(false);
        stdin.pause();
        stdin.off("data", onData);
        stdout.write("\n");
        resolve(value);
      } else if (ch === "\u0003") {
        stdout.write("\n");
        process.exit(130); // Ctrl+C
      } else if (ch === "\u007f") {
        value = value.slice(0, -1); // Backspace
      } else {
        value += ch;
      }
    };
    stdin.on("data", onData);
  });
}

const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
try {
  const { rows } = await pool.query(
    `select u.id, u.name from "user" u join account a on a.user_id = u.id
     where lower(u.email) = $1 and a.provider_id = 'credential'`,
    [email],
  );
  if (rows.length === 0) {
    console.error(`No email/password account found for ${email}.`);
    process.exit(1);
  }
  const user = rows[0];
  console.log(`Resetting the password for ${user.name} <${email}>`);

  const password = await askHidden("New password (min 8 characters): ");
  if (password.length < 8) {
    console.error("Password must be at least 8 characters. Nothing changed.");
    process.exit(1);
  }
  if ((await askHidden("Repeat new password: ")) !== password) {
    console.error("Passwords don't match. Nothing changed.");
    process.exit(1);
  }

  await pool.query(`update account set password = $1, updated_at = now() where user_id = $2 and provider_id = 'credential'`, [
    await hashPassword(password),
    user.id,
  ]);
  // Sign out everywhere so the old password's sessions stop working.
  const { rowCount } = await pool.query(`delete from session where user_id = $1`, [user.id]);
  console.log(`Password updated. Signed out of ${rowCount} active session(s) — log in again with the new password.`);
} finally {
  await pool.end();
}
