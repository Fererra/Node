# Lab 2: database failure evidence (AC-14)

Run by hand in PowerShell on branch `lab2-working-app`, 2026-11-08, with `STORAGE=postgres` (from `.env`) and PostgreSQL in Docker Compose (service `postgres`, host port `55432`).

## Database stops while the app is running -> 503

The app was started with `npm run build` and `npm start` in another window, with the database up.

```text
PS> docker compose stop postgres
[+] stop 1/1
 ✔ Container node-postgres-1 Stopped                             0.3s

PS> curl.exe -i localhost:3000/movies
HTTP/1.1 503 Service Unavailable
content-type: application/json; charset=utf-8
x-request-id: 75fbd8f2-4735-4637-b4a3-c75c01976dc2
content-length: 148
Date: Sun, 08 Nov 2026 16:15:48 GMT
Connection: keep-alive
Keep-Alive: timeout=72

{"error":{"code":"SERVICE_UNAVAILABLE","message":"The database is unavailable, try again later","requestId":"75fbd8f2-4735-4637-b4a3-c75c01976dc2"}}
```

The response is `503` with the FR-9 error body; `requestId` in the body equals the `x-request-id` header. No stack trace or driver error reaches the client.

## App starts while the database is down -> exits with code 1

The app was stopped with `Ctrl+C` and started again while the database was still stopped.

```text
PS> npm start

> cinema-booking-service@0.1.0 start
> node --env-file-if-exists=.env scripts/start.mjs

{"level":60,"time":1794154565245,"pid":19092,"hostname":"DESKTOP-PVTGI1G",
 "err":{"type":"AggregateError","message":"",
  "stack":"AggregateError [ECONNREFUSED]: \n    at ...\\node_modules\\pg-pool\\index.js:45:11\n    at process.processTicksAndRejections (node:internal/process/task_queues:104:5)\n    at async Object.checkConnection (file:///.../dist/shared/db/database.js:32:28)\n    at async Object.<anonymous> (file:///.../dist/app/app.js:61:25)",
  "aggregateErrors":[
   {"type":"Error","message":"connect ECONNREFUSED ::1:55432","errno":-4078,"code":"ECONNREFUSED","syscall":"connect","address":"::1","port":55432},
   {"type":"Error","message":"connect ECONNREFUSED 127.0.0.1:55432","errno":-4078,"code":"ECONNREFUSED","syscall":"connect","address":"127.0.0.1","port":55432}],
  "code":"ECONNREFUSED"},
 "msg":"the app failed to start"}

PS> echo $LASTEXITCODE
1
```

The startup check (`SELECT now()` in `checkConnection`, NFR-5) fails with `ECONNREFUSED` on port `55432`, the app logs one fatal line (`level` 60) and exits with code `1` instead of starting without a database. Paths in the stack trace are shortened (`...`); the rest is verbatim.
