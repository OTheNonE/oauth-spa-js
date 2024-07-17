<script lang="ts">
    import { PUBLIC_AEC_APP_ID } from '$env/static/public';
    import { createAPSAuthClient, setContextAPSAuthClient } from '$lib/client';
 
    const { children } = $props();

    const AEC_SERVER_URL = "https://developer.api.autodesk.com"

    const client = createAPSAuthClient({
        clientId: PUBLIC_AEC_APP_ID,
        authorizationEndpoint: `${AEC_SERVER_URL}/authentication/v2/authorize`,
        tokenEndpoint: `${AEC_SERVER_URL}/authentication/v2/token`,
        scope: ["data:read"]
    })

    setContextAPSAuthClient(client)

</script>

{@render children()}