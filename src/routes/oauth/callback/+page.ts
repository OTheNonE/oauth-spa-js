
export async function load({ parent }) {
    const { oauth_api_client, oauth_graph_client } = await parent()

    return {
        oauth_api_client,
        oauth_graph_client
    }
}