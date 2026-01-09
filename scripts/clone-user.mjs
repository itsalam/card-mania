// scripts/clone-dummy-user.mjs
// Usage:
// REMOTE_URL=... REMOTE_SERVICE_ROLE=... LOCAL_URL=... LOCAL_SERVICE_ROLE=... DUMMY_USER_ID=... node scripts/clone-dummy-user.mjs

const {
  REMOTE_URL,
  REMOTE_SERVICE_ROLE,
  LOCAL_URL = "http://localhost:54321",
  LOCAL_SERVICE_ROLE,
  DUMMY_USER_ID,
} = process.env;

if (!REMOTE_URL || !REMOTE_SERVICE_ROLE || !LOCAL_SERVICE_ROLE || !DUMMY_USER_ID) {
  throw new Error("Missing env vars. Need REMOTE_URL, REMOTE_SERVICE_ROLE, LOCAL_SERVICE_ROLE, DUMMY_USER_ID");
}

const remoteAdminBase = `${REMOTE_URL}/auth/v1/admin`;
const localAdminBase = `${LOCAL_URL}/auth/v1/admin`;

async function adminFetch(base, serviceRole, path, init = {}) {
  const res = await fetch(`${base}${path}`, {
    ...init,
    headers: {
      Authorization: `Bearer ${serviceRole}`,
      apikey: serviceRole,
      "Content-Type": "application/json",
      ...(init.headers || {}),
    },
  });

  const text = await res.text();
  let json;
  try { json = text ? JSON.parse(text) : null; } catch { json = text; }

  if (!res.ok) {
    throw new Error(`HTTP ${res.status} ${res.statusText} on ${base}${path}\n${text}`);
  }
  return json;
}

const remoteUserResp = await adminFetch(
  remoteAdminBase,
  REMOTE_SERVICE_ROLE,
  `/users/${DUMMY_USER_ID}`,
  { method: "GET" }
);

const u = remoteUserResp?.user ?? remoteUserResp; // depending on response shape

// Create/update user in LOCAL with the SAME UUID.
// This hits POST /admin/users/<user_id> which creates or updates at that id. :contentReference[oaicite:1]{index=1}
const body = {
  email: u.email,
  email_confirm: true,
  phone: u.phone ?? undefined,
  phone_confirm: !!u.phone,
  user_metadata: u.user_metadata ?? {},
  app_metadata: u.app_metadata ?? {},
  // You can pick any dev password; you’re preserving the UUID which your seed relies on.
  password: "dev-password-123",
};

const localUpsert = await adminFetch(
  localAdminBase,
  LOCAL_SERVICE_ROLE,
  `/users/${DUMMY_USER_ID}`,
  { method: "PUT", body: JSON.stringify(body) }
);

console.log("✅ Cloned user to local:", {
  id: DUMMY_USER_ID,
  email: body.email,
});
