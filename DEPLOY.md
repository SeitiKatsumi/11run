# 11RUN no CapRover

## Banco Postgres

Crie um app Postgres no CapRover e copie a string de conexão interna para a variável:

```env
DATABASE_URL=postgres://USER:PASSWORD@srv-captain--NOME-DO-POSTGRES:5432/DB
```

## App

No app 11RUN, configure:

```env
NODE_ENV=production
PORT=3005
PUBLIC_BASE_URL=https://SEU-DOMINIO
DATABASE_URL=postgres://USER:PASSWORD@srv-captain--NOME-DO-POSTGRES:5432/DB
```

O `PUBLIC_BASE_URL` é o que corrige os redirects OAuth. Em produção, o callback do Strava deve ser:

```text
https://SEU-DOMINIO/api/strava/callback
```

## Deploy

Este projeto já inclui:

- `Dockerfile`
- `captain-definition`
- `db/schema.sql`
- inicialização automática das tabelas ao subir o app

Ao subir no GitHub, conecte o repositório no CapRover ou faça deploy pelo CLI.
