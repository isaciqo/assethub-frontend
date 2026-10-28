import React from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { CheckCircle2, Clock3, ShieldAlert, ShieldCheck } from 'lucide-react';
import { Logo } from '@/components/brand/Brand';
import { MovementStatusBadge, Spinner } from '@/components/common';
import { movementsService } from '@/services/api';
import { fmtDateTime } from '@/lib/format';

// Página pública aberta pelo QR Code impresso no termo em PDF.
const Verificar: React.FC = () => {
  const { movementId } = useParams();
  const [params] = useSearchParams();
  const h = params.get('h') || undefined;
  const { data, isLoading, error } = useQuery({ queryKey: ['verify', movementId, h], queryFn: () => movementsService.verify(movementId!, h) });

  const verdict = !data ? null
    : !data.chainValid ? { icon: ShieldAlert, tone: 'text-destructive bg-destructive/10', title: 'Histórico adulterado', text: 'A cadeia de eventos desta movimentação não confere. Procure o setor de patrimônio.' }
      : data.hashMatches === false ? { icon: Clock3, tone: 'text-warning bg-warning/15', title: 'Documento desatualizado', text: 'O documento é autêntico, mas a movimentação teve novas etapas depois que este PDF foi gerado. Gere o termo novamente.' }
        : { icon: ShieldCheck, tone: 'text-success bg-success/12', title: 'Documento autêntico', text: 'O histórico desta movimentação está íntegro e corresponde ao documento apresentado.' };

  return (
    <div className="min-h-screen bg-background">
      <div className="motif-band" />
      <div className="max-w-xl mx-auto px-5 py-10">
        <Logo />
        <h1 className="font-display text-3xl font-bold mt-8">Verificação de termo</h1>
        {isLoading && <Spinner />}
        {error && <div className="mt-6 card-clay p-6 text-sm">Documento não encontrado.</div>}
        {data && verdict && (
          <div className="mt-6 space-y-4">
            <div className={`rounded-2xl p-5 flex gap-4 ${verdict.tone}`}>
              <verdict.icon className="h-8 w-8 shrink-0" />
              <div>
                <div className="font-display text-xl font-bold">{verdict.title}</div>
                <p className="text-sm mt-1 text-foreground/80">{verdict.text}</p>
              </div>
            </div>
            <div className="card-clay p-5 grid grid-cols-2 gap-4 text-sm">
              <div><div className="text-xs text-muted-foreground">Número</div><div className="font-bold">{data.number}</div></div>
              <div><div className="text-xs text-muted-foreground">Situação</div><MovementStatusBadge value={data.status} /></div>
              <div className="col-span-2"><div className="text-xs text-muted-foreground">Tipo</div><div className="font-semibold">{data.type}</div></div>
              <div><div className="text-xs text-muted-foreground">Origem</div><div className="font-semibold">{data.originUnit}</div></div>
              <div><div className="text-xs text-muted-foreground">Destino</div><div className="font-semibold">{data.destinationUnit}</div></div>
              <div><div className="text-xs text-muted-foreground">Bens</div><div className="font-semibold">{data.assetCount}</div></div>
              <div><div className="text-xs text-muted-foreground">Eventos no histórico</div><div className="font-semibold">{data.eventCount}</div></div>
              <div><div className="text-xs text-muted-foreground">Aberta em</div><div className="font-semibold">{fmtDateTime(data.createdAt)}</div></div>
              <div><div className="text-xs text-muted-foreground">Concluída em</div><div className="font-semibold">{fmtDateTime(data.completedAt)}</div></div>
              <div className="col-span-2">
                <div className="text-xs text-muted-foreground flex items-center gap-1"><CheckCircle2 className="h-3 w-3" /> Hash da cadeia (SHA-256)</div>
                <code className="text-[11px] break-all">{data.chainHead}</code>
              </div>
            </div>
            <p className="text-xs text-muted-foreground">Por proteção de dados pessoais (LGPD), esta página não exibe nomes dos participantes.</p>
          </div>
        )}
      </div>
    </div>
  );
};

export default Verificar;
