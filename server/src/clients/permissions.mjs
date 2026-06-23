export function canControlToken(client, token) {
  if (token.isNpc) {
    return client.identity.type === "admin";
  }

  return client.identity.type === "admin" || client.identity.id === token.id;
}
