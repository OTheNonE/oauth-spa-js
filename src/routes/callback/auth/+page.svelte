<script lang="ts">
    import { getContextAPSAuthClient } from "$lib";
    import { page } from "$app/stores";
    import { goto } from "$app/navigation"
    
    const handleCallback = async () => {
        
        const client = getContextAPSAuthClient()
        const redirect_uri = $page.url.origin + $page.url.pathname
    
        if ($page.url.searchParams.get("code")) {
            await client.handleRedirectCallback({
                redirect_uri
            })
        }

        goto("/")

    }

    handleCallback()
    

</script>