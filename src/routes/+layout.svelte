<script lang="ts">
    import { setContextOAuthClient } from '$lib/context'
 
    const { children, data } = $props();

    const { oauth_api_client, oauth_graph_client } = data

    let has_access_token = $state<boolean>(false)
    let userinfo = $state<{ [key: string]: any }|null>(null);

    setContextOAuthClient(oauth_graph_client)

    oauth_graph_client.subscribe(async () => {
        has_access_token = oauth_graph_client.hasAccessToken()
        userinfo = await oauth_graph_client.getUserInfo()
    })

    const login = async () => {
        const redirect_uri = `${window.location.origin}/oauth/callback`
        const state = window.location.href
        await oauth_api_client.loginWithRedirect({ redirect_uri, state })
    }

    const logout = async () => {
        await oauth_graph_client.logout()
        await oauth_api_client.logout()
    }

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
        {#if userinfo}
            <div> 
                Hello {userinfo.name}
                <img src={userinfo.picture} alt="user-profile" class="user-profile">
            </div>
        {/if}
        <button disabled={has_access_token} onclick={login}> Login </button>
        <button disabled={!has_access_token} onclick={logout}> Logout </button>
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