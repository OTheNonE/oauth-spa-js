import type { APSAuthClient, createAPSAuthClient } from "$lib/client"
import { getContext, setContext } from "svelte"

const client_context_key = Symbol('auth-client-key')

export function setContextAPSAuthClient(client: APSAuthClient) {
    return setContext(client_context_key, client)
}

export function getContextAPSAuthClient(): APSAuthClient {
    return getContext(client_context_key)
}