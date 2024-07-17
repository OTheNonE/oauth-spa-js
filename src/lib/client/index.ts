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

export function createAPSAuthClient(client_options: CreateAPSAuthClientOptionsType) {

    const ACCESS_TOKEN_KEY = `${client_options.clientId}.AECAuthToken`
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
    async function loginWithRedirect(options: LoginWithRedirectOptionType, additionalSearchParams?: { [key: string]: string | string[] }) {
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

    async function handleRedirectCallback(options: HandleRedirectCallbackOptionsType) {
        const { redirect_uri } = options
        const { clientId: client_id, tokenEndpoint } = client_options

        const code = getCodeFromSearchParams()
        const code_verifier = getCodeVerifier()
        clearCodeVerifier()

        console.log(code)
        console.log(code_verifier)

        if (!code) {
            console.error("No code exists!")
            return
        }

        if (!code_verifier) {
            console.error("No code verifier exists!")
            return
        }

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

        if (data.access_token) {
            const { refresh_token, access_token } = data
            setTokens({ refresh_token, access_token })
        } else {
            console.log(data)
        }
    }

    async function logout(options?: LogoutOptionsType) {
        clearTokens()
        clearCodeVerifier()

        const returnTo = options?.returnTo;
        if (returnTo) window.location.href = returnTo
    }

    function isAuthenticated() {
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
        isAuthenticated,
        logout,
        getTokens,
    }
}

