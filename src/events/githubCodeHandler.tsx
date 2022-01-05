import React, { useEffect, useRef, useState } from "react";
import { loadCode } from "../lib/loadCode";
import { parseGithubPermalink } from "../lib/parseGithubPermalink";

function isLink(uri: string) {
  const url = new URL(uri);
  if (url.host !== "github.com") return false;
  return /\/blob\//.test(url.pathname);
}

function Code({ authData, url }) {
  const [loading, setLoading] = useState(true);
  const [code, setCode] = useState("");

  useEffect(() => {
    loadCode({ authData, url }).then((code) => {
      setCode(code);
      setLoading(false);
    });
  }, []);

  return (
    <div
      style={{
        border: "1px solid var(--aha-gray-500)",
        padding: "4px",
        display: "flex",
        flexDirection: "column",
      }}
    >
      <div>
        <a href={url} target="_blank">
          {url}
        </a>
      </div>
      {loading && <div>Loading from GitHub</div>}
      {!loading && (
        <div>
          <pre>{code}</pre>
        </div>
      )}
    </div>
  );
}

function render(item) {
  const { url } = item;
  const [authState, setAuthState] = useState<
    "unknown" | "authed" | "loggedOut" | "logIn"
  >("unknown");
  const [authData, setAuthData] = useState(null);
  const mounted = useRef(false);

  useEffect(() => {
    mounted.current = true;
    return () => {
      mounted.current = false;
    };
  });

  const login: React.MouseEventHandler<any> = (event) => {
    event.preventDefault();

    if (mounted && authState === "loggedOut") {
      setAuthState("logIn");
    }
  };

  useEffect(() => {
    if (authState === "authed") return;
    if (authState === "unknown") {
      aha
        .auth("github", { useCachedRetry: true, reAuth: false })
        .then((authData) => {
          if (!mounted) return;
          setAuthData(authData);
          setAuthState("authed");
        })
        .catch((err) => {
          if (!mounted) return;
          setAuthState("loggedOut");
        });
    }
    if (authState === "logIn") {
      aha
        .auth("github", { useCachedRetry: true, reAuth: true })
        .then((authData) => {
          if (!mounted) return;
          setAuthData(authData);
          setAuthState("authed");
        })
        .catch((err) => {
          if (!mounted) return;
          setAuthState("loggedOut");
        });
    }
  }, [authState]);

  if (authState === "authed") return <Code authData={authData} url={url} />;
  if (authState === "loggedOut")
    return (
      <span>
        <button onClick={login}>Log in to GitHub</button>
      </span>
    );
  return <span>...</span>;
}

function linkCallback(identifier: string) {
  return async ({ record, url }) => {
    console.log("linkCallback", url);
    const info = parseGithubPermalink(url);

    await aha.account.setExtensionField(identifier, info.key, {
      url,
      ...info,
      recordType: record.typename,
      referenceNum: record.referenceNum,
    });
  };
}

aha.on(
  { event: "aha.editor.referenceExtension" },
  (callback, { identifier, settings }) => {
    callback({
      identifier,
      name: "Code",
      render,
      isLink,
      linkCallback: linkCallback(identifier),
    });
  }
);
