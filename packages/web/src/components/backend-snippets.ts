/* Fragmentos "Conecta tu backend": uno por framework. Cada fragmento lee el
   header X-Request-ID (o genera uno si falta), lo devuelve en la respuesta y
   hace que las líneas de log de ese request incluyan req=<id>.
   Puro: sin JSX ni estado, lo consume el modal y el test de Node. */

export interface BackendSnippet {
  id: string;
  label: string;
  /** Línea previa al fragmento dentro del modal. */
  description: string;
  /** Ejecutado de verdad con un test (verificación real del propio repo). */
  verified: boolean;
  code: string;
}

export const BACKEND_SNIPPETS: BackendSnippet[] = [
  {
    id: "node",
    label: "Node (http)",
    verified: true,
    description: "Archivo server.js completo: cada request obtiene su id y lo loguea.",
    code: `const http = require("node:http");
const crypto = require("node:crypto");

const server = http.createServer((req, res) => {
  const requestId = req.headers["x-request-id"] || crypto.randomUUID();
  res.setHeader("X-Request-ID", requestId);
  console.log(\`req=\${requestId} \${req.method} \${req.url}\`);
  res.end("¡Hola desde Estela!");
});

const PORT = process.env.PORT ?? 3000;
server.listen(PORT, () => console.log(\`Escuchando en el puerto \${PORT}\`));
`,
  },
  {
    id: "express",
    label: "Express",
    verified: false,
    description: "Middleware global: genera el id, lo devuelve en la respuesta y loguea al terminar cada request.",
    code: `// En tu app Express existente, antes de tus rutas:
const crypto = require("node:crypto");

app.use((req, res, next) => {
  req.requestId = req.headers["x-request-id"] || crypto.randomUUID();
  res.set("X-Request-ID", req.requestId);
  res.on("finish", () => {
    console.log(\`req=\${req.requestId} \${req.method} \${req.originalUrl} → \${res.statusCode}\`);
  });
  next();
});
`,
  },
  {
    id: "fastify",
    label: "Fastify",
    verified: false,
    description: "Hooks onRequest y onResponse: el id queda expuesto como request.requestId.",
    code: `// En tu instancia Fastify existente:
const crypto = require("node:crypto");

fastify.addHook("onRequest", (request, reply, done) => {
  request.requestId = request.headers["x-request-id"] || crypto.randomUUID();
  reply.header("X-Request-ID", request.requestId);
  done();
});

fastify.addHook("onResponse", (request) => {
  console.log(\`req=\${request.requestId} \${request.method} \${request.url} → \${request.raw.statusCode}\`);
});
`,
  },
  {
    id: "nextjs",
    label: "Next.js (middleware)",
    verified: false,
    description: "middleware.ts oficial de Next: reenvía el id a tus rutas y lo devuelve en la respuesta.",
    code: `    // middleware.ts (raíz del proyecto, o src/)
import { NextResponse } from "next/server";
import type { NextRequest } from "next/server";

const REQUEST_ID_HEADER = "X-Request-ID";

export function middleware(request: NextRequest) {
  const requestId = request.headers.get(REQUEST_ID_HEADER) ?? crypto.randomUUID();

  // Reenvía el id a tu route handler para que sus logs lo incluyan:
  const headers = new Headers(request.headers);
  headers.set(REQUEST_ID_HEADER, requestId);

  const response = NextResponse.next({ request: { headers } });
  response.headers.set(REQUEST_ID_HEADER, requestId); // también en la respuesta
  return response;
}

export const config = {
  matcher: ["/api/:path*"],
};
`,
  },
  {
    id: "nestjs",
    label: "NestJS",
    verified: false,
    description: "NestMiddleware de Express bajo Nest, más su registro en AppModule.",
    code: `// request-id.middleware.ts
import { Injectable, NestMiddleware } from "@nestjs/common";
import { randomUUID } from "node:crypto";
import type { NextFunction, Request, Response } from "express";

type RequestConId = Request & { requestId: string };

@Injectable()
export class RequestIdMiddleware implements NestMiddleware {
  use(req: Request, res: Response, next: NextFunction): void {
    const request = req as RequestConId;
    const headerId = req.headers["x-request-id"];
    request.requestId = typeof headerId === "string" && headerId !== "" ? headerId : randomUUID();
    res.setHeader("X-Request-ID", request.requestId);
    res.on("finish", () => {
      console.log(\`req=\${request.requestId} \${req.method} \${req.originalUrl} → \${res.statusCode}\`);
    });
    next();
  }
}

// app.module.ts — registra el middleware:
@Module({ /* tu config */ })
export class AppModule implements NestModule {
  configure(consumer: MiddlewareConsumer): void {
    consumer.apply(RequestIdMiddleware).forRoutes("*path"); // en Nest ≤ 10: "*"
  }
}
`,
  },
  {
    id: "flask",
    label: "Flask",
    verified: false,
    description: "before_request y after_request: el id vive en g.request_id.",
    code: `import uuid

from flask import Flask, g, request

app = Flask(__name__)

@app.before_request
def before_request():
    g.request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())

@app.after_request
def add_request_id(response):
    response.headers["X-Request-ID"] = g.request_id
    print(f'req={g.request_id} {request.method} {request.path} → {response.status_code}', flush=True)
    return response
`,
  },
  {
    id: "fastapi",
    label: "FastAPI",
    verified: false,
    description: "Middleware @app.middleware(\"http\") con call_next.",
    code: `import uuid

from fastapi import FastAPI, Request

app = FastAPI()

@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    print(f"req={request_id} {request.method} {request.url.path} → {response.status_code}", flush=True)
    return response

# En tus handlers pásalo a tus logs con:
# request_id = request.headers.get("X-Request-ID")  # luego:  print(f"req={request_id} …")
`,
  },
  {
    id: "django",
    label: "Django",
    verified: false,
    description: "Middleware propio + registro en MIDDLEWARE (primero de la lista).",
    code: `# middleware.py (de tu app)
import uuid


class RequestIdMiddleware:
    def __init__(self, get_response):
        self.get_response = get_response

    def __call__(self, request):
        request.request_id = request.headers.get("X-Request-ID") or str(uuid.uuid4())
        response = self.get_response(request)
        response["X-Request-ID"] = request.request_id
        print(f"req={request.request_id} {request.method} {request.path} → {response.status_code}", flush=True)
        return response


# settings.py — agrégalo PRIMERO en la lista:
# MIDDLEWARE = ["tu_app.middleware.RequestIdMiddleware", "django.middleware.security.SecurityMiddleware", ...]
# En tus vistas: print(f'req={request.request_id} …')
`,
  },
];

export const BACKEND_ID_HINT =
  "Recomendado: corre la app con npx @estela-dev/cli -- <tu comando> y Estela captura la salida en vivo (sin archivos de log). Estela reconoce el ID en cualquier formato y en cualquier parte de la línea: basta con que el texto del ID aparezca en tu log.";
