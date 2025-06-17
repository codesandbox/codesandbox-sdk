import * as Sentry from "@sentry/node";

// This can happen when the CLI uses Sentry for its own requests, but also the SDK for other requests
if (!Sentry.isInitialized()) {
  Sentry.init({
    dsn: "https://6b8a654fd32a40bdb146ae7089422e10@sentry.csbops.io/11",
    defaultIntegrations: false,
  });
}

export async function instrumentedFetch(
  request: Request,
  client: "SDK" | "CLI"
) {
  // We are cloning the request to be able to read its body on errors
  const res = await fetch(request.clone());

  if (res.status >= 400) {
    const err = new Error(`HTTP ${res.status}`);

    Sentry.captureException(err, {
      extra: {
        payload: request.body
          ? await new Response(request.body).text()
          : undefined,
        body: await res.clone().text(),
        client,
        method: request.method,
        url: request.url,
        status: res.status,
      },
    });
  }

  return res;
}
