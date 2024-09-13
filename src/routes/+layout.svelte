<script lang="ts">
    import { PUBLIC_APP_ID, PUBLIC_BCD_API_DOMAIN, PUBLIC_MS_DOMAIN } from '$env/static/public';
    import { OAuthClient, USERINFO_ENDPOINT_KEY, createOAuthClient, type OAuthScope } from '$lib'
    import { BUILDING_COMPONENT_DATABASE_KEY, setContextOAuthClient } from '$lib/context'
    import { type AutodeskUserInformation } from '$lib/autodesk'
 
    const { children } = $props();

    let is_authorized = $state<boolean>(false)
    let user_info = $state<{ [key: string]: any }|null>(null);

    const scopes: OAuthScope[] = [
        {
            key: USERINFO_ENDPOINT_KEY,
            resource: "https://graph.microsoft.com/",
            permissions: ["User.Read"]
        },
        {
            key: BUILDING_COMPONENT_DATABASE_KEY,
            resource: PUBLIC_BCD_API_DOMAIN,
            permissions: ["data.read", "data.write"]
        },
    ]

    const client: OAuthClient = createOAuthClient({
        client_id: PUBLIC_APP_ID,
        scopes,
        authorization_endpoint: `${PUBLIC_MS_DOMAIN}/authorize`,
        token_endpoint: `${PUBLIC_MS_DOMAIN}/token`,
        logout_endpoint: `${PUBLIC_MS_DOMAIN}/logout`,
        revoke_endpoint: `${PUBLIC_MS_DOMAIN}/revoke`,
        introspect_endpoint: `${PUBLIC_MS_DOMAIN}/introspect`,
        user_info_endpoint: "https://graph.microsoft.com/oidc/userinfo",
    })

    client.subscribe(USERINFO_ENDPOINT_KEY, async access_token => {
        is_authorized = client.isAuthorized(USERINFO_ENDPOINT_KEY)
        user_info = await client.getUserInfo<AutodeskUserInformation>()
    })

    setContextOAuthClient(client)

    const login = async () => {
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
                <!-- <img src={user_info.picture} alt="user-profile" class="user-profile"> -->
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