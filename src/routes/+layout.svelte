<script lang="ts">
    import { PUBLIC_APP_ID, PUBLIC_MICROSOFT_DOMAIN } from '$env/static/public';
    import { OAuthClient, createOAuthClient, type OAuthResource } from '$lib'
    import { MICROSOFT_RESOURCE_IDENTIFIER, setContextOAuthClient } from '$lib/context'
    import { type AutodeskUserInformation } from '$lib/autodesk'
 
    const { children } = $props();

    let is_authorized = $state<boolean>(false)
    let user_info = $state<{ [key: string]: any }|null>(null);

    const resources: OAuthResource[] = [
        {
            is_user_information_resource: true,
            identifier: MICROSOFT_RESOURCE_IDENTIFIER,
            scopes: ["User.Read"]
        },
    ]

    const client: OAuthClient = createOAuthClient({
        client_id: PUBLIC_APP_ID,
        resources,
        authorization_endpoint: `${PUBLIC_MICROSOFT_DOMAIN}/authorize`,
        token_endpoint: `${PUBLIC_MICROSOFT_DOMAIN}/token`,
        logout_endpoint: `${PUBLIC_MICROSOFT_DOMAIN}/logout`,
        revoke_endpoint: `${PUBLIC_MICROSOFT_DOMAIN}/revoke`,
        introspect_endpoint: `${PUBLIC_MICROSOFT_DOMAIN}/introspect`,
        user_info_endpoint: `https://graph.microsoft.com/oidc/userinfo`,
    })

    client.subscribe(MICROSOFT_RESOURCE_IDENTIFIER, async () => {
        is_authorized = client.isAuthorized(MICROSOFT_RESOURCE_IDENTIFIER)
        user_info = await client.getUserInfo()
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