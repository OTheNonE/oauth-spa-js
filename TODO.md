## To-do list:


### Multiple data providers in single sign-in
Support multiple scopes by either:
```ts
const scopes = [
    "api://77c68517-7444-4ac4-a135-ab81cd4615b6/data.read",
    "https://graph.microsoft.com/User.Read",
    "api://77c68517-7444-4ac4-a135-ab81cd4615b6/data.write",
]
```
or:
```ts
const scopes = [{
    key: "building-component-database",
    resource: "api://77c68517-7444-4ac4-a135-ab81cd4615b6/",
    scopes: ["data.read", "data.write"],
}, {
    key: "microsoft-graph",
    resource: "https://graph.microsoft.com/",
    scopes: ["User.Read"],
}]
```

This results in multiple access tokens:
```ts
const access_token_bcd = await client.getAccessToken("building-component-database");
const access_token_graph = await client.getAccessToken("microsoft-graph");

client.subscribe("building-component-database", access_token => {
    
})
```

### Start using ".well-known" endpoint
Create client by using ".well-known" endpoint instead of specifying every endpoint:
```ts
const client = createOAuthClient({
    client_id: PUBLIC_APP_ID,
    configuration_url: `${SERVER_URL}.well-known/openid-configuration`
    configuration_overwrite: {
        logout_endpoint: `${SERVER_URL}/logout`
    }
    scope: ["data:read"]
})
```
It should be possible to overwrite the ".well-known" configurations.