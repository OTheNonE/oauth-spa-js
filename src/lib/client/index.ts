import { generateCodeChallenge, generateCodeVerifier } from "../challenge"

/** 
 * Creates an OAuth Client.
 * 
 * Example:
 * ```ts
 * const client: OAuthClient = createOAuthClient({
 *     clientId: PUBLIC_AEC_APP_ID,
 *     authorizationEndpoint: `${AUTH_SERVER_URL}/authorize`,
 *     tokenEndpoint: `${AUTH_SERVER_URL}/token`,
 *     scope: ["data:read"]
 * })
 * ```
 */
export function createOAuthClient(options: CreateOAuthClientOptions): OAuthClient {
    return new OAuthClient(options)
}

/**
 * @param options Options object.
 */
export type CreateOAuthClientOptions = {
    /**
     * The Client ID of the application used.
     */
    client_id: string,
    
    /**
     * The autorization endpoint for authorizing the user. (default: {}/authorize).
     */
    authorization_endpoint: string,

    /**
     * The token endpoint for optaining an access token.
     */
    token_endpoint: string,

    /** 
     * The introspection endpoint for introspecting the access token.
     */
    introspect_endpoint?: string

    /** 
     * The revoke endpoint for revoking tokens.
     */
    revoke_endpoint: string

    /** 
     * The logout endpoint for logging out the user.
     */
    logout_endpoint: string

    /**
     * The user information endpoint where information of the authorized user is fetched.
     */
    user_info_endpoint?: string
    
    /**
     * The scope privilegies to give the user.
     */
    scopes: string[],
}

/**
 * The OAuth Authentication Client.
 */
export class OAuthClient {
    
    /** The Client ID of the application used. */
    readonly client_id: string

    /** The scope privilegies to give the user. */
    readonly scope: string

    /** The autorization endpoint for authorizing the user. */
    readonly authorization_endpoint: string

    /** The token endpoint for optaining an access token. */
    readonly token_endpoint: string

    /** The endpoint for introspecting the access token. */
    readonly introspect_endpoint: string | null

    /** The revoke endpoint for revoking tokens. */
    readonly revoke_endpoint: string

    /** The logout endpoint for logging out the user. */
    readonly logout_endpoint: string
 
    /** The user information endpoint for fetching information of the authorized user. If null, then no endpoint has been supplied. */
    readonly user_info_endpoint: string | null

    /** The user information. */
    private user_info: any

    /** Fetching user information. If `null`, then no fetching is in progress. If `Promise<null>`, then `null` was returned from the fetch, and the promise is not cleaned up. */
    private fetching_user_info: Promise<any | null> | null

    /** The key for retrieving the access token from local storage. */
    readonly ACCESS_TOKEN_KEY: string

    /** The key for retrieving the refresh token from local storage. */
    readonly REFRESH_TOKEN_KEY: string

    /** The key for retrieving the code verifier from local storage. */
    readonly CODE_VERIFIER_KEY: string

    /** The key for retrieving the token expiration time from local storage. */
    readonly EXPIRATION_TIME_KEY: string

    private state_changed_callbacks: Set<(access_token: string | null) => void>
    
    constructor(options: CreateOAuthClientOptions) {

        this.client_id              = options.client_id
        this.scope                  = options.scopes.join(" ")
        this.authorization_endpoint = options.authorization_endpoint
        this.token_endpoint         = options.token_endpoint
        this.introspect_endpoint    = options.introspect_endpoint ?? null
        this.revoke_endpoint        = options.revoke_endpoint
        this.logout_endpoint        = options.logout_endpoint
        this.user_info_endpoint     = options.user_info_endpoint ?? null
        this.user_info              = null
        this.fetching_user_info     = null

        this.ACCESS_TOKEN_KEY       = `${options.client_id}.OAuthAccessToken`
        this.REFRESH_TOKEN_KEY      = `${options.client_id}.OAuthRefreshToken`
        this.CODE_VERIFIER_KEY      = `${options.client_id}.OAuthCodeVerifier`
        this.EXPIRATION_TIME_KEY    = `${options.client_id}.OAuthExpirationTime`

        this.state_changed_callbacks = new Set()
    }

    
    /* FLOW METHODS */

    /**
     * Redirects the user to authorization provider page.
     * @param options Options.
     * @param [additionalSearchParams] Additional SearchParams to add to the authorization request.
     * 
     * Example:
     * ```ts
     * async function login() {
     *     const redirect_uri = `${window.location.origin}/oauth/callback`
     *     await client.loginWithRedirect({ redirect_uri })
     * }
     * ```
     */
    async loginWithRedirect(options: LoginWithRedirectOption): Promise<void> {
        const { redirect_uri, prompt, state } = options
        const { client_id, scope, authorization_endpoint } = this

        const code_verifier = generateCodeVerifier()
        const code_challenge = await generateCodeChallenge(code_verifier)

        const url = new URL(authorization_endpoint)

        const searchParams = { 
            client_id, 
            redirect_uri, 
            code_challenge,
            scope,
            prompt,
            state,
            respose_mode: "query",
            response_type: "code",
            nonce: "12321321",
            method: "S256",
        }

        Object.entries(searchParams).forEach(([key, value]) => {
            if (value == undefined) return 
            else url.searchParams.set(key, value)
        })

        // Is it correct that the code verifier is supposed to be the code challenge?
        this.setCodeVerifier(code_challenge)

        console.log(url.toString())

        window.location.href = url.toString()
    }

    /**
     * Handles the redirect from client.loginWithRedirect(). This function:
     * - takes the received code from the url
     * - the previously stored verification code from local storage
     * - sends a "POST" request to the authentication server for an access token and a refresh token
     * - and stores the returned access token and refresh token in local storage.
     * @param options Options.
     * 
     * Example:
     * ```ts
     * // https://example.com/oauth/callback
     * const client = getContextOAuthClient()
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
    async handleRedirectCallback(options: HandleRedirectCallbackOptions): Promise<void> {
        const { redirect_uri } = options
        const { client_id, token_endpoint, scope } = this

        const code = this.getCodeFromSearchParams()
        const code_verifier = this.getCodeVerifier()
        this.clearCodeVerifier()

        if (!code) throw new Error("No code was found from the callback url.")

        if (!code_verifier) throw new Error("No code verifier was stored in local storage.")

        const init: RequestInit = {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id,
                code_verifier,
                code,
                scope,
                redirect_uri,
                grant_type: "authorization_code",
            }).toString()
        }

        const result = await fetch(token_endpoint, init)
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

        this.setTokens({ access_token, refresh_token, expires_in })
    }

    /**
     * Refreshes the access token using the refresh token. If failing, the method removes the access token and the refresh token from local storage.
     * 
     * Example:
     * ```ts
     * try {
     *     await client.refreshAccessToken();
     * } catch(e) {
     *     // Handle error
     * }
     * 
     * const access_token = await client.getAccessToken()
     * ```
     */
    async refreshAccessToken() {
        const { client_id, token_endpoint, scope } = this

        const refresh_token = this.getRefreshToken()

        if (!refresh_token) {
            this.clearTokens()
            throw new Error("No refresh token was stored in local storage.")
        }

        const init: RequestInit = {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id,
                refresh_token,
                scope,
                grant_type: "refresh_token",
            }).toString()
        }

        const result = await fetch(token_endpoint, init)
        const data = await result.json()

        if (result.status != 200) {
            this.clearTokens()
            throw new Error(`${data.error} (${result.status}): ${data.error_description}`)
        }
        
        { // Scoping for sake of preservation of variable name convention.
            const { access_token, refresh_token, expires_in } = data

            if (typeof access_token != "string") {
                this.clearTokens()
                throw new Error(`'access_token' does not exists within the returned data.`)
            }

            if (typeof refresh_token != "string") {
                this.clearTokens()
                throw new Error(`'refresh_token' does not exists within the returned data.`)
            }

            if (typeof expires_in != "number") {
                this.clearTokens()
                throw new Error(`'expires_in' does not exists within the returned data.`)
            }

            this.setTokens({ access_token, refresh_token, expires_in })
        }
    }

    /**
     * Log outs the user by revoking the tokens and clearing the local storage for tokens and challenges. 
     * 
     * OPS! Do not call this method if the user is logged out.
     * @param options Options.
     */
    async logout(options: LogoutOptions = { return_to: undefined }): Promise<void> {
        const { logout_endpoint } = this
        const { return_to } = options;

        const access_token = await this.getAccessToken()
        const refresh_token = this.getRefreshToken()

        if (access_token) this.revokeToken(access_token, "access_token")
        if (refresh_token) this.revokeToken(refresh_token, "refresh_token")

        this.clearTokens()
        this.clearCodeVerifier()

        const redirect_uri = return_to ?? (() => {
            const { origin, pathname } = window.location
            return `${origin}${pathname}`
        })()

        const url = new URL(logout_endpoint)
        url.searchParams.set("post_logout_redirect_uri", redirect_uri)

        window.location.href = url.toString()
    }

    private async revokeToken(token: string, token_type_hint: "access_token" | "refresh_token") {
        const { client_id, revoke_endpoint } = this

        const init: RequestInit = {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                token,
                token_type_hint,
                client_id,
            }).toString()
        }

        await fetch(revoke_endpoint, init)
    }

    /**
     * Checks whether the user is authorized or not.
     * @returns `true` if authorized; `false` if not authorized.
     */
    isAuthorized() {
        const { ACCESS_TOKEN_KEY } = this
        return localStorage.getItem(ACCESS_TOKEN_KEY) ? true : false
    }

    /**
     * Gets information of the authenticated user. If `null` is returned, the client is not authenticated. The user information is cached upon fetching. 
     * @throws if `user_info_endpoint` is not specified.
     */
    async getUserInfo<T>(): Promise<T | null> {
        if (this.fetching_user_info) await this.fetching_user_info
        
        const { user_info } = this
        
        if (user_info) return user_info
        else {
            this.fetching_user_info = this.fetchUserInfo()

            this.user_info = await this.fetching_user_info

            this.fetching_user_info = null

            return this.user_info
        }
    }

    private async fetchUserInfo<T>(): Promise<T | null> {
        const { user_info_endpoint } = this

        if (!user_info_endpoint) throw new Error("The user information endpoint has not been specified.")

        const access_token = await this.getAccessToken()

        if (!access_token) return null

        const init: RequestInit = {
            method: "GET",
            headers: { Authorization: access_token },
        }

        // console.log({ user_info_endpoint, init })

        // return null

        const result = await fetch(user_info_endpoint, init)
        const data = await result.json()

        if (result.status != 200) {
            console.log(data)
            throw new Error(`${data.error} (${result.status}): ${data.error_description}`)
        }

        return data
    }

    /**
     * Introspects the access token. If `null` is returned, no access token is stored in local storage.
     */
    async introspectToken(): Promise<TokenIntrospection> {
        const { client_id, introspect_endpoint } = this

        if (!introspect_endpoint) throw new Error("The token introspection endpoint has not been specified.")

        const access_token = await this.getAccessToken()

        if (!access_token) return null

        const init: RequestInit = {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                token: access_token,
                client_id,
            }).toString()
        }

        const result = await fetch(introspect_endpoint, init)
        const data = await result.json()

        if (result.status != 200) {
            throw new Error(`${data.error} (${result.status}): ${data.error_description}`)
        }

        return data

    }

    /* STATE HANDLING METHODS */

    private setTokens(params: { access_token: string, refresh_token: string, expires_in: number }): void {
        const { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, EXPIRATION_TIME_KEY } = this
        const { access_token, refresh_token, expires_in } = params

        const expiration_time = Date.now() + expires_in * 1000

        if (access_token) localStorage.setItem(ACCESS_TOKEN_KEY, access_token)
        if (refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token)
        if (expiration_time) localStorage.setItem(EXPIRATION_TIME_KEY, expiration_time.toString())

        this.user_info = null
        this.fetching_user_info = null

        this.notifyStateChanged()
    }

    private clearTokens() {
        const { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, EXPIRATION_TIME_KEY } = this
        
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(EXPIRATION_TIME_KEY);

        this.user_info = null
        this.fetching_user_info = null

        this.notifyStateChanged()
    }

    /**
     * Return the access token from local storage. If `null` is returned, the client is not authenticated.
     * 
     * If the token is expired, the method will try to refresh the access token before returning: 
     * - If succeeds:   A new access token will be returned.
     * - If fails:      The method will throw an error, and all tokens and code verifiers will be removed from local storage.
     */
    public async getAccessToken(options: GetAccessTokenOptions = { refresh_if_expired: true }): Promise<string | null> {
        const { ACCESS_TOKEN_KEY } = this
        const { refresh_if_expired } = options

        if (!localStorage.getItem(ACCESS_TOKEN_KEY)) return null

        if (refresh_if_expired && this.tokenIsExpired()) {
            await this.refreshAccessToken()
        }

        const access_token = localStorage.getItem(ACCESS_TOKEN_KEY);

        return access_token
    }

    private getRefreshToken(): string | null {
        const { REFRESH_TOKEN_KEY } = this

        return localStorage.getItem(REFRESH_TOKEN_KEY);
    }

    private setCodeVerifier(code_verifier: string) {
        const { CODE_VERIFIER_KEY } = this

        localStorage.setItem(CODE_VERIFIER_KEY, code_verifier)
    }

    private clearCodeVerifier() {
        const { CODE_VERIFIER_KEY } = this

        localStorage.removeItem(CODE_VERIFIER_KEY);
    }

    private getCodeVerifier() {
        const { CODE_VERIFIER_KEY } = this

        return localStorage.getItem(CODE_VERIFIER_KEY)
    }

    private getCodeFromSearchParams() {
        const params = new URLSearchParams(window.location.search)
        const code = params.get("code")
        return code
    }

    /**
     * Determines whether the `access_token` is expired or still valid.
     * @returns `true` if expired; `false` if still valid.
     */
    tokenIsExpired() {
        const { EXPIRATION_TIME_KEY } = this
        
        const expiration_time = Number(localStorage.getItem(EXPIRATION_TIME_KEY));
        const current_time = Date.now()

        return current_time > expiration_time
    }

    /* SUBSCRIBE METHODS */
        
    /**
     * Subscribe to the authentication status of the client. Specifically, the given callback function is called when the `access_token` is either added- or removed from local storage via internal class-methods. The subscription runs once on initialization.
     * @returns an unsubscribe function.
     */
    subscribe(cb: (access_token: string | null) => void): UnsubscribeToAuthState {
        const { ACCESS_TOKEN_KEY } = this
        
        const access_token = localStorage.getItem(ACCESS_TOKEN_KEY)

        this.state_changed_callbacks.add(cb)

        cb(access_token) // Call function on initialization.

        return () => {
            this.state_changed_callbacks.delete(cb)
        }
    }

    private notifyStateChanged() {
        const { ACCESS_TOKEN_KEY } = this
        
        const access_token = localStorage.getItem(ACCESS_TOKEN_KEY)

        this.state_changed_callbacks.forEach(cb => cb(access_token))
    }
}

/**
 * Options for the `client.loginWithRedirect()` method.
 */
export type LoginWithRedirectOption = {

    /**
     * The url to redirect the user to after authentication (e.g. https://example.com/oauth/callback). The redirect URI handles the response from the authorization server.
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

/**
 * Options for the `client.handleRedirectCallback()` method.
 */
export type HandleRedirectCallbackOptions = {

    /**
     * The url which the user is redirected to after authorization (the same value as inserted in 'client.loginWithRedirect()').
     */
    redirect_uri: string,
}

/**
 * Options for the `client.logout()` method.
 */
export type LogoutOptions = {

    /**
     * A url to send the user to after logging out. If not specified, the user will be redirected back to his original location.
     */
    return_to?: string,
}

/**
 * Options for the `client.getAccessToken()` method.
 */
export type GetAccessTokenOptions = {

    /**
     * Whether the method should refresh the access token automatically if expired.
     * @warning If disabled, you will eventually make requests with an outdated access token, and therefore receive `401 Unauthorized` responses from your requests.
     */
    refresh_if_expired: boolean,
}

// This JSDoc does not appear when hovering...
/**
 * Unsubscribe to the authentication status of the client.
 */
export type UnsubscribeToAuthState = () => void

export type TokenIntrospection = {
    active: true,
    scope: string,
    exp: number,
    client_id: string,
    token_type: string,
    userid: string,
} | {
    active: false,
} | null