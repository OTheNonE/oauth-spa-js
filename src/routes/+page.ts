
export async function load({ parent }) {

    const { oauth_api_client, oauth_graph_client } = await parent()

    const oauths = [{
        name: "Microsoft Graph",
        client: oauth_graph_client
    }, {
        name: "API",
        client: oauth_api_client
    }] as const

    return { oauths }

}