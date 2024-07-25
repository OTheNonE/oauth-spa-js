<script lang="ts">
    import { getContextAPSAuthClient } from "$lib/client";

    const client = getContextAPSAuthClient()

    let access_token = $state<string|null>(null);
    let refresh_token = $state<string|null>(null);
    let view_access_token = $state<boolean>(false)
    let view_refresh_token = $state<boolean>(false)
    let has_access_token = $derived(typeof access_token == "string")

    client.getAccessToken().then(token => access_token = token)
    refresh_token = localStorage.getItem(client.REFRESH_TOKEN_KEY)

    async function login() {
        const redirect_uri = `${window.location.origin}/auth/autodesk/callback`
        await client.loginWithRedirect({ redirect_uri })
    }

    async function logout() {
        client.logout();
        access_token = null;
        refresh_token = null
    }

    async function refreshAccessToken() {
        try {
            await client.refreshAccessToken();
        } catch(e) {
            console.log(e)
        }

        access_token = await client.getAccessToken();
        refresh_token = localStorage.getItem(client.REFRESH_TOKEN_KEY)
    }

</script>


<main>
    <h1> Autodesk APS Authentication: 3-Legged Token with Authorization Code Grant (PKCE) for Public Clients </h1>

    <div>
        {#if access_token}
            <div>
                <p> You are authenticated! </p>
            </div>
    
            <div>
                <div> Access Token </div>
                <button 
                    onmousedown={() => view_access_token = true}
                    onmouseup={() => view_access_token = false}
                > Show </button>
    
                {#if view_access_token}
                    <p class="show-token"> {access_token} </p>
                {:else}
                    ********
                {/if}
            </div>
    
            <div>
                <button
                    onclick={() => access_token && navigator.clipboard.writeText(access_token)}
                > Copy </button>
            </div>
    
            <br>
    
            <div>
                <div> Refresh Token </div>
                <button
                    onmousedown={() => view_refresh_token = true}
                    onmouseup={() => view_refresh_token = false}
                > Show </button>
    
                {#if view_refresh_token}
                    <p> {refresh_token} </p>
                {:else}
                    ********
                {/if}
            </div>
    
            <div>
                <button
                    onclick={() => refresh_token && navigator.clipboard.writeText(refresh_token)}
                > Copy </button>
            </div>
    
            <br>
    
            <div>
                <button
                    onclick={refreshAccessToken}
                > Refresh Access Token </button>
            </div>
    
            <br>
        {:else}
            <div>
                <p> You are not authenticated. </p>
            </div>
        {/if}
    </div>
    
    <div>
        <button disabled={has_access_token} onclick={login}> Login </button>
        <button disabled={!has_access_token} onclick={logout}> Logout </button>
    </div>
    
</main>

<style>
    .show-token {
        word-break: break-word; 
        white-space: pre-wrap;
    }

    main {
        max-width: 600px;
        margin: auto;
    }
</style>