<script lang="ts">
    import { PUBLIC_AEC_APP_ID, PUBLIC_AEC_SERVER_URL } from '$env/static/public';
    import { createAPSAuthClient, setContextAPSAuthClient } from '$lib';

 
    const { children } = $props();

    const client = createAPSAuthClient({
        clientId: PUBLIC_AEC_APP_ID,
        authorizationEndpoint: `${PUBLIC_AEC_SERVER_URL}/authentication/v2/authorize`,
        tokenEndpoint: `${PUBLIC_AEC_SERVER_URL}/authentication/v2/token`,
        scope: ["data:read"]
    })

    setContextAPSAuthClient(client)

</script>

{@render children()}