import type { OAuthClient } from "$lib/client"
import { getContext, setContext } from "svelte"

const client_context_key = Symbol('auth-client-key')

export function setContextOAuthClient(client: OAuthClient) {
    return setContext(client_context_key, client)
}

export function getContextOAuthClient(): OAuthClient {
    return getContext(client_context_key)
}

export const BUILDING_COMPONENT_DATABASE_KEY = "building-component-database"