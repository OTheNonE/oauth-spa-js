<script lang="ts">
    import { getContextOAuthClient } from "$lib/context";
    import { page } from "$app/state";
    import { goto } from "$app/navigation"

    const { data } = $props()
    const { oauth_api_client, oauth_graph_client } = data
    
    const handleCallback = async () => {
        
        const { origin, pathname } = page.url
        const redirect_uri = `${origin}${pathname}`
        
        const state = page.url.searchParams.get(oauth_graph_client.STATE_SEARCH_PARAMETER)
    
        try {
            await oauth_api_client.handleRedirectCallback({ redirect_uri })
            await oauth_graph_client.refreshAccessToken()
        } catch(e) {
            console.log(e)
        }

        state ? goto(state) : goto("/")

    }

    handleCallback()

</script>

<p1> ...Handling callback from Autodesk... </p1>