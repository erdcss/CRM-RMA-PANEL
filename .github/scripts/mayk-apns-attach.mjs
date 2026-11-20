const APP_ID = "904c797e-7ddc-46a6-b5ed-e081f1c39bd3";
const APP_BUNDLE = "com.turmarkt.mayk";
const APPLE_TEAM = "U3WGSDJCT2";
const token = process.env.EXPO_TOKEN;
if (!token) throw Error("Shared Expo token unavailable");

async function gql(query, variables) {
  const response = await fetch("https://api.expo.dev/graphql", {
    method: "POST",
    headers: {
      Authorization: "Bearer " + token,
      "Content-Type": "application/json",
      Accept: "application/json",
    },
    body: JSON.stringify({ query, variables }),
    signal: AbortSignal.timeout(20000),
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok || data.errors?.length) {
    const errorMessages = (data.errors || []).map(x => String(x.message || "").slice(0, 180));
    throw Error("Expo APNs credential operation failed: HTTP " + response.status + " " + errorMessages.join("; "));
  }
  return data.data;
}

const probe = `query MaykPushCredentialProbe($appId: String!) {
  app {
    byId(appId: $appId) {
      id
      fullName
      ownerAccount {
        id
        applePushKeysPaginated(first: 30) {
          edges { node { id appleTeam { appleTeamIdentifier } } }
        }
      }
      iosAppCredentials {
        id
        appleAppIdentifier { bundleIdentifier }
        appleTeam { appleTeamIdentifier }
        pushKey { id }
      }
    }
  }
}`;

async function current() {
  const result = await gql(probe, { appId: APP_ID });
  const app = result?.app?.byId;
  if (!app || app.id !== APP_ID || app.fullName !== "@erdcls/mayk-ios") throw Error("Unexpected Expo app, abort");
  const credentials = (app.iosAppCredentials || []).filter(
    x => x.appleAppIdentifier?.bundleIdentifier === APP_BUNDLE &&
      x.appleTeam?.appleTeamIdentifier === APPLE_TEAM
  );
  const pushKeys = (app.ownerAccount?.applePushKeysPaginated?.edges || []).map(x => x.node).filter(
    x => x?.appleTeam?.appleTeamIdentifier === APPLE_TEAM
  );
  if (credentials.length !== 1 || pushKeys.length !== 1) {
    throw Error("Expected exactly one M.A.Y.K credential and one matching-team APNs key; abort safely");
  }
  return { credentials: credentials[0], pushKey: pushKeys[0] };
}

const before = await current();
if (before.credentials.pushKey?.id === before.pushKey.id) {
  console.log("[MAYK APNs] Existing correct same-team APNs key already attached; no mutation");
  process.exit(0);
}
if (before.credentials.pushKey != null) {
  throw Error("M.A.Y.K already has a DIFFERENT push key. Do not replace automatically.");
}

// Only assigns one PREEXISTING same-Apple-team APNs key to com.turmarkt.mayk.
// Does NOT create, revoke, delete, export or reveal any Apple private key.
const mutation = `mutation AttachMaykExistingTeamPushKey($credentialsId: ID!, $pushKeyId: ID!) {
  iosAppCredentials {
    setPushKey(id: $credentialsId, pushKeyId: $pushKeyId) {
      id
      pushKey { id }
    }
  }
}`;
const updated = await gql(mutation, {
  credentialsId: before.credentials.id,
  pushKeyId: before.pushKey.id,
});
if (updated?.iosAppCredentials?.setPushKey?.pushKey?.id !== before.pushKey.id) {
  throw Error("Expo did not confirm the APNs key assignment");
}
const after = await current();
if (after.credentials.pushKey?.id !== before.pushKey.id) throw Error("APNs read-back verification failed");
console.log("[MAYK APNs] SUCCESS: existing same-team Apple Push Notification key attached and read-back verified for com.turmarkt.mayk");
