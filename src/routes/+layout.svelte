<script lang="ts">
    import { PUBLIC_AEC_APP_ID } from '$env/static/public';
    import { createAPSAuthClient, setContextAPSAuthClient } from '$lib/client';
 
    const { children } = $props();

    const AEC_AUTH_SERVER_URL = "https://developer.api.autodesk.com/authentication/v2"

    const client = createAPSAuthClient({
        clientId: PUBLIC_AEC_APP_ID,
        authorizationEndpoint: `${AEC_AUTH_SERVER_URL}/authorize`,
        tokenEndpoint: `${AEC_AUTH_SERVER_URL}/token`,
        scope: ["data:read"]
    })

    setContextAPSAuthClient(client)

</script>

{@render children()}