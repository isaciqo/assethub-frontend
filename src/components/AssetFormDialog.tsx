import React, { useEffect, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { Loader2, Save } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Field, NativeSelect } from '@/components/common';
import { useFacets, useUnits } from '@/hooks/queries';
import { assetsService } from '@/services/api';
import { CONSERVATION, CONSERVATION_ORDER } from '@/lib/labels';
import { cn } from '@/lib/utils';
import { toast } from '@/components/ui/sonner';
import type { ApiError, Asset, Conservation } from '@/types';

// Cadastro avulso (chegada de um bem novo) e ajuste administrativo de um bem
// existente — estado, local, responsável e baixa. Toda alteração vira evento
// na linha do tempo do bem (backend: UpdateAssetOperation).
interface Props {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  asset?: Asset | null;
  onSaved?: (a: Asset) => void;
}

const empty = {
  code: '', description: '', category: '', brand: '', serial_number: '', unit_id: '', location: '',
  responsible_name: '', conservation_status: 'novo' as Conservation, status: 'ativo', value: '', notes: '',
};

export const AssetFormDialog: React.FC<Props> = ({ open, onOpenChange, asset, onSaved }) => {
  const editing = !!asset;
  const qc = useQueryClient();
  const { data: units = [] } = useUnits();
  const [f, setF] = useState(empty);
  const { data: facets } = useFacets(f.unit_id || undefined);

  useEffect(() => {
    if (!open) return;
    setF(asset ? {
      code: asset.code, description: asset.description, category: asset.category, brand: asset.brand,
      serial_number: asset.serialNumber, unit_id: asset.unitId, location: asset.location,
      responsible_name: asset.responsibleName, conservation_status: asset.conservationStatus,
      status: asset.status, value: asset.value != null ? String(asset.value) : '', notes: asset.notes,
    } : empty);
  }, [open, asset]);

  const set = (patch: Partial<typeof empty>) => setF(prev => ({ ...prev, ...patch }));
  const unitLocations = units.find(u => u.id === f.unit_id)?.locations || facets?.locations || [];

  const save = useMutation({
    mutationFn: () => {
      const value = f.value.trim() ? Number(f.value.replace(/\./g, '').replace(',', '.')) : null;
      const common = {
        description: f.description, category: f.category, brand: f.brand, serial_number: f.serial_number,
        location: f.location, responsible_name: f.responsible_name, conservation_status: f.conservation_status,
        value, notes: f.notes,
      };
      return editing
        ? assetsService.update(asset!.id, { ...common, ...(asset!.activeMovementId ? {} : { status: f.status }) })
        : assetsService.create({ ...common, code: f.code, unit_id: f.unit_id });
    },
    onSuccess: saved => {
      qc.invalidateQueries({ queryKey: ['assets'] });
      qc.invalidateQueries({ queryKey: ['asset'] });
      qc.invalidateQueries({ queryKey: ['facets'] });
      qc.invalidateQueries({ queryKey: ['units'] });
      qc.invalidateQueries({ queryKey: ['dashboard'] });
      toast.success(editing ? 'Bem atualizado — alteração registrada no histórico' : `Bem ${saved.code} cadastrado`);
      onOpenChange(false);
      onSaved?.(saved);
    },
    onError: (e: ApiError) => toast.error(e.message),
  });

  const inMovement = !!asset?.activeMovementId;
  const valid = f.description.trim().length >= 2 && (editing || (f.code.trim() && f.unit_id));

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="rounded-2xl max-w-2xl max-h-[92vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="font-display">{editing ? `Editar bem ${asset!.code}` : 'Cadastrar bem'}</DialogTitle>
          <DialogDescription>
            {editing
              ? 'Ajuste administrativo. Para mudar o bem de lugar ou de responsável com entrega e recebimento assinados, prefira uma movimentação.'
              : 'Use para a chegada de um bem avulso. Para vários bens de uma vez, importe a planilha.'}
          </DialogDescription>
        </DialogHeader>

        <div className="grid sm:grid-cols-2 gap-4">
          {!editing && (
            <>
              <Field label="Tombamento *" htmlFor="af-code"><Input id="af-code" value={f.code} onChange={e => set({ code: e.target.value })} placeholder="Ex.: 0100950" /></Field>
              <Field label="Unidade *" htmlFor="af-unit">
                <NativeSelect id="af-unit" value={f.unit_id} onChange={e => set({ unit_id: e.target.value })}>
                  <option value="">Selecione…</option>
                  {units.map(u => <option key={u.id} value={u.id}>{u.name}</option>)}
                </NativeSelect>
              </Field>
            </>
          )}
          <Field label="Descrição *" htmlFor="af-desc" className="sm:col-span-2"><Input id="af-desc" value={f.description} onChange={e => set({ description: e.target.value })} /></Field>
          <Field label="Categoria" htmlFor="af-cat">
            <Input id="af-cat" list="af-cats" value={f.category} onChange={e => set({ category: e.target.value })} />
            <datalist id="af-cats">{facets?.categories.map(c => <option key={c} value={c} />)}</datalist>
          </Field>
          <Field label="Marca/modelo" htmlFor="af-brand"><Input id="af-brand" value={f.brand} onChange={e => set({ brand: e.target.value })} /></Field>
          <Field label="Nº de série" htmlFor="af-serial"><Input id="af-serial" value={f.serial_number} onChange={e => set({ serial_number: e.target.value })} /></Field>
          <Field label="Valor (R$)" htmlFor="af-value"><Input id="af-value" inputMode="decimal" value={f.value} onChange={e => set({ value: e.target.value })} placeholder="1.890,00" /></Field>
          <Field label="Localização" htmlFor="af-loc">
            <Input id="af-loc" list="af-locs" value={f.location} onChange={e => set({ location: e.target.value })} />
            <datalist id="af-locs">{unitLocations.map(l => <option key={l} value={l} />)}</datalist>
          </Field>
          <Field label="Responsável" htmlFor="af-resp">
            <Input id="af-resp" list="af-resps" value={f.responsible_name} onChange={e => set({ responsible_name: e.target.value })} />
            <datalist id="af-resps">{facets?.responsibles.map(r => <option key={r} value={r} />)}</datalist>
          </Field>
          <Field label="Estado de conservação" className="sm:col-span-2">
            <div className="grid grid-cols-5 gap-1.5" role="radiogroup" aria-label="Estado de conservação">
              {CONSERVATION_ORDER.map(c => (
                <button key={c} type="button" role="radio" aria-checked={f.conservation_status === c} onClick={() => set({ conservation_status: c })}
                  className={cn('rounded-xl border py-2 text-xs font-bold', f.conservation_status === c ? 'bg-primary text-primary-foreground border-primary' : 'hover:bg-accent')}>
                  {CONSERVATION[c].label}
                </button>
              ))}
            </div>
          </Field>
          {editing && (
            <Field label="Situação" htmlFor="af-status" hint={inMovement ? 'Bem em movimentação: a situação muda quando a movimentação terminar.' : 'Baixado: sai dos próximos inventários e não pode ser movimentado.'}>
              <NativeSelect id="af-status" value={f.status} disabled={inMovement} onChange={e => set({ status: e.target.value })}>
                {inMovement && <option value="em_movimentacao">Em movimentação</option>}
                <option value="ativo">Ativo</option>
                <option value="nao_localizado">Não localizado</option>
                <option value="baixado">Baixado (descarte/alienação)</option>
              </NativeSelect>
            </Field>
          )}
          <Field label="Observações" htmlFor="af-notes" className={editing ? '' : 'sm:col-span-2'}>
            <Textarea id="af-notes" rows={2} value={f.notes} onChange={e => set({ notes: e.target.value })} placeholder={editing ? 'Motivo do ajuste (fica no histórico)' : 'Nota fiscal, processo de compra…'} />
          </Field>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancelar</Button>
          <Button disabled={!valid || save.isPending} onClick={() => save.mutate()}>
            {save.isPending ? <Loader2 className="animate-spin" /> : <Save />} {editing ? 'Salvar ajuste' : 'Cadastrar'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
