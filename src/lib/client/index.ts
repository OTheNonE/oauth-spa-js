import { getContext, setContext } from "svelte"
import { generateCodeChallenge, generateCodeVerifier } from "../challenge"
import { inBrowser } from "../utilities"

const client_context_key = Symbol('auth-client-key')

export function setContextAPSAuthClient(client: APSAuthClient) {
    setContext(client_context_key, client)
}

export function getContextAPSAuthClient(): ReturnType<typeof createAPSAuthClient> {
    return getContext(client_context_key)
}

export type APSAuthClient = ReturnType<typeof createAPSAuthClient>

export type CreateAPSAuthClientOptionsType = {
    clientId: string,
    authorizationEndpoint: string,
    tokenEndpoint: string,
    scope: string[],
}

export type LoginWithRedirectOptionType = {
    redirect_uri: string,
    state?: string,
    prompt?: "login"
}

export type HandleRedirectCallbackOptionsType = {
    redirect_uri: string,
}

export type LogoutOptionsType = {
    returnTo?: string,
}

/**
 * Creates an APS Authentication Client.
 * @example
 *  const client = createAPSAuthClient({
 *      clientId: PUBLIC_AEC_APP_ID,
 *      authorizationEndpoint: `https://developer.api.autodesk.com/authentication/v2/authorize`,
 *      tokenEndpoint: `https://developer.api.autodesk.com/authentication/v2/token`,
 *      scope: ["data:read"]
 *  })
 * @param {CreateAPSAuthClientOptionsType} options - Options object.
 * @param {string} options.clientId - The Client ID of the application used.
 * @param {string} options.authorizationEndpoint - The autorization endpoint for authorizing the user (usually https://developer.api.autodesk.com/authentication/v2/authorize).
 * @param {string} options.tokenEndpoint - The token endpoint for optaining an access token (usually https://developer.api.autodesk.com/authentication/v2/token).
 * @param {string} options.scope - The scope privilegies to give the user.
 * @returns {APSAuthClient} The APS Authentication Client.
 */
export function createAPSAuthClient(options: CreateAPSAuthClientOptionsType) {
    const client_options = options

    const ACCESS_TOKEN_KEY = `${client_options.clientId}.AECAccessToken`
    const REFRESH_TOKEN_KEY = `${client_options.clientId}.AECRefreshToken`
    const CODE_VERIFIER_KEY = `${client_options.clientId}.AECCodeVerifier`

    const state = (() => {
        const access_token: string | null = inBrowser() ? localStorage.getItem(ACCESS_TOKEN_KEY) : null;
        const refresh_token: string | null = inBrowser() ? localStorage.getItem(REFRESH_TOKEN_KEY) : null;
        const code_verifier: string | null = inBrowser() ? localStorage.getItem(CODE_VERIFIER_KEY) : null;
        const is_authenticated: boolean = access_token ? true : false
        return { access_token, refresh_token, code_verifier, is_authenticated }
    })()

    /* FLOW METHODS */

    /**
     * Redirects the user to Autodesks authorization page.
     * @example
     *  async function login() {
     *      const redirect_uri = `${window.location.origin}/auth/autodesk/callback`
     *      await client.loginWithRedirect({ redirect_uri })
     *  }
     * 
     * @param {LoginWithRedirectOptionType} options - Options object.
     * @param {string} options.redirect_uri - The url to redirect the user to after authentication (e.g. https://example.com/auth/autodesk/callback). The redirect URI handles the response from the authorization server.
     * @param {string} options.state - For maintaining state after being redirected from authentication.
     * @param {string} options.prompt - Have the user do a cleared session login authorization.
     * @param {{ [key: string]: string }} additionalSearchParams - Additional SearchParams parameters to add to the authorization request.
     */
    async function loginWithRedirect(options: LoginWithRedirectOptionType, additionalSearchParams?: { [key: string]: string }) {
        const { redirect_uri, prompt } = options
        const { clientId: client_id, scope, authorizationEndpoint } = client_options

        const code_verifier = generateCodeVerifier()
        const code_challenge = await generateCodeChallenge(code_verifier)

        const url = new URL(authorizationEndpoint)

        const built_in_params = { 
            client_id, 
            redirect_uri, 
            code_challenge,
            scope,
            prompt,
            response_type: "code",
            nonce: "12321321",
            method: "S256",
        }

        const searchParams = { ...built_in_params, ...additionalSearchParams,   }

        Object.entries(searchParams).forEach(([key, value]) => {
            if (value == undefined) {
                return
            } else if (Array.isArray(value)) {
                const joined_array = value.join(" ")
                if (joined_array.length == 0) return

                url.searchParams.set(key, value.join(" "))
            } else if (typeof value == "string") {
                url.searchParams.set(key, value)
            }
        })

        // Is it correct that the code verifier is supposed to be the code challenge?
        setCodeVerifier(code_challenge)

        window.location.href = url.toString()
    }

    /**
     * Handles the redirect from client.loginWithRedirect(). This function:
     * - takes the code from the url
     * - the verification code from local storage
     * - sends a "POST" request for a token and a refresh token
     * - and stores the received token and refresh token in local storage.
     * @example
     *  // https://example.com/auth/autodesk/callback
     *  const client = getContextAPSAuthClient()
     *  const { origin, pathname } = $page.url
     *  const redirect_uri = `${origin}${pathname}`
     * 
     *  // This method should be catched if it errors.
     *  try {
     *      await client.handleRedirectCallback({ redirect_uri })
     *  } catch(e) {
     *      // Handle error
     *  }
     * 
     *  goto("/")
     * 
     * @param {HandleRedirectCallbackOptionsType} options - The option object.
     * @param {string} options.redirect_uri - The url which the user is redirected to after authorization (the same value as inserted in 'client.loginWithRedirect()').
     */
    async function handleRedirectCallback(options: HandleRedirectCallbackOptionsType) {
        const { redirect_uri } = options
        const { clientId: client_id, tokenEndpoint } = client_options

        const code = getCodeFromSearchParams()
        const code_verifier = getCodeVerifier()
        clearCodeVerifier()

        if (!code) throw new Error("No code was found from the callback url.")

        if (!code_verifier) throw new Error("No code verifier was stored in local storage.")

        const init = {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id,
                code_verifier,
                code,
                redirect_uri,
                grant_type: "authorization_code",
            }).toString()
        }

        const result = await fetch(tokenEndpoint, init)
        const data = await result.json()

        if (result.status != 200) throw new Error(`${data.error} (${result.status}): ${data.error_description}`)
        
        const { access_token, refresh_token } = data

        if (typeof access_token != "string") {
            throw new Error(`'access_token' does not exists within the returned data.`)
        }

        if (typeof refresh_token != "string") {
            throw new Error(`'refresh_token' does not exists within the returned data.`)
        }

        setTokens({ access_token, refresh_token })
    }

    /**
     * Refreshes the access token using the refresh token. If failing, the method clears the access token and refresh token in local storage.
     * @example
     *  try {
     *      await client.refreshAccessToken();
     *  } catch(e) {
     *      // Handle error
     *  }
     * 
     *  ({ access_token, refresh_token } = client.getTokens())
     */
    async function refreshAccessToken() {
        const { scope } = client_options
        const { clientId: client_id, tokenEndpoint } = client_options

        const { refresh_token } = getTokens()

        if (!refresh_token) {
            clearTokens()
            throw new Error("No refresh token was stored in local storage.")
        }

        const init = {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id,
                refresh_token,
                scope: scope.join(" "),
                grant_type: "refresh_token",
            }).toString()
        }

        const result = await fetch(tokenEndpoint, init)
        const data = await result.json()

        if (result.status != 200) {
            clearTokens()
            throw new Error(`${data.error} (${result.status}): ${data.error_description}`)
        }
        
        { // Scoping for sake of name variable convention preservation.
            const { access_token, refresh_token } = data

            if (typeof access_token != "string") {
                clearTokens()
                throw new Error(`'access_token' does not exists within the returned data.`)
            }

            if (typeof refresh_token != "string") {
                clearTokens()
                throw new Error(`'refresh_token' does not exists within the returned data.`)
            }

            setTokens({ access_token, refresh_token })
        }
    }

    /**
     * Log outs the user by clearing the local storage for tokens and challenges.
     * @param options - Option object.
     * @param options.returnTo - a url to send the user to.
     */
    function logout(options?: LogoutOptionsType) {
        clearTokens()
        clearCodeVerifier()

        const returnTo = options?.returnTo;
        if (returnTo) window.location.href = returnTo
    }

    /**
     * Checks whether the user is authorized or not.
     * @returns true if authorized; false if not authorized.
     */
    function isAuthorized() {
        return state.access_token ? true : false
    }

    /* STATE HANDLING METHODS */


    function setTokens(params: { access_token?: string, refresh_token?: string }) {
        const { access_token, refresh_token } = params

        if (access_token) localStorage.setItem(ACCESS_TOKEN_KEY, access_token)
        if (refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token)

        if (access_token) state.access_token = access_token
        if (refresh_token) state.refresh_token = refresh_token
        if (access_token) state.is_authenticated = true
    }

    function clearTokens() {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);

        state.access_token = null
        state.refresh_token = null
        state.is_authenticated = false
    }

    /**
     * Return the access token and refresh token from local storage.
     * @returns Returns the access token and refresh token from local storage.
     */
    function getTokens() {
        const access_token = localStorage.getItem(ACCESS_TOKEN_KEY);
        const refresh_token = localStorage.getItem(REFRESH_TOKEN_KEY);
        return { access_token, refresh_token }
    }

    function setCodeVerifier(code_verifier: string) {
        localStorage.setItem(CODE_VERIFIER_KEY, code_verifier)
        state.code_verifier = code_verifier
    }

    function clearCodeVerifier() {
        localStorage.removeItem(CODE_VERIFIER_KEY);
        state.code_verifier = null
    }

    function getCodeVerifier() {
        const code_verifier = localStorage.getItem(CODE_VERIFIER_KEY)
        return code_verifier;
    }

    function getCodeFromSearchParams() {
        const params = new URLSearchParams(window.location.search)
        const code = params.get("code")
        return code
    }

    return {
        loginWithRedirect,
        handleRedirectCallback,
        refreshAccessToken,
        isAuthorized,
        logout,
        getTokens,
    }
}

