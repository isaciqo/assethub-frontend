import React, { Suspense, lazy, useEffect } from 'react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { BrowserRouter, Navigate, Route, Routes, useLocation } from 'react-router-dom';
import { Toaster } from '@/components/ui/sonner';
import { TooltipProvider } from '@/components/ui/tooltip';
import { AuthProvider, useAuth } from '@/lib/auth-context';
import { ThemeProvider } from '@/lib/theme';
import { AppLayout } from '@/components/AppLayout';
import { Spinner } from '@/components/common';
import { startAutoSync } from '@/offline/sync';
import type { ApiError } from '@/types';
import Login from '@/pages/Login';
import Painel from '@/pages/Painel';
import Inventarios from '@/pages/Inventarios';
import InventarioDetalhe from '@/pages/InventarioDetalhe';
import Conferir from '@/pages/Conferir';
import Conferencia from '@/pages/Conferencia';
import Pendencias from '@/pages/Pendencias';
import Movimentacoes from '@/pages/Movimentacoes';
import NovaMovimentacao from '@/pages/NovaMovimentacao';
import MovimentacaoDetalhe from '@/pages/MovimentacaoDetalhe';
import Bens from '@/pages/Bens';
import BemPorCodigo from '@/pages/BemPorCodigo';
import Importar from '@/pages/Importar';
import Sincronizacao from '@/pages/Sincronizacao';
import Verificar from '@/pages/Verificar';
import NotFound from '@/pages/NotFound';

// Etiquetas carrega a lib de QR — só quando a tela for aberta.
const Etiquetas = lazy(() => import('@/pages/Etiquetas'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (count, error) => {
        const e = error as unknown as ApiError;
        if (e?.offline) return false;
        if (e?.statusCode >= 400 && e?.statusCode < 500) return false;
        return count < 2;
      },
      refetchOnWindowFocus: true,
    },
  },
});

const Protected: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  const location = useLocation();
  if (!isAuthenticated) return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  return <>{children}</>;
};

const PublicOnly: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (isAuthenticated) return <Navigate to="/painel" replace />;
  return <>{children}</>;
};

const AppRoutes = () => {
  const { isAuthenticated } = useAuth();
  useEffect(() => { if (isAuthenticated) startAutoSync(); }, [isAuthenticated]);

  return (
    <Routes>
      <Route path="/login" element={<PublicOnly><Login /></PublicOnly>} />
      <Route path="/verificar/:movementId" element={<Verificar />} />
      <Route element={<Protected><AppLayout /></Protected>}>
        <Route path="/" element={<Navigate to="/painel" replace />} />
        <Route path="/painel" element={<Painel />} />
        <Route path="/inventarios" element={<Inventarios />} />
        <Route path="/inventarios/:id" element={<InventarioDetalhe />} />
        <Route path="/conferir" element={<Conferir />} />
        <Route path="/conferir/:inventoryId" element={<Conferencia />} />
        <Route path="/pendencias" element={<Pendencias />} />
        <Route path="/movimentacoes" element={<Movimentacoes />} />
        <Route path="/movimentacoes/nova" element={<NovaMovimentacao />} />
        <Route path="/movimentacoes/:id" element={<MovimentacaoDetalhe />} />
        <Route path="/bens" element={<Bens />} />
        <Route path="/b/:code" element={<BemPorCodigo />} />
        <Route path="/importar" element={<Importar />} />
        <Route path="/etiquetas" element={<Suspense fallback={<Spinner />}><Etiquetas /></Suspense>} />
        <Route path="/sincronizacao" element={<Sincronizacao />} />
      </Route>
      <Route path="*" element={<NotFound />} />
    </Routes>
  );
};

const App = () => (
  <ThemeProvider>
    <QueryClientProvider client={queryClient}>
      <TooltipProvider>
        <Toaster />
        <AuthProvider>
          <BrowserRouter>
            <AppRoutes />
          </BrowserRouter>
        </AuthProvider>
      </TooltipProvider>
    </QueryClientProvider>
  </ThemeProvider>
);

export default App;
