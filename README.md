# Autodesk Platform Services - SPA Auth Client
A JavaScript client for gaining access to Autodesk Platform Services within single-page applications (inspired by [Auth0](https://github.com/auth0/auth0-spa-js)). The client obtains access tokens using the [PKCE (Proof Key for Code Exchange) authorization flow for public clients](https://aps.autodesk.com/en/docs/oauth/v2/reference/http/gettoken-POST/#section-1-authorization-code-grant-type).

# Getting Started

### Installation
Using npm in your project directory run the following command:

```bash
npm install aps-spa-auth-js
```

### Configure your application
Create a Single Page Application in [Autodesk Platform Services - Applications](https://aps.autodesk.com/hubs/@personal/applications/) and store the Client ID within your application (in a `.env`-file). Specify an authorization callback url to be used in your application (e.g. http://localhost:8000/auth/autodesk/callback or https://example.com/auth/autodesk/callback)

### Integrate authentication into your application
Create the client and have it globally accessible in your application (verify authorization- and tokenEndpoint urls with [Autodesks documentation](https://aps.autodesk.com/en/docs/oauth/v2/reference)):
```ts
const client = createAPSAuthClient({
    clientId: PUBLIC_AEC_APP_ID,
    authorizationEndpoint: `$https://developer.api.autodesk.com/authentication/v2/authorize`,
    tokenEndpoint: `https://developer.api.autodesk.com/authentication/v2/token`,
    scope: ["data:read"]
})
```

Redirect the user to Autodesks authorization page (create a callback directory for handling the callback and for the authorization page to redirect you back to):
```ts
const redirect_uri = `${window.location.origin}/auth/autodesk/callback`
await client.loginWithRedirect({ redirect_uri })
```

Handle the redirect from the authorization page:
```ts
// https://example.com/auth/autodesk/callback
const { origin, pathname } = $page.url
const redirect_uri = `${origin}${pathname}`

try {
    await client.handleRedirectCallback({ redirect_uri })
} catch(e) {
    // Handle error
}

goto("/") // (Sveltekit function, sends user back to main page.)
```

If the access token expires or becomes invalid, refresh the access token:
```ts
try {
    await client.refreshAccessToken();
} catch(e) {
    // Handle error
}
```