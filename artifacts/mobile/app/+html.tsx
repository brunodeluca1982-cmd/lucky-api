import { ScrollViewStyleReset } from "expo-router/html";
import React from "react";

export default function Root({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-BR">
      <head>
        <meta charSet="utf-8" />
        <meta httpEquiv="X-UA-Compatible" content="IE=edge" />
        <meta
          name="viewport"
          content="width=device-width, initial-scale=1, shrink-to-fit=no"
        />
        <ScrollViewStyleReset />
        <style dangerouslySetInnerHTML={{
          __html: `
            html, body, #root {
              -webkit-tap-highlight-color: transparent;
              -webkit-touch-callout: none;
            }
            * {
              -webkit-tap-highlight-color: transparent !important;
            }
            *:focus, *:focus-visible {
              outline: none !important;
              box-shadow: none !important;
            }
            input:focus, textarea:focus {
              outline: revert !important;
            }
          `
        }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
