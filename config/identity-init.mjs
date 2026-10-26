import { randomBytes } from "node:crypto";
import { existsSync, mkdirSync, writeFileSync, readFileSync } from "node:fs";
mkdirSync("var/keycloak", { recursive: true });
if (existsSync("var/identity.json")) {
  console.log("Identity config already exists; preserved.");
  process.exit(0);
}
const password = () => randomBytes(20).toString("base64url");
const users = ["planner", "approver", "viewer"].map((role) => ({ username: role, password: password(), role }));
const secret = password();
const mapper = (name, attribute) => ({
  name,
  protocol: "openid-connect",
  protocolMapper: "oidc-usermodel-attribute-mapper",
  config: { "user.attribute": attribute, "claim.name": name, "jsonType.label": "String", "id.token.claim": "true", "access.token.claim": "true" },
});
const realm = {
  realm: "dxos",
  enabled: true,
  registrationAllowed: false,
  resetPasswordAllowed: false,
  sslRequired: "none",
  clients: [
    {
      clientId: "dxos-portal",
      enabled: true,
      protocol: "openid-connect",
      publicClient: false,
      secret,
      standardFlowEnabled: true,
      directAccessGrantsEnabled: false,
      redirectUris: ["http://127.0.0.1:5190/api/auth/callback"],
      webOrigins: ["http://127.0.0.1:5190"],
      attributes: { "pkce.code.challenge.method": "S256" },
      protocolMappers: [mapper("tenant", "tenant"), mapper("role", "dxos_role")],
    },
  ],
  users: users.map((u) => ({
    username: u.username,
    enabled: true,
    emailVerified: true,
    email: `${u.username}@local.invalid`,
    firstName: "DXOS",
    lastName: u.role,
    attributes: { tenant: ["demo-chain"], dxos_role: [u.role] },
    credentials: [{ type: "password", value: u.password, temporary: false }],
  })),
};
writeFileSync("var/keycloak/dxos-realm.json", JSON.stringify(realm, null, 2), { mode: 0o600 });
writeFileSync(
  "var/identity.json",
  JSON.stringify(
    {
      issuer: "http://127.0.0.1:5192/realms/dxos",
      clientId: "dxos-portal",
      clientSecret: secret,
      redirectUri: "http://127.0.0.1:5190/api/auth/callback",
      users,
    },
    null,
    2,
  ),
  { mode: 0o600 },
);
console.log("Generated private OIDC configuration and three development users in var/identity.json.");
