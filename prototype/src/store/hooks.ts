import { useMemo } from 'react'
import { useStore } from './store'
import type { Dataset } from '@/data/generate'

/** Jeu de données de l'entreprise active. */
export const useDs = (): Dataset => useStore((s) => s.data[s.companyId])

/** Index par identifiant, recalculés seulement quand la collection change. */
export function useLookups() {
  const ds = useDs()
  const clients = useMemo(() => new Map(ds.clients.map((c) => [c.id, c])), [ds.clients])
  const techs = useMemo(() => new Map(ds.technicians.map((t) => [t.id, t])), [ds.technicians])
  const quotes = useMemo(() => new Map(ds.quotes.map((q) => [q.id, q])), [ds.quotes])
  const jobs = useMemo(() => new Map(ds.jobs.map((j) => [j.id, j])), [ds.jobs])
  const invoices = useMemo(() => new Map(ds.invoices.map((i) => [i.id, i])), [ds.invoices])
  const requests = useMemo(() => new Map(ds.requests.map((r) => [r.id, r])), [ds.requests])
  return { ds, clients, techs, quotes, jobs, invoices, requests }
}

export function addressOf(ds: Dataset, clientId: string, addressId: string) {
  return ds.clients.find((c) => c.id === clientId)?.addresses.find((a) => a.id === addressId)
}
