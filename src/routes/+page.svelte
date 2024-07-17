<script lang="ts">
    import { getContextAPSAuthClient } from "$lib/client";

    const client = getContextAPSAuthClient()

    function login() {
        const redirect_uri = `${window.location.origin}/callback/auth`
        
        client.loginWithRedirect({
            redirect_uri
        })
    }

    function logout() {
        client.logout()
    }

</script>

<h1> Get a 3-Legged Token with Authorization Code Grant (PKCE) for Public Clients </h1>
<div>
    <button onclick={login}> Login </button>
    <button onclick={logout}> Logout </button>
</div>