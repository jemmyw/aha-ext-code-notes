// @ts-ignore
import { graphql } from "https://cdn.skypack.dev/@octokit/graphql";
import { lines } from "./lines";
import { parseGithubPermalink } from "./parseGithubPermalink";

export async function loadCode({
  authData,
  url,
}: {
  authData: { token: string };
  url: string;
}) {
  const api = graphql.defaults({
    headers: {
      authorization: `token ${authData.token}`,
    },
  });

  const info = parseGithubPermalink(url);
  const { owner, repo, commitSha, path, line } = info;

  const query = `
    query GetCommitTree($owner: String!, $repo: String!, $commitSha: GitObjectID) {
      repository(name: $repo, owner: $owner) {
        object(oid: $commitSha) {
          id,
          commitUrl,
          commitResourcePath,
          ... on Commit {
            tree {
              entries {
                oid
                name
                __typename
              }
            }
          }
        }
      }
    }
  `;

  const treeQuery = `
    query GetTree($owner: String!, $repo: String!, $treeSha: GitObjectID) {
      repository(name: $repo, owner: $owner) {
        object(oid: $treeSha) {
          id,
          __typename
          ... on Tree {
            entries {
              oid
              name
            }
          }
          ... on Blob {
            text
          }
        }
      }
    }
  `;

  let treeEntries = (
    await api(query, {
      owner,
      repo,
      commitSha,
    })
  ).repository.object.tree.entries as {
    oid: string;
    name: string;
    __typename: string;
  }[];

  for (let name of path) {
    const next = treeEntries.find((te) => te.name === name);
    const object = (await api(treeQuery, { owner, repo, treeSha: next.oid }))
      .repository.object;

    if (object.__typename === "Tree") {
      treeEntries = object.entries;
    } else if (object.__typename === "Blob") {
      return lines(object.text, line);
    } else {
      return "No code found";
    }
  }
}
