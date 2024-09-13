import { generateCodeChallenge, generateCodeVerifier } from "../challenge"

export const USERINFO_ENDPOINT_KEY = "oauth-user-information-endpoint-key"

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
    scopes: OAuthScope[],
}

export type OAuthScope = {
    key: string,
    resource: string,
    permissions: string[],
}

/**
 * The OAuth Authentication Client.
 */
export class OAuthClient {
    
    /** The Client ID of the application used. */
    readonly client_id: string

    /** The scope privilegies to give the user. */
    readonly scopes: OAuthScope[]

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

    /** The key for retrieving the code verifier from local storage. */
    readonly CODE_VERIFIER_KEY: string

    /** The key for retrieving the refresh token from local storage. */
    readonly REFRESH_TOKEN_KEY: string

    /** The search parameter for extracting the authorization code parameter from the return url. */
    readonly CODE_SEARCH_PARAMETER: string

    /** The search parameter for extracting the state parameter from the return url. */
    readonly STATE_SEARCH_PARAMETER: string

    private state_changed_callbacks: Set<{
        key: string,
        cb: (access_token: string | null) => void
    }>
    
    constructor(options: CreateOAuthClientOptions) {
        this.client_id                      = options.client_id
        this.scopes                         = options.scopes
        this.authorization_endpoint         = options.authorization_endpoint
        this.token_endpoint                 = options.token_endpoint
        this.introspect_endpoint            = options.introspect_endpoint ?? null
        this.revoke_endpoint                = options.revoke_endpoint
        this.logout_endpoint                = options.logout_endpoint
        this.user_info_endpoint             = options.user_info_endpoint ?? null
        this.user_info                      = null
        this.fetching_user_info             = null

        this.REFRESH_TOKEN_KEY              = `${options.client_id}.OAuthRefreshToken`
        this.CODE_VERIFIER_KEY              = `${options.client_id}.OAuthCodeVerifier`

        this.CODE_SEARCH_PARAMETER          = "code"
        this.STATE_SEARCH_PARAMETER         = "state"

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
        const { client_id, scopes, authorization_endpoint } = this

        const joined_scope = this.joinScopes(scopes)

        const code_verifier = generateCodeVerifier()
        const code_challenge = await generateCodeChallenge(code_verifier)

        const url = new URL(authorization_endpoint)

        const searchParams = {
            client_id, 
            redirect_uri, 
            code_challenge,
            prompt,
            state,
            scope: joined_scope,
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
        const { scopes } = this

        const [ first_scope, ...other_scopes ] = scopes

        // The first token is obtained from the autorization code received from the authentication flow.
        await this.fetchTokensFromAuthorizationCode(first_scope, options)

        // All other tokens are received from the refresh token.
        other_scopes.forEach(async scope => await this.refreshAccessToken(scope.key))
    }

    /**
     * Fetches an `access_token` and a `refresh_token` from a successfull auth flow and stores the tokens in local storage. 
     */
    private async fetchTokensFromAuthorizationCode(scope: OAuthScope, options: HandleRedirectCallbackOptions) {
        const { client_id, token_endpoint, CODE_SEARCH_PARAMETER } = this
        const { redirect_uri } = options
        const { key } = scope

        const code = this.getCodeFromSearchParams(CODE_SEARCH_PARAMETER)
        const code_verifier = this.getCodeVerifier()
        this.clearCodeVerifier()

        if (!code) throw new Error("No code was found from the callback url.")
        if (!code_verifier) throw new Error("No code verifier was stored in local storage.")

        const joined_scope = this.joinPermissions(scope)

        const init: RequestInit = {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id,
                code_verifier,
                code,
                redirect_uri,
                scope: joined_scope,
                grant_type: "authorization_code",
            }).toString()
        }

        const result = await fetch(token_endpoint, init)
        const data = await result.json()

        if (result.status != 200) throw new Error(`${data.error} (${result.status}): ${data.error_description}`)

        const { 
            access_token, expires_in, 
            ext_expires_in, refresh_token, 
            scope: returned_scope, token_type 
        } = data

        if (typeof access_token != "string") {
            throw new Error(`'access_token' does not exists within the returned data.`)
        }

        if (typeof expires_in != "number") {
            throw new Error(`'expires_in' does not exists within the returned data.`)
        }

        if (typeof refresh_token != "string") {
            throw new Error(`'refresh_token' does not exists within the returned data.`)
        }

        this.setAccessToken(key, { access_token, expires_in })
        this.setRefreshToken(refresh_token)
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
    async refreshAccessToken(key: string) {
        const { client_id, token_endpoint, scopes } = this

        const scope = scopes.find(scope => scope.key == key)

        if (!scope) throw new Error(`There exists no scope for the key "${key}".`)

        const joined_scope = this.joinPermissions(scope)

        const refresh_token = this.getRefreshToken()

        if (!refresh_token) {
            throw new Error("No refresh token was stored in local storage.")
        }

        const init: RequestInit = {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id,
                refresh_token,
                scope: joined_scope,
                grant_type: "refresh_token",
            }).toString()
        }

        const result = await fetch(token_endpoint, init)
        const data = await result.json()

        if (result.status != 200) {
            this.clearAccessToken(key)
            throw new Error(`${data.error} (${result.status}): ${data.error_description}`)
        }
        
        { // Scoping for sake of preservation of variable name convention.
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

            this.setAccessToken(key, { access_token, expires_in })
            this.setRefreshToken(refresh_token)
        }
    }

    /**
     * Log outs the user by revoking the tokens and clearing the local storage for tokens and challenges. 
     * 
     * OPS! Do not call this method if the user is logged out.
     * @param options Options.
     */
    async logout(options: LogoutOptions = { return_to: undefined }): Promise<void> {
        const { logout_endpoint, scopes } = this
        const { return_to } = options;

        const refresh_token = this.getRefreshToken()
        if (refresh_token) this.revokeToken(refresh_token, "refresh_token")
        this.clearRefreshToken()

        scopes.forEach(async scope => {
            const access_token = await this.getAccessToken(scope.key)
            if (access_token) this.revokeToken(access_token, "access_token")
            this.clearAccessToken(scope.key)
        })

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
    isAuthorized(key: string) {
        const ACCESS_TOKEN_KEY = this.getAccessTokenKey(key)

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
        const { user_info_endpoint, scopes } = this
        
        const user_info_key = scopes
            .find(scope => scope.key == USERINFO_ENDPOINT_KEY)
            ?.key

        if (!user_info_key) throw new Error("No scope was found for fetching user information.")

        if (!user_info_endpoint) throw new Error("The user information endpoint has not been specified.")

        const access_token = await this.getAccessToken(user_info_key)

        if (!access_token) return null

        const init: RequestInit = {
            method: "GET",
            headers: { Authorization: access_token },
        }

        const result = await fetch(user_info_endpoint, init)
        const data = await result.json()

        if (result.status != 200) {
            throw new Error(`${data.error} (${result.status}): ${data.error_description}`)
        }

        return data
    }

    /**
     * Introspects the access token. If `null` is returned, no access token is stored in local storage.
     */
    async introspectToken(key: string): Promise<TokenIntrospection> {
        const { client_id, introspect_endpoint } = this

        if (!introspect_endpoint) throw new Error("The token introspection endpoint has not been specified.")

        const access_token = await this.getAccessToken(key)

        if (!access_token) return null

        const init: RequestInit = {
            method: "POST",
            headers: { "Content-Type": "application/x-www-form-urlencoded" },
            body: new URLSearchParams({
                client_id,
                token: access_token,
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

    private setAccessToken(key: string, params: { access_token: string, expires_in: number }): void {
        const { access_token, expires_in } = params

        const expiration_time_ms = Date.now() + expires_in * 1000

        const ACCESS_TOKEN_KEY = this.getAccessTokenKey(key)
        const EXPIRATION_TIME_KEY = this.getExpirationTimeKey(key)

        if (access_token) localStorage.setItem(ACCESS_TOKEN_KEY, access_token)
        if (expiration_time_ms) localStorage.setItem(EXPIRATION_TIME_KEY, expiration_time_ms.toString())

        this.user_info = null
        this.fetching_user_info = null

        this.notifyStateChanged(key)
    }

    private clearAccessToken(key: string) {
        const ACCESS_TOKEN_KEY = this.getAccessTokenKey(key)
        const EXPIRATION_TIME_KEY = this.getExpirationTimeKey(key)

        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(EXPIRATION_TIME_KEY);

        this.user_info = null
        this.fetching_user_info = null

        this.notifyStateChanged(key)
    }

    /**
     * Return the access token from local storage. If `null` is returned, the client is not authenticated.
     * 
     * If the token is expired, the method will try to refresh the access token before returning: 
     * - If succeeds:   A new access token will be returned.
     * - If fails:      The method will throw an error, and all tokens and code verifiers will be removed from local storage.
     */
    public async getAccessToken(key: string, options: GetAccessTokenOptions = { refresh_if_expired: true }): Promise<string | null> {
        const { refresh_if_expired } = options

        const ACCESS_TOKEN_KEY = this.getAccessTokenKey(key)

        if (!localStorage.getItem(ACCESS_TOKEN_KEY)) return null

        if (refresh_if_expired && this.tokenIsExpired(key)) {
            await this.refreshAccessToken(key)
        }

        const access_token = localStorage.getItem(ACCESS_TOKEN_KEY);

        return access_token
    }

    private setRefreshToken(refresh_token: string) {
        const { REFRESH_TOKEN_KEY } = this
        if (refresh_token) localStorage.setItem(REFRESH_TOKEN_KEY, refresh_token)

    }

    private clearRefreshToken() {
        const { REFRESH_TOKEN_KEY } = this
        localStorage.removeItem(REFRESH_TOKEN_KEY);
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

    private getCodeFromSearchParams(code_search_parameter: string) {
        const params = new URLSearchParams(window.location.search)
        return params.get(code_search_parameter)
    }

    /**
     * Determines whether the `access_token` is expired or still valid.
     * @returns `true` if expired; `false` if still valid.
     */
    tokenIsExpired(key: string) {
        const EXPIRATION_TIME_KEY = this.getExpirationTimeKey(key)
        
        const expiration_time = Number(localStorage.getItem(EXPIRATION_TIME_KEY));
        const current_time = Date.now()

        return current_time > expiration_time
    }

    /* SUBSCRIBE METHODS */
        
    /**
     * Subscribe to the authentication status of the client. Specifically, the given callback function is called when the `access_token` is either added- or removed from local storage via internal class-methods. The subscription runs once on initialization.
     * @returns an unsubscribe function.
     */
    subscribe(key: string, cb: (access_token: string | null) => void): UnsubscribeToAuthState {

        const ACCESS_TOKEN_KEY = this.getAccessTokenKey(key)
        
        const access_token = localStorage.getItem(ACCESS_TOKEN_KEY)

        const state_changed_callback = { key, cb }

        this.state_changed_callbacks.add(state_changed_callback)

        cb(access_token) // Call function on initialization.

        return () => {
            this.state_changed_callbacks.delete(state_changed_callback)
        }
    }

    private notifyStateChanged(key: string) {

        const ACCESS_TOKEN_KEY = this.getAccessTokenKey(key)
        
        const access_token = localStorage.getItem(ACCESS_TOKEN_KEY)

        this.state_changed_callbacks.forEach(({ key: callback_key, cb }) => {
            if (callback_key == key) cb(access_token)
        })
    }

    // UTILITY FUNCTIONS

    private joinScopes(scopes: OAuthScope[]): string {
        return scopes
            .map(this.joinPermissions)
            .join(" ")
    }

    private joinPermissions(scope: OAuthScope) {
        return scope.permissions
            .map(permission => `${scope.resource}${permission}`)
            .join(" ")
    }

    getAccessTokenKey(key: string) {
        const { client_id } = this

        return `${client_id}.${key}.OAuthAccessToken`

    }

    getExpirationTimeKey(key: string) {
        const { client_id } = this
        
        return `${client_id}.${key}.OAuthExpirationTime`
    }
}

export async function fetchOAuthConfiguration(configuration_endpoint: string) {

    const result = await fetch(configuration_endpoint, { method: "GET" })
    const data: unknown = await result.json()

    if (typeof data != "object" || data == null) throw new Error(`typeof data was not of type "object".`)

    if (!("token_endpoint" in data && typeof data.token_endpoint == "string")) throw new Error(`"token_endpoint" did not exist in the configuration endpoint.`);
    if (!("authorization_endpoint" in data && typeof data.authorization_endpoint == "string")) throw new Error(`"authorization_endpoint" did not exist in the configuration endpoint.`);

    const userinfo_endpoint             = "userinfo_endpoint"               in data && typeof data.userinfo_endpoint                == "string" ? data.userinfo_endpoint                : null
    const end_session_endpoint          = "end_session_endpoint"            in data && typeof data.end_session_endpoint             == "string" ? data.end_session_endpoint             : null
    const device_authorization_endpoint = "device_authorization_endpoint"   in data && typeof data.device_authorization_endpoint    == "string" ? data.device_authorization_endpoint    : null
    const introspection_endpoint        = "introspection_endpoint"          in data && typeof data.introspection_endpoint           == "string" ? data.introspection_endpoint           : null
    const revocation_endpoint           = "revocation_endpoint"             in data && typeof data.revocation_endpoint              == "string" ? data.revocation_endpoint              : null
    const jwks_uri                      = "jwks_uri"                        in data && typeof data.jwks_uri                         == "string" ? data.jwks_uri                         : null

    const { 
        token_endpoint,
        authorization_endpoint,
    } = data

    return {
        token_endpoint,
        authorization_endpoint,
        userinfo_endpoint,
        end_session_endpoint, 
        device_authorization_endpoint,
        introspection_endpoint,
        revocation_endpoint, 
        jwks_uri,
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