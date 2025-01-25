import { PUBLIC_APP_ID, PUBLIC_RESOURCE_NAME, PUBLIC_WELL_KNOWN_URL } from "$env/static/public";
import { createOAuthClient, fetchOpenIdConfiguration, type OAuthClient } from "$lib";

export const ssr = false;


export async function load() {

    const { userinfo_endpoint, ...oauth_endpoints } = await fetchOpenIdConfiguration(PUBLIC_WELL_KNOWN_URL)

    const oauth_graph_client: OAuthClient = createOAuthClient({
        client_id: PUBLIC_APP_ID,
        resource: "https://graph.microsoft.com/",
        scopes: ["User.Read"],
        userinfo_endpoint,
        ...oauth_endpoints,
    })

    const oauth_api_client: OAuthClient = createOAuthClient({
        client_id: PUBLIC_APP_ID,
        resource: PUBLIC_RESOURCE_NAME,
        scopes: ["data.read", "data.write"],
        ...oauth_endpoints
    })

    return {
        oauth_api_client,
        oauth_graph_client
    }


}