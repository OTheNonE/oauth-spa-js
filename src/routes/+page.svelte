<script lang="ts">

    const { data } = $props()
    const { oauths } = data

    let selected_resource_key = $state<"Microsoft Graph" | "API">(oauths[0].name)
    
    let selected_client = $derived.by(() => {
        let found_oauth = oauths.find(oauth => oauth.name == selected_resource_key)
        if (!found_oauth) throw new Error("No oauth client found.")
        return found_oauth.client
    })

    let is_authorized = $state<boolean>(false);
    let access_token = $state<string|null>(null);

    let refresh_token = $state<string|null>(null);

    let view_access_token = $state<boolean>(false);
    let view_refresh_token = $state<boolean>(false);

    let userinfo = $state<any>(null);
    let show_userinfo = $state<boolean>(false)

    $effect(() => {

        const unsubscibe = selected_client.subscribe(async token => {
            is_authorized = selected_client.hasAccessToken()
            access_token = token
            refresh_token = localStorage.getItem(selected_client.REFRESH_TOKEN_KEY)
            userinfo = selected_client.hasUserinfoEndpoint() ? await selected_client.getUserInfo() : null
        })

        return () => unsubscibe()

    })

    async function refreshAccessToken() {
        try {
            await selected_client.refreshAccessToken();
        } catch(e) {
            console.log(e)
        }
    }

    async function introspectToken() {
        try {
            const introspect = await selected_client.introspectToken()
            console.log(introspect)
        } catch(e) {
            console.log(e)
        }
    }

</script>

<main>
    <h1> Home </h1>

    <select bind:value={selected_resource_key}>
        {#each oauths as { name }}
            <option value={name}> {name} </option>
        {/each}
    </select>

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
                    onclick={() => show_userinfo = !show_userinfo}
                > 
                    {#if !show_userinfo} Show User Information {:else} Hide User Information {/if}
                </button>

                {#if show_userinfo}
                <pre class="scrollable"> 
                    {JSON.stringify(userinfo, undefined, 2)}
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