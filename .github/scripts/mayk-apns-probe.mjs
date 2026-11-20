const PROJECT_ID = "904c797e-7ddc-46a6-b5ed-e081f1c39bd3";
const TEAM_ID = "U3WGSDJCT2";
const token = process.env.EXPO_TOKEN;
if (!token) throw Error("Shared Expo token unavailable");
const query = `query MaykPushCredentialProbe($appId: String!) {
  app {
    byId(appId: $appId) {
      id
      fullName
      ownerAccount {
        id
        name
        applePushKeysPaginated(first: 30) {
          edges {
            node {
              id
              appleTeam { appleTeamIdentifier }
            }
          }
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
const response = await fetch("https://api.expo.dev/graphql", {
  method: "POST",
  headers: {
    Authorization: "Bearer " + token,
    "Content-Type": "application/json",
    Accept: "application/json"
  },
  body: JSON.stringify({ query, variables: { appId: PROJECT_ID } }),
  signal: AbortSignal.timeout(20000)
});
const payload = await response.json().catch(() => ({}));
if (!response.ok || payload.errors?.length) {
  const safe = (payload.errors || []).map(x => String(x.message || "").slice(0, 160));
  console.error("[MAYK APNs] Probe failed", response.status, safe);
  process.exit(1);
}
const app = payload.data?.app?.byId;
if (!app || app.id !== PROJECT_ID) throw Error("Unexpected Expo project");
const creds = (app.iosAppCredentials || []).filter(x => x.appleAppIdentifier?.bundleIdentifier === "com.turmarkt.mayk");
const candidates = (app.ownerAccount?.applePushKeysPaginated?.edges || [])
  .map(x => x.node)
  .filter(x => x?.appleTeam?.appleTeamIdentifier === TEAM_ID);
console.log(JSON.stringify({
  project: app.fullName,
  appleTeam: TEAM_ID,
  iosCredentialsCount: creds.length,
  pushKeyConnected: creds.some(x => !!x.pushKey),
  existingMatchingTeamPushKeyCount: candidates.length,
  canAttachExistingKey: creds.length === 1 && !creds[0].pushKey && candidates.length === 1,
}, null, 2));
if (!creds.length) { console.error("[MAYK APNs] iOS app credentials missing in EAS"); process.exit(2); }
