import { generateCodeChallenge, generateCodeVerifier } from "../challenge"

/** 
 * Creates an APS Authentication Client.
 * 
 * Example:
 * ```ts
 * const AEC_AUTH_SERVER_URL = "https://developer.api.autodesk.com/authentication/v2"
 * 
 * const client: APSAuthClient = createAPSAuthClient({
 *     clientId: PUBLIC_AEC_APP_ID,
 *     authorizationEndpoint: `${AEC_AUTH_SERVER_URL}/authorize`,
 *     tokenEndpoint: `${AEC_AUTH_SERVER_URL}/token`,
 *     scope: ["data:read"]
 * })
 * ```
 */
export function createAPSAuthClient(options: CreateAPSAuthClientOptions): APSAuthClient {
    return new APSAuthClient(options)
}

/**
 * @param options Options object.
 */
export type CreateAPSAuthClientOptions = {
    /**
     * The Client ID of the application used.
     */
    client_id: string,
    
    /**
     * The autorization endpoint for authorizing the user (usually https://developer.api.autodesk.com/authentication/v2/authorize).
     */
    authorization_endpoint: string,

    /**
     * The token endpoint for optaining an access token (usually https://developer.api.autodesk.com/authentication/v2/token).
     */
    token_endpoint: string,

    /**
     * The user information endpoint where information of the authorized user is fetched (ussually https://api.userprofile.autodesk.com/userinfo).
     */
    user_info_endpoint?: string
    
    /**
     * The scope privilegies to give the user. (e.g. `"data:read"`)
     */
    scope: string[],
}

/**
 * The APS Authentication Client.
 */
export class APSAuthClient {
    
    /**
     * The Client ID of the application used.
     */
    readonly client_id: string

    /**
     * The scope privilegies to give the user.
     */
    readonly scope: string[]

    /**
     * The autorization endpoint for authorizing the user.
     */
    readonly authorization_endpoint: string

    /**
     * The token endpoint for optaining an access token.
     */
    readonly token_endpoint: string
 
    /**
     * The user information endpoint for fetching information of the authorized user. If null, then no endpoint has been supplied.
     */
    readonly user_info_endpoint: string | null

    /**
     * The user information.
     */
    user_info: AutodeskUserInformation | null

    /**
     * The key for retrieving the access token from local storage.
     */
    readonly ACCESS_TOKEN_KEY: string

    /**
     * The key for retrieving the refresh token from local storage.
     */
    readonly REFRESH_TOKEN_KEY: string

    /**
     * The key for retrieving the code verifier from local storage.
     */
    readonly CODE_VERIFIER_KEY: string

    /**
     * The key for retrieving the token expiration time from local storage.
     */
    readonly EXPIRATION_TIME_KEY: string

    private state_changed_callbacks: Set<(access_token: string | null) => void>
    
    constructor(options: CreateAPSAuthClientOptions) {

        this.client_id = options.client_id
        this.scope = options.scope
        this.authorization_endpoint = options.authorization_endpoint
        this.token_endpoint = options.token_endpoint
        this.user_info_endpoint = options.user_info_endpoint ?? null
        this.user_info = null

        this.ACCESS_TOKEN_KEY = `${options.client_id}.APSAccessToken`
        this.REFRESH_TOKEN_KEY = `${options.client_id}.APSRefreshToken`
        this.CODE_VERIFIER_KEY = `${options.client_id}.APSCodeVerifier`
        this.EXPIRATION_TIME_KEY = `${options.client_id}.APSExpirationTime`

        this.state_changed_callbacks = new Set()
    }

    
    /* FLOW METHODS */

    /**
     * Redirects the user to Autodesks authorization page.
     * @param options Options.
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
    async loginWithRedirect(options: LoginWithRedirectOption, additionalSearchParams?: { [key: string]: string }): Promise<void> {
        const { redirect_uri, prompt, state } = options
        const { client_id, scope, authorization_endpoint } = this

        const code_verifier = generateCodeVerifier()
        const code_challenge = await generateCodeChallenge(code_verifier)

        const url = new URL(authorization_endpoint)

        const built_in_params = { 
            client_id, 
            redirect_uri, 
            code_challenge,
            scope,
            prompt,
            state,
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
    async handleRedirectCallback(options: HandleRedirectCallbackOptions): Promise<void> {
        const { redirect_uri } = options
        const { client_id, token_endpoint } = this

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
                scope: scope.join(" "),
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
     * Log outs the user by clearing the local storage for tokens and challenges.
     * @param options Options.
     */
    logout(options: LogoutOptions = { return_to: undefined }): void {
        this.clearTokens()
        this.clearCodeVerifier()

        const { return_to } = options;
        if (return_to) window.location.href = return_to
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
     * Gets information of the authenticated user.
     */
    async getUserInfo(): Promise<AutodeskUserInformation> {
        const { user_info } = this

        console.log(user_info)

        if (user_info) return user_info
        else {
            const result = await this.fetchUserInfo()
            this.user_info = result
            return result
        }
    }

    async fetchUserInfo(): Promise<AutodeskUserInformation> {
        const { user_info_endpoint } = this

        if (!user_info_endpoint) throw new Error("No user information endpoint has been supplied to the client.")

        const access_token = await this.getAccessToken()

        if (!access_token) throw new Error("No access token was stored in local storage when fetching user information.")

        const init: RequestInit = {
            method: "GET",
            headers: { Authorization: access_token },
        }

        const result = await fetch(user_info_endpoint, init)
        const data = await result.json()

        if (result.status != 200) {
            this.clearTokens()
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

        this.notifyStateChanged()
    }

    private clearTokens() {
        const { ACCESS_TOKEN_KEY, REFRESH_TOKEN_KEY, EXPIRATION_TIME_KEY } = this
        
        localStorage.removeItem(ACCESS_TOKEN_KEY);
        localStorage.removeItem(REFRESH_TOKEN_KEY);
        localStorage.removeItem(EXPIRATION_TIME_KEY);

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
     * Subscribe to the authentication status of the client. Specifically, the given callback function is called when the `access_token` is either added- or removed from local storage.
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
     * A url to send the user to after logging out.
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

/**
* Represents a user profile information object.
*/
export type AutodeskUserInformation = {

   /** Oxygen id of the user */
   sub: string;
   
   /** Full name of the user */
   name: string;
   
   /** First name of the user */
   given_name: string;
   
   /** Last name of the user */
   family_name: string;
   
   /** Username of the user */
   preferred_username: string;
   
   /** Primary email of the user */
   email: string;
   
   /** Flag that shows if the user's email is verified or not */
   email_verified: boolean;
   
   /** URL for the profile of the user */
   profile: string;
   
   /** Profile image of the user (x120 thumbnail) */
   picture: string;
   
   /** End-User's locale, represented as a BCP47 standard (eg, en-US) */
   locale: string;
   
   /** The second-precision Unix timestamp of last modification on the user profile */
   updated_at: number;
   
   /** Flag is true if two factor authentication is enabled for this profile. */
   is_2fa_enabled: boolean;
   
   /** The country code assigned to the account at creation. */
   country_code: string;
   
   /** Object containing contact address information */
   address: object;
   
   /** The primary phone number of the user profile with country code and extension in the format: "+(countryCode) (phoneNumber) #(Extension)" */
   phone_number: string;
   
   /** Flag to tell whether or not above phone number was verified */
   phone_number_verified: boolean;
   
   /** Flag for the LDAP/SSO Status of the user, true if is ldap user. */
   ldap_enabled: boolean;
   
   /** Domain name for the LDAP user null if non LDAP user */
   ldap_domain: string;
   
   /** The job title selected on the user profile. */
   job_title: string;
   
   /** The industry selected on the user profile. */
   industry: string;
   
   /** The industry code associated on the user profile */
   industry_code: string;
   
   /** The about me text on the user profile */
   about_me: string;
   
   /** The language selected by the user */
   language: string;
   
   /** The company on the user profile */
   company: string;
   
   /** The datetime (UTC) the user was created */
   created_date: string;
   
   /** The last login date (UTC) of the user */
   last_login_date: string;
   
   /** Eidm Identifier. */
   eidm_guid: string;
   
   /** The flag that indicates if user opts in the marketing information. */
   opt_in: boolean;
   
   /** Social provider name and provider identifier when the user is a social user or else empty list. */
   social_userinfo_list: Array<object>;
   
   /** Object with profile image thumbnail urls for each size by key. */
   thumbnails: object;
};