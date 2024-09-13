<script lang="ts">
    import { getContextOAuthClient } from "$lib/context";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation"
    
    const handleCallback = async () => {
        
        const client = getContextOAuthClient()
        
        const { origin, pathname } = $page.url
        const redirect_uri = `${origin}${pathname}`
        
        const state = $page.url.searchParams.get(client.STATE_SEARCH_PARAMETER)
    
        try {
            await client.handleRedirectCallback({ redirect_uri })
        } catch(e) {
            console.log(e)
        }

        state ? goto(state) : goto("/")

    }

    handleCallback()

</script>

<p1> ...Handling callback from Autodesk... </p1>