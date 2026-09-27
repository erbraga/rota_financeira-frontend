# Imagem de produção da SPA "Rota Financeira" (React + Vite, servida por nginx). Só o build estático (dist/)
# entra na imagem final: nenhum node_modules de desenvolvimento, código-fonte nem segredo.
#
#   docker build --build-arg VITE_API_URL=http://localhost:5000/api -t rota-financeira-web .
#   docker run -d --name rota-financeira-web -p 8080:8080 rota-financeira-web
#
# A VITE_API_URL não é segredo (é a URL pública da API que o navegador de quem usa o app chama), mas o Vite a lê
# EM TEMPO DE BUILD (embute no bundle): mudar a URL exige refazer o build da imagem, e o valor só existe neste
# estágio, nunca no estágio final.

FROM node:24-alpine AS build
WORKDIR /app

# Dependências primeiro: esta camada só é refeita quando o lockfile muda.
COPY package.json package-lock.json ./
RUN npm ci

COPY . .
ARG VITE_API_URL
ENV VITE_API_URL=${VITE_API_URL}
RUN npm run build

FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
COPY nginx.conf /etc/nginx/conf.d/default.conf

# A imagem nginx:alpine já traz o usuário/grupo "nginx" (não-root), mas os diretórios que o nginx usa em tempo
# de execução (cache e o arquivo de pid, em /run) só são graváveis por root por padrão: sem este chown, o
# processo não-root falha ao iniciar (mkdir() "/var/cache/nginx/client_temp": Permission denied). Portas abaixo
# de 1024 (como a 80) também exigem privilégio que o usuário não-root não tem, por isso o nginx.conf escuta na
# 8080 (porta alta, sem privilégio) — o host continua publicando na 8080 (docker run -p 8080:8080).
RUN chown -R nginx:nginx /var/cache/nginx /run

USER nginx
EXPOSE 8080
