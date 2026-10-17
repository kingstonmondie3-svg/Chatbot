import { useMemo } from "react";

interface SandboxIframeProps {
  content: string;
  artifactType: "html" | "react";
}

function buildSandboxHtml(content: string, artifactType: string): string {
  // For react artifacts, wrap in a minimal React setup if not already a full HTML document
  let body = content;
  const headExtras = "";

  if (artifactType === "react" && !content.includes("<html")) {
    // Wrap JSX in a React-renderable page
    body = `<div id="root"></div>
<script src="https://unpkg.com/@babel/standalone/babel.min.js"></script>
<script src="https://unpkg.com/react@18/umd/react.production.min.js"></script>
<script src="https://unpkg.com/react-dom@18/umd/react-dom.production.min.js"></script>
<script type="text/babel">
  ${content}
  const rootEl = document.getElementById("root");
  const root = ReactDOM.createRoot(rootEl);
  // Try to find a default export or App component
  const AppComponent = typeof App !== "undefined" ? App : typeof default_1 !== "undefined" ? default_1 : null;
  if (AppComponent) {
    root.render(React.createElement(AppComponent));
  } else {
    rootEl.innerHTML = "<p style='color:red'>No App component found</p>";
  }
</script>`;
  }

  if (artifactType === "html" && !content.includes("<html")) {
    body = content;
  }

  const csp = [
    "default-src 'none'",
    "script-src 'self' 'unsafe-inline' https://unpkg.com",
    "style-src 'self' 'unsafe-inline'",
    "img-src data: https:",
    "font-src 'self'",
    "connect-src 'none'",
    "frame-src 'none'",
    "object-src 'none'",
    "base-uri 'none'",
    "form-action 'none'",
  ].join("; ");

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta http-equiv="Content-Security-Policy" content="${csp}">
  ${headExtras}
  <style>
    body { margin: 0; padding: 16px; font-family: system-ui, sans-serif; }
  </style>
</head>
<body>
${body}
</body>
</html>`;
}

export function SandboxIframe({ content, artifactType }: SandboxIframeProps) {
  const srcdoc = useMemo(
    () => buildSandboxHtml(content, artifactType),
    [content, artifactType],
  );

  return (
    <iframe
      sandbox="allow-scripts"
      srcDoc={srcdoc}
      className="h-full w-full border-0"
      title={`${artifactType} artifact preview`}
    />
  );
}
