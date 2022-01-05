export function parseGithubPermalink(url: string) {
  const parts = url.split("/");
  const owner = parts[3];
  const repo = parts[4];
  const commitSha = parts[6];
  const path = parts.slice(7);

  let line: number[] = [];

  if (path.slice(-1)[0].includes("#")) {
    line = path
      .slice(-1)[0]
      .split("#")[1]
      .split("-")
      .map((l) => Number(l.slice(1)));
    const lastPath = path.slice(-1)[0].split("#")[0];
    path.pop();
    path.push(lastPath);
  }

  const file = path.slice(-1)[0];
  const key = [commitSha, path.join("/"), line.join("-")].join("#");

  return {
    owner,
    repo,
    commitSha,
    path,
    line,
    file,
    key,
  };
}
