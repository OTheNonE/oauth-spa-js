<script lang="ts">
    import { type AutodeskUserInformation } from "$lib";
    import { getContextAPSAuthClient } from "$lib/context";

    const client = getContextAPSAuthClient()

    let access_token = $state<string|null>(null);
    let refresh_token = $state<string|null>(null);
    let view_access_token = $state<boolean>(false);
    let view_refresh_token = $state<boolean>(false);
    let user_info = $state<AutodeskUserInformation|null>(null);

    client.subscribe(token => access_token = token)

    client.getUserInfo().then(result => user_info = result)
    
    refresh_token = localStorage.getItem(client.REFRESH_TOKEN_KEY)

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
    <h1> Home </h1>

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
    
            <div>
                <pre> 
                    {JSON.stringify(user_info, undefined, 2)}
                </pre>
            </div>
    
            <br>


        {:else}
            <div>
                <p> You are not authenticated. </p>
            </div>
        {/if}
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