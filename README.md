# OAuth 2.0 | Single-Page Applications | Authorization Client
A JS-SDK for gaining access to applications and API's implementing OAuth 2.0 within Single-Page Applications (inspired by [Auth0](https://github.com/auth0/auth0-spa-js)). The client obtains access tokens by using the [PKCE (Proof Key for Code Exchange) authorization flow for public clients](https://oauth.net/2/pkce/).

## Getting Started

### Installation
Using npm in your project directory run the following command:

```bash
npm install oauth-spa-js
```

### Integrate authentication into your application
Create the client and have it globally accessible in your application (verify authorization- and token endpoint urls with your authentication provider):
```ts
const resources: OAuthResource[] = [
    {
        is_user_information_resource: true,
        identifier: RESOURCE_IDENTIFIER,
        scopes: ["User.Read"]
    },
]

const client: OAuthClient = createOAuthClient({
    client_id: PUBLIC_APP_ID,
    resources,
    authorization_endpoint: `${SERVER_URL}/authorize`,
    token_endpoint: `${SERVER_URL}/token`,
    logout_endpoint: `${SERVER_URL}/logout`,
    revoke_endpoint: `${SERVER_URL}/revoke`,
    introspect_endpoint: `${SERVER_URL}/introspect`,
    user_info_endpoint: USER_INFO_ENDPOINT,
})
```

Redirect the user to the authorization provider page:
```ts
const redirect_uri = `${window.location.origin}/oauth/callback`
const state = window.location.href
await client.loginWithRedirect({ redirect_uri, state })
```

Create a callback directory which will handle the callback from the authorization page:
```ts
// https://example.com/oauth/callback
const { origin, pathname } = window.location
const redirect_uri = `${origin}${pathname}`

const searchParams = new URLSearchParams(window.location.search);
const state = searchParams.get("state")

try {
    await client.handleRedirectCallback({ redirect_uri })
} catch(e) {
    // Handle error
}

window.location.href = state ?? "/"
```

And get the access token from the client (the token is automatically refreshed by the method if expired):
```ts
try {
    const access_token = await client.getAccessToken(RESOURCE_IDENTIFIER)
} catch(e) {
    // Handle refresh access token error
}
```

Subscribe to the authorization state of the client:
```ts
client.subscribe(RESOURCE_IDENTIFIER, async token => {
    is_authorized = client.isAuthorized(RESOURCE_IDENTIFIER)
    access_token = token
    user_info = await client.getUserInfo()
})
```

Check out the [oauth-spa-js](https://github.com/OTheNonE/oauth-spa-js) Github repository for a simple example developed in SvelteKit.

## References
- [oauth-spa-js Github Repository](https://github.com/OTheNonE/oauth-spa-js)
- [oauth-spa-js NPM Package](https://www.npmjs.com/package/oauth-spa-js)