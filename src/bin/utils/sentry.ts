let Sentry: typeof import("@sentry/node") | null = null;
let sentryInitialized = false;

// Function to initialize Sentry if conditions are met
async function initializeSentry() {
  if (sentryInitialized) return;

  // Only initialize Sentry if the CODESANDBOX_SENTRY_ENABLED environment variable is set to "true"
  // and the @sentry/node package is available
  if (process.env.CODESANDBOX_SENTRY_ENABLED === "true") {
    try {
      Sentry = await import("@sentry/node");

      // This can happen when the CLI uses Sentry for its own requests, but also the SDK for other requests
      if (!Sentry.isInitialized()) {
        Sentry.init({
          dsn: "https://6b8a654fd32a40bdb146ae7089422e10@sentry.csbops.io/11",
          defaultIntegrations: false,
        });
      }
    } catch (error) {
      // Sentry is not available, continue without it
      console.warn(
        "Sentry error reporting is enabled but @sentry/node is not available. Install it as a dependency to enable error reporting."
      );
    }
  }

  sentryInitialized = true;
}

export async function instrumentedFetch(request: Request) {
  // Initialize Sentry if needed
  await initializeSentry();

  // We are cloning the request to be able to read its body on errors
  const res = await fetch(request.clone());

  if (res.status >= 400 && Sentry) {
    const err = new Error(`HTTP ${res.status}`);

    Sentry.captureException(err, {
      extra: {
        payload: request.body
          ? await new Response(request.body).text()
          : undefined,
        body: await res.clone().text(),
        client: "SDK-CLI",
        method: request.method,
        url: request.url,
        status: res.status,
      },
    });
  }

  return res;
}
