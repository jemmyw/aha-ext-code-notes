import { gql, GraphQLClient, RequestDocument } from "graphql-request";
const IDENTIFIER = "kealabs.code-notes";

export interface CodeNote {
  key: string;
  url: string;
  file: string;
  line: [number, number];
  path: string[];
  repo: string;
  owner: string;
  commitSha: string;
  recordType: string;
  referenceNum: string;
}

export class AhaApi {
  client: GraphQLClient;

  constructor(
    private subdomain: string,
    private token: string,
    private domain: string = ".aha.io"
  ) {
    this.client = new GraphQLClient(`https://${this.subdomain}${this.domain}/api/v2/graphql`, {
      headers: {
        Authorization: `Bearer ${this.token}`,
      },
    });
  }

  request<T>(query: RequestDocument, variables = {}) {
    return this.client.request<T>(query, variables);
  }

  async fetchNotes() {
    const query = gql`
      query FetchNotes($filters: ExtensionFieldFilters) {
        account {
          extensionFields(filters: $filters) {
            name
            value
          }
        }
      }
    `;

    const response = (await this.request(query, {
      filters: { extensionIdentifier: IDENTIFIER },
    })) as any;

    const notes = response.account.extensionFields.map(
      (n: any) => n.value
    ) as CodeNote[];

    return notes;
  }
}
