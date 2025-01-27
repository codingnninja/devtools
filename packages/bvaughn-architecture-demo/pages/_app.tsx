import Head from "next/head";
import type { AppContext, AppProps } from "next/app";
import NextApp from "next/app";

import ErrorBoundary from "../components/ErrorBoundary";

import "./global.css";
import "./inspector.css";

interface AuthProps {
  apiKey?: string;
}

function Routing({ Component, pageProps }: AppProps) {
  return (
    <>
      <Head>
        <meta httpEquiv="Content-Type" content="text/html; charset=utf-8" />
        <link rel="icon" type="image/svg+xml" href="/images/favicon.svg" />
        <title>Replay</title>
      </Head>
      <ErrorBoundary>
        <Component {...pageProps} />
      </ErrorBoundary>
    </>
  );
}

const App = ({ apiKey, ...props }: AppProps & AuthProps) => {
  return <Routing {...props} />;
};

App.getInitialProps = (appContext: AppContext) => {
  const props = NextApp.getInitialProps(appContext);
  const authHeader = appContext.ctx.req?.headers.authorization;
  const authProps: AuthProps = { apiKey: undefined };

  if (authHeader) {
    const [scheme, token] = authHeader.split(" ", 2);
    if (!token || !/^Bearer$/i.test(scheme)) {
      console.error("Format is Authorization: Bearer [token]");
    } else {
      authProps.apiKey = token;
    }
  }

  return { ...props, ...authProps };
};

export default App;
