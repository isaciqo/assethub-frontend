# Patrimônio Ágil — App (PWA)

React 18 + Vite + TypeScript + Tailwind + shadcn/ui + TanStack Query (mesmo stack do MEDagenda),
mais PWA (Workbox), IndexedDB (`idb`), leitura de códigos (`@zxing/browser`) e OCR de plaqueta (`tesseract.js`).

```
src/
  pages/            # uma tela por arquivo (Conferencia.tsx é a conferência em campo)
  components/       # Scanner, SignaturePad, PhotoPicker, AppLayout, brand/ (marca e grafismos)
  offline/          # db.ts (IndexedDB), sync.ts (fila e sincronização), hooks.ts
  services/         # http.ts (Bearer + refresh, tolerante a offline) e api.ts
  hooks/queries.ts  # React Query
  lib/              # auth, tema, rótulos, formatação, utilidades de aparelho
```

## Rodar

```bash
cp .env.example .env     # VITE_API_BASE_URL=http://localhost:3000/api/v1
npm install
npm run dev              # http://localhost:8080
npm run build && npm run preview   # para testar o service worker/offline
```

No Docker, o nginx serve o build e faz proxy de `/api` para a API (mesma origem).

## Como o offline funciona

1. *Preparar* baixa o pacote do inventário (`GET /inventories/:id/snapshot`) para o IndexedDB e pede
   armazenamento persistente.
2. Cada conferência vira uma operação com UUID gerado no aparelho, status `PENDING`.
3. Ao voltar a conexão, a cada 30 s e no botão *Sincronizar agora*, a fila vai em lotes para
   `POST /sync/checks`. Só o que o servidor confirma vira `SYNCED`; o que ele rejeita vira `CONFLICT`.
4. O service worker guarda a "casca" do app, então ele abre e recarrega sem internet.

## Design

"Barro & Grafismo": paleta de argila, caulim, jenipapo, urucum e ocre; frisos escalonados e espirais
quadradas inspirados na cerâmica marajoara e tapajônica (`src/index.css`, `src/components/brand/Brand.tsx`).
O indicador de progresso é uma urna marajoara sendo "pintada" à medida que os bens são conferidos.
