FROM mcr.microsoft.com/playwright:v1.65.1-noble

WORKDIR /workspace
COPY tests/a11y/package.json tests/a11y/package-lock.json /workspace/tests/a11y/
RUN npm ci --prefix /workspace/tests/a11y

COPY web /workspace/web
COPY tests/a11y/server.js tests/a11y/demo.html tests/a11y/access-needs.html tests/a11y/playwright.config.js tests/a11y/a11y.spec.js /workspace/tests/a11y/
RUN mkdir -p /workspace/docs

WORKDIR /workspace/tests/a11y
ENV CI=1 A11Y_EXECUTION_ENV=docker
CMD ["npm", "test"]
