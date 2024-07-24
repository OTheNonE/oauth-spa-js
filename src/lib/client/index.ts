import { getContext, setContext } from "svelte"
import { generateCodeChallenge, generateCodeVerifier } from "../challenge"

const client_context_key = Symbol('auth-client-key')

export function setContextAPSAuthClient(client: APSAuthClient) {
    setContext(client_context_key, client)
}

export function getContextAPSAuthClient(): ReturnType<typeof createAPSAuthClient> {
    return getContext(client_context_key)
}

/**
 * The APS Authentication Client.
 */
export interface APSAuthClient {
    
    /**
     * Redirects the user to Autodesks authorization page.
     * @param options Options object for the `client.loginWithRedirect()`-method.
     * @param [additionalSearchParams] Additional SearchParams to add to the authorization request.
     * 
     * Example:
     * ```ts
     * async function login() {
     *     const redirect_uri = `${window.location.origin}/auth/autodesk/callback`
     *     await client.loginWithRedirect({ redirect_uri })
     * }
     * ```
     */
    loginWithRedirect: LoginWithRedirect

    /**
     * Handles the redirect from client.loginWithRedirect(). This function:
     * - takes the received code from the url
     * - the previously stored verification code from local storage
     * - sends a "POST" request to the authentication server for a token and a refresh token
     * - and stores the returned token and refresh token in local storage.
     * 
     * Example:
     * ```ts
     * // https://example.com/auth/autodesk/callback
     * const client = getContextAPSAuthClient()
     * const { origin, pathname } = $page.url
     * const redirect_uri = `${origin}${pathname}`
     *      
     * // This method should be catched if it errors.
     * try {
     *     await client.handleRedirectCallback({ redirect_uri })
     * } catch(e) {
     *     // Handle error
     * }
     * 
     * goto("/")
     * ```
     */
    handleRedirectCallback: HandleRedirectCallback

    /**
     * Refreshes the access token using the refresh token. If failing, the method clears the access token and refresh token in local storage.
     * 
     * Example:
     * ```ts
     * try {
     *     await client.refreshAccessToken();
     * } catch(e) {
     *     // Handle error
     * }
     * 
     * ({ access_token, refresh_token } = client.getTokens())
     * ```
     */
    refreshAccessToken: () => Promise<void>,

    /**
     * Log outs the user by clearing the local storage for tokens and challenges.
     */
    logout: Logout

    /**
     * Checks whether the user is authorized or not.
     * @returns `true` if authorized; `false` if not authorized.
     */
    isAuthorized: () => boolean


    /**
     * Return the access token and refresh token from local storage.
     * @returns the access token and refresh token from local storage.
     */
    getAccessToken: GetAccessToken
}

/**
 * @param options Options object.
 */
export type CreateAPSAuthClientOptions = {
    /**
     * The Client ID of the application used.
     */
    clientId: string,
    
    /**
     * The autorization endpoint for authorizing the user (usually https://developer.api.autodesk.com/authentication/v2/authorize).
     */
    authorizationEndpoint: string,

    /**
     * The token endpoint for optaining an access token (usually https://developer.api.autodesk.com/authentication/v2/token).
     */
    tokenEndpoint: string,
    
    /**
     * The scope privilegies to give the user. (e.g. `"data:read"`)
     */
    scope: string[],
}

type LoginWithRedirect = (options: LoginWithRedirectOption, additionalSearchParams?: { [key: string]: string }) => Promise<void>

/**
 * Options object for the `client.loginWithRedirect()`-method.
 */
export type LoginWithRedirectOption = {

    /**
     * The url to redirect the user to after authentication (e.g. https://example.com/auth/autodesk/callback). The redirect URI handles the response from the authorization server.
     */
    redirect_uri: string,

    /**
     * For maintaining state after being redirected from authentication.
     */
    state?: string,

    /**
     * Have the user do a cleared session login authorization.
     */
    prompt?: "login"
}

type HandleRedirectCallback = (options: HandleRedirectCallbackOptions) => Promise<void>

/**
 * The option object.
 */
export type HandleRedirectCallbackOptions = {

    /**
     * The url which the user is redirected to after authorization (the same value as inserted in 'client.loginWithRedirect()').
     */
    redirect_uri: string,
}

type Logout = (options?: LogoutOptions) => void

/**
 * @param options - Option object.
 */
export type LogoutOptions = {

    /**
     * A url to send the user to when logged out.
     */
    returnTo?: string,
}

type GetAccessToken = () => Promise<string | null>
type GetRefreshToken = () => Promise<string | null>

/** 
 * Creates an APS Authentication Client.
 * @example
 * const client = createAPSAuthClient({
 *     clientId: PUBLIC_AEC_APP_ID,
 *     authorizationEndpoint: `https://developer.api.autodesk.com/authentication/v2/authorize`,
 *     tokenEndpoint: `https://developer.api.autodesk.com/authentication/v2/token`,
 *     scope: ["data:read"]
 * })
 */
export function createAPSAuthClient(options: CreateAPSAuthClientOptions): APSAuthClient {
    const client_options = options

    const ACCESS_TOKEN_KEY = `${client_options.clientId}.APSAccessToken`
    const REFRESH_TOKEN_KEY = `${client_options.clientId}.APSRefreshToken`
    const CODE_VERIFIER_KEY = `${client_options.clientId}.APSCodeVerifier`
    const EXPIRATION_TIME_KEY = `${client_options.clientId}.APSExpirationTime`

    /* FLOW METHODS */

    const loginWithRedirect: LoginWithRedirect = async (options, additionalSearchParams) => {
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

    const handleRedirectCallback: HandleRedirectCallback = async (options) => {
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
        
        const { access_token, refresh_token, expires_in } = data

        if (typeof access_token != "string") {
            throw new Error(`'access_token' does not exists within the returned data.`)
        }

        if (typeof refresh_token != "string") {
            throw new Error(`'refresh_token' does not exists within the returned data.`)
        }

        if (typeof expires_in != "number") {
            throw new Error(`'expires_in' does not exists within the returned data.`)
        }

        setTokens({ access_token, refresh_token, expires_in })
    }

    const refreshAccessToken = async () => {
        const { clientId: client_id, tokenEndpoint, scope } = client_options

        const refresh_token = await getRefreshToken()

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
            const { access_token, refresh_token, expires_in } = data

            if (typeof access_token != "string") {
                clearTokens()
                throw new Error(`'access_token' does not exists within the returned data.`)
            }

            if (typeof refresh_token != "string") {
                clearTokens()
                throw new Error(`'refresh_token' does not exists within the returned data.`)
            }

            if (typeof expires_in != "number") {
                clearTokens()
                throw new Error(`'expires_in' does not exists within the returned data.`)
            }

            setTokens({ access_token, refresh_token, expires_in })
        }
    }

    const logout: Logout = (options) => {
        clearTokens()
        clearCodeVerifier()

        const returnTo = options?.returnTo;
        if (returnTo) window.location.href = returnTo
    }

    const isAuthorized = () => {
        return localStorage.getItem(ACCESS_TOKEN_KEY) ? true : false
    }

    /* STATE HANDLING METHODS */

    const setTokens = (params: { access_token: string, refresh_token: string, expires_in: number }) => {
        const { access_token, refresh_token, expires_in } = params

        const expiration_time = Date.now() + expires_in * 1000

        if (access_token) localStorage.setItem(ACCESS_TOKEN_KEY, access_token)
        if (refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token)
        if (expiration_time) localStorage.setItem(EXPIRATION_TIME_KEY, expiration_time.toString())
    }

    const clearTokens = () => {
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(EXPIRATION_TIME_KEY);
    }

    const getAccessToken: GetAccessToken = async () => {

        if (!localStorage.getItem(ACCESS_TOKEN_KEY)) return null

        const expiration_time = Number(localStorage.getItem(EXPIRATION_TIME_KEY));
        const current_time = Date.now()

        if (current_time > expiration_time) {
            await refreshAccessToken()
        }

        const access_token = localStorage.getItem(ACCESS_TOKEN_KEY);

        return access_token
    }

    const getRefreshToken: GetRefreshToken = async () => {
        return localStorage.getItem(REFRESH_TOKEN_KEY);
    }

    function setCodeVerifier(code_verifier: string) {
        localStorage.setItem(CODE_VERIFIER_KEY, code_verifier)
    }

    function clearCodeVerifier() {
        localStorage.removeItem(CODE_VERIFIER_KEY);
    }

    function getCodeVerifier() {
        return localStorage.getItem(CODE_VERIFIER_KEY)
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
        getAccessToken,
    }
}

