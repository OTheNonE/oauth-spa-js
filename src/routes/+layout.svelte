<script lang="ts">
    import { PUBLIC_AEC_APP_ID } from '$env/static/public';
    import type { APSAuthClient } from '$lib'
    import { createAPSAuthClient, setContextAPSAuthClient } from '$lib/client';
 
    const { children } = $props();

    const AEC_AUTH_SERVER_URL = "https://developer.api.autodesk.com/authentication/v2"

    const client: APSAuthClient = createAPSAuthClient({
        client_id: PUBLIC_AEC_APP_ID,
        authorization_endpoint: `${AEC_AUTH_SERVER_URL}/authorize`,
        token_endpoint: `${AEC_AUTH_SERVER_URL}/token`,
        scope: ["data:read"]
    })

    setContextAPSAuthClient(client)

</script>

{@render children()}