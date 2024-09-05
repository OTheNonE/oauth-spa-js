<script lang="ts">
    import { type AutodeskUserInformation } from "$lib";
    import { getContextAPSAuthClient } from "$lib/context";

    const client = getContextAPSAuthClient()

    let is_authorized = $state<boolean>(false);
    let access_token = $state<string|null>(null);
    let refresh_token = $state<string|null>(null);
    let view_access_token = $state<boolean>(false);
    let view_refresh_token = $state<boolean>(false);
    let user_info = $state<AutodeskUserInformation|null>(null);
    let show_user_info = $state<boolean>(false)

    client.subscribe(async token => {
        is_authorized = client.isAuthorized()
        access_token = token
        refresh_token = localStorage.getItem(client.REFRESH_TOKEN_KEY)
        user_info = await client.getUserInfo()
    })

    async function refreshAccessToken() {
        try {
            await client.refreshAccessToken();
        } catch(e) {
            console.log(e)
        }
    }

    async function introspectToken() {
        try {
            const introspect = await client.introspect()
            console.log(introspect)
        } catch(e) {
            console.log(e)
        }
    }

</script>

<main>
    <h1> Home </h1>

    <div>
        {#if is_authorized}
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
                    <p class="show-token"> {refresh_token} </p>
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
                <button
                    onclick={introspectToken}
                > Introspect Token </button>
            </div>
    
            <br>
    
            <div>
                <button
                    onclick={() => show_user_info = !show_user_info}
                > 
                    {#if !show_user_info} Show User Information {:else} Hide User Information {/if}
                </button>

                {#if show_user_info}
                <pre class="scrollable"> 
                    {JSON.stringify(user_info, undefined, 2)}
                </pre>
                {/if}
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

    .scrollable {
        height: 20rem;
        overflow-y: auto
    }
</style>