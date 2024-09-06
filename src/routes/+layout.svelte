<script lang="ts">
    import { type OAuthClient, createOAuthClient } from '$lib'
    import { PUBLIC_APP_ID } from '$env/static/public';
    import { setContextOAuthClient } from '$lib/context'
    import { type AutodeskScope, type AutodeskUserInformation } from '$lib/autodesk'
 
    const { children } = $props();

    let is_authorized = $state<boolean>(false)
    let user_info = $state<AutodeskUserInformation|null>(null);

    const scopes: string[] = [
        "api://77c68517-7444-4ac4-a135-ab81cd4615b6/.default",
        "https://graph.microsoft.com/.default"
    ]

    const SERVER_URL = "https://login.microsoftonline.com/92d2ad85-14cf-47ac-be4b-93ed3d312f25/oauth2/v2.0"

    const client: OAuthClient = createOAuthClient({
        client_id: PUBLIC_APP_ID,
        authorization_endpoint: `${SERVER_URL}/authorize`,
        token_endpoint: `${SERVER_URL}/token`,
        logout_endpoint: `${SERVER_URL}/logout`,
        revoke_endpoint: `${SERVER_URL}/revoke`,
        introspect_endpoint: `${SERVER_URL}/introspect`,
        user_info_endpoint: "https://api.userprofile.autodesk.com/userinfo",
        scopes
    })

    client.subscribe(async access_token => {
        is_authorized = client.isAuthorized()
        user_info = await client.getUserInfo<AutodeskUserInformation>()
    })

    setContextOAuthClient(client)

    async function login() {
        const redirect_uri = `${window.location.origin}/oauth/callback`
        const state = window.location.href
        await client.loginWithRedirect({ redirect_uri, state })
    }

    const logout = async () => await client.logout()

    const navigations = [{
        href: "/",
        name: "Home"
    }, {
        href: "/first",
        name: "First"
    }, {
        href: "/second",
        name: "Second"
    }] as const

</script>

<div class="top-bar">
    <div class="navigation-bar">
        {#each navigations as {href, name}}
            <a {href}> {name} </a>
        {/each}
    </div>

    <div> APS | Authentication Client for Single Page Applications </div>
    
    <div class="navigation-bar">
        {#if user_info}
            <div> 
                Hello {user_info.name}
                <img src={user_info.picture} alt="user-profile" class="user-profile">
            </div>
        {/if}
        <button disabled={is_authorized} onclick={login}> Login </button>
        <button disabled={!is_authorized} onclick={logout}> Logout </button>
    </div>
</div>

<div>
    {@render children()}
</div>

<style>
    .top-bar {
        display: flex;
        justify-content: space-between;
        padding: 0.50rem;
        border-bottom: 0.1rem solid black 
    }

    .navigation-bar {
        display: flex;
        gap: 0.50rem;
    }

    .user-profile {
        width: 1rem;
    }
</style>