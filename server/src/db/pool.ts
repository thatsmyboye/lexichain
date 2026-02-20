import { Pool } from 'pg';

const connectionString = process.env.DATABASE_URL ?? '';

/**
 * Determines if the database connection is to a local host by parsing the URL
 * and checking only the hostname. This avoids false positives when "localhost"
 * or "127.0.0.1" appears in other URL components (e.g., password, username, db name).
 */
function isLocalConnection(url: string): boolean {
  try {
    const { hostname } = new URL(url);
    return hostname === 'localhost' || hostname === '127.0.0.1' || hostname === '::1';
  } catch {
    return false;
  }
}

const isLocal = isLocalConnection(connectionString);

export const pool = new Pool({
  connectionString,
  ssl: isLocal ? false : { rejectUnauthorized: true },
});
