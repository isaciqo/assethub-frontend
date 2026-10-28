import React from 'react';
import { useParams } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { PackageX } from 'lucide-react';
import { EmptyState, PageHeader, Spinner } from '@/components/common';
import { AssetDetailBody } from '@/components/AssetDetail';
import { assetsService } from '@/services/api';

// Destino do QR das etiquetas: qualquer câmera de celular abre a ficha do bem.
const BemPorCodigo: React.FC = () => {
  const { code } = useParams();
  const { data, isLoading } = useQuery({ queryKey: ['asset-code', code], queryFn: () => assetsService.byCode(code!), retry: false });
  if (isLoading) return <Spinner />;
  if (!data) return <EmptyState icon={PackageX} title={`Tombamento ${code} não encontrado`} description="O código não existe na base ou você está sem conexão." />;
  return (
    <div className="animate-fade-in max-w-2xl">
      <PageHeader eyebrow={`Tombamento ${data.asset.code}`} title={data.asset.description} />
      <div className="card-clay p-5"><AssetDetailBody data={data} /></div>
    </div>
  );
};

export default BemPorCodigo;
