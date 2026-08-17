"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  checkoutSale,
  getClientsBatch,
  getProductsBatch,
  searchClientsOnline,
  searchProductsOnline,
  type DebtPlanInput,
} from "./actions";
import { QuickAddClientDialog } from "./quick-add-client-dialog";
import {
  cacheClients,
  cacheProducts,
  getCachedClients,
  getCachedProducts,
  getPendingCount,
  queueOfflineSale,
  syncPendingOutbox,
} from "@/lib/offline/sync";

export type PosProduct = {
  id: string;
  skuCode: string;
  barcode: string | null;
  name: string;
  unit: string;
  salePrice: string;
  stockQty: number;
};

export type PosClient = {
  id: string;
  fullName: string;
  phone: string;
};

function defaultFirstDueDate() {
  const d = new Date();
  d.setMonth(d.getMonth() + 1);
  return d.toISOString().slice(0, 10);
}

type CartLine = {
  product: PosProduct;
  qty: number;
};

function formatMoney(n: number) {
  return new Intl.NumberFormat("ru-RU").format(n);
}

function saveSaleToOutbox(sale: {
  clientUuid: string;
  clientId: string;
  items: { productId: string; qty: number }[];
  paymentType: "cash" | "card";
  total: number;
}) {
  return queueOfflineSale({ ...sale, createdAt: Date.now(), status: "pending" });
}

const SYNC_CHUNK_SIZE = 1000;

async function backgroundSyncCatalog<T>(
  fetchBatch: (offset: number, limit: number) => Promise<T[]>,
  store: (items: T[]) => Promise<void>,
) {
  let offset = 0;
  const all: T[] = [];
  for (;;) {
    const batch = await fetchBatch(offset, SYNC_CHUNK_SIZE);
    all.push(...batch);
    if (batch.length < SYNC_CHUNK_SIZE) break;
    offset += SYNC_CHUNK_SIZE;
  }
  await store(all);
}

export function PosScreen() {
  // Local IndexedDB-backed catalog, used only for offline search. Online
  // search always hits the server instead — the catalog can be far too
  // large to hold in memory as the single source of truth for typing.
  const [offlineCatalog, setOfflineCatalog] = useState<PosProduct[]>([]);
  const [offlineClients, setOfflineClients] = useState<PosClient[]>([]);

  const [cart, setCart] = useState<Map<string, CartLine>>(new Map());
  const [search, setSearch] = useState("");
  const [results, setResults] = useState<PosProduct[]>([]);
  const [searching, setSearching] = useState(false);

  const [resolvedClient, setResolvedClient] = useState<PosClient | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<PosClient[]>([]);

  const [paymentType, setPaymentType] = useState<"cash" | "card" | "debt">("cash");
  const [installments, setInstallments] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState(defaultFirstDueDate);
  const [markupPercent, setMarkupPercent] = useState(0);
  const [checkingOut, setCheckingOut] = useState(false);
  const [clientUuid, setClientUuid] = useState(() => crypto.randomUUID());
  // Always starts true to match the server-rendered markup exactly (Node
  // has no `navigator`, so SSR can't know real connectivity). Corrected
  // client-side immediately after mount in the effect below — doing it any
  // earlier would make the first client render diverge from the SSR HTML
  // and trigger a hydration mismatch.
  const [isOnline, setIsOnline] = useState(true);
  const [pendingCount, setPendingCount] = useState(0);
  const searchInputRef = useRef<HTMLInputElement>(null);

  // Load whatever offline cache already exists immediately (near-instant,
  // just IndexedDB), then kick off a background refresh from the server in
  // chunks. Neither blocks the page: the offline cache covers search until
  // the refresh finishes, and online search never depends on either.
  useEffect(() => {
    void getCachedProducts().then(setOfflineCatalog);
    void getCachedClients().then(setOfflineClients);

    if (navigator.onLine) {
      void backgroundSyncCatalog(getProductsBatch, async (all) => {
        await cacheProducts(all);
        setOfflineCatalog(all);
      });
      void backgroundSyncCatalog(getClientsBatch, async (all) => {
        await cacheClients(all);
        setOfflineClients(all);
      });
      // Client-navigation to this page only ever fetches RSC payloads, not
      // the full document, so the service worker never gets a full-page
      // snapshot to serve on a later offline reload. A plain fetch() here
      // requests the full HTML document and warms that cache entry.
      fetch(window.location.pathname).catch(() => {});
    }
  }, []);

  async function refreshPendingCount() {
    setPendingCount(await getPendingCount());
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- navigator.onLine only exists in the browser; syncing it post-mount is required, not optional
    setIsOnline(navigator.onLine);

    async function trySync() {
      if (navigator.onLine) {
        const { synced } = await syncPendingOutbox();
        if (synced > 0) {
          toast.success(`Синхронизировано офлайн-продаж: ${synced}`);
        }
      }
      await refreshPendingCount();
    }

    function handleOnline() {
      setIsOnline(true);
      void trySync();
    }
    function handleOffline() {
      setIsOnline(false);
    }

    window.addEventListener("online", handleOnline);
    window.addEventListener("offline", handleOffline);
    void trySync();
    const interval = setInterval(trySync, 15000);

    return () => {
      window.removeEventListener("online", handleOnline);
      window.removeEventListener("offline", handleOffline);
      clearInterval(interval);
    };
  }, []);

  // Product search — debounced, server-backed while online, offline cache
  // otherwise. Never depends on the full catalog being in memory.
  useEffect(() => {
    const q = search.trim();
    if (!q) return;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flips a loading flag for the debounced fetch below; there's no derivable value to replace it with
    setSearching(true);
    const timer = setTimeout(async () => {
      if (navigator.onLine) {
        try {
          setResults(await searchProductsOnline(q));
        } catch {
          setResults(filterLocalProducts(offlineCatalog, q));
        }
      } else {
        setResults(filterLocalProducts(offlineCatalog, q));
      }
      setSearching(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, offlineCatalog]);

  // Client search — same online/offline split.
  useEffect(() => {
    const q = clientQuery.trim();
    if (!q) return;
    const timer = setTimeout(async () => {
      if (navigator.onLine) {
        try {
          setClientResults(await searchClientsOnline(q));
        } catch {
          setClientResults(filterLocalClients(offlineClients, q));
        }
      } else {
        setClientResults(filterLocalClients(offlineClients, q));
      }
    }, 250);
    return () => clearTimeout(timer);
  }, [clientQuery, offlineClients]);

  function addToCart(product: PosProduct) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      next.set(product.id, { product, qty: (existing?.qty ?? 0) + 1 });
      return next;
    });
    setSearch("");
    setResults([]);
    searchInputRef.current?.focus();
  }

  function setQty(productId: string, qty: number) {
    setCart((prev) => {
      const next = new Map(prev);
      const line = next.get(productId);
      if (!line) return prev;
      if (qty <= 0) {
        next.delete(productId);
      } else {
        next.set(productId, { ...line, qty });
      }
      return next;
    });
  }

  function removeFromCart(productId: string) {
    setCart((prev) => {
      const next = new Map(prev);
      next.delete(productId);
      return next;
    });
  }

  async function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = search.trim();
    if (!q) return;

    // A barcode scan resolves to exactly one match; typing that also
    // matches one result naturally hits the same path.
    if (results.length === 1) {
      addToCart(results[0]);
      return;
    }

    const exact = navigator.onLine
      ? (await searchProductsOnline(q).catch(() => []))[0]
      : offlineCatalog.find(
          (p) => p.barcode?.toLowerCase() === q.toLowerCase() || p.skuCode.toLowerCase() === q.toLowerCase(),
        );
    if (exact) addToCart(exact);
  }

  const lines = Array.from(cart.values());
  const total = lines.reduce(
    (sum, l) => sum + Number(l.product.salePrice) * l.qty,
    0,
  );

  async function handleCheckout() {
    if (lines.length === 0) return;
    if (!resolvedClient) {
      toast.error("Выберите клиента — без клиента продажа невозможна");
      return;
    }
    setCheckingOut(true);
    const items = lines.map((l) => ({ productId: l.product.id, qty: l.qty }));
    const uuid = clientUuid;
    const clientId = resolvedClient.id;
    const debtPlan: DebtPlanInput | undefined =
      paymentType === "debt" ? { installments, firstDueDate, markupPercent } : undefined;

    function resetForm() {
      setCart(new Map());
      setClientUuid(crypto.randomUUID());
      setResolvedClient(null);
      setClientQuery("");
      setInstallments(1);
      setMarkupPercent(0);
    }

    if (!navigator.onLine) {
      if (paymentType === "debt") {
        setCheckingOut(false);
        toast.error("Продажа в долг недоступна офлайн — дождитесь подключения к интернету");
        return;
      }
      await saveSaleToOutbox({ clientUuid: uuid, clientId, items, paymentType, total });
      // optimistic local stock decrement so this cashier doesn't oversell
      // against their own cached view while offline
      const decremented = offlineCatalog.map((p) => {
        const line = cart.get(p.id);
        return line ? { ...p, stockQty: p.stockQty - line.qty } : p;
      });
      setOfflineCatalog(decremented);
      await cacheProducts(decremented);
      toast.warning("Нет соединения — продажа сохранена локально и будет отправлена автоматически");
      resetForm();
      setCheckingOut(false);
      await refreshPendingCount();
      searchInputRef.current?.focus();
      return;
    }

    try {
      const res = await checkoutSale(uuid, items, paymentType, clientId, { debtPlan });
      setCheckingOut(false);

      if (res.ok) {
        toast.success(
          `Продажа оформлена: ${formatMoney(Number(res.total))} сум. Чек отправлен клиенту.`,
        );
        resetForm();
      } else {
        toast.error(res.error);
      }
    } catch {
      // network failed mid-flight — fall back to the offline queue rather
      // than losing a checkout the cashier already confirmed
      setCheckingOut(false);
      if (paymentType === "debt") {
        toast.error("Не удалось оформить продажу в долг — попробуйте ещё раз");
      } else {
        await saveSaleToOutbox({ clientUuid: uuid, clientId, items, paymentType, total });
        toast.warning("Нет соединения — продажа сохранена локально и будет отправлена автоматически");
        resetForm();
        await refreshPendingCount();
      }
    }
    searchInputRef.current?.focus();
  }

  return (
    <div className="flex-1 flex flex-col">
      <div className="px-4 pt-3 flex items-center gap-2">
        <Badge variant={isOnline ? "default" : "destructive"}>
          {isOnline ? "Онлайн" : "Офлайн"}
        </Badge>
        {pendingCount > 0 && (
          <Badge variant="secondary">Ожидают синхронизации: {pendingCount}</Badge>
        )}
      </div>

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4">
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <div className="relative">
            <Input
              ref={searchInputRef}
              autoFocus
              placeholder="Сканируйте штрихкод или введите артикул / название..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              onKeyDown={handleSearchKeyDown}
            />
            {search.trim() && (results.length > 0 || searching) && (
              <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-80 overflow-y-auto">
                {results.map((p) => (
                  <button
                    key={p.id}
                    type="button"
                    onClick={() => addToCart(p)}
                    className="w-full text-left px-3 py-2 hover:bg-accent flex items-center justify-between gap-2 text-sm"
                  >
                    <span className="flex flex-col">
                      <span>{p.name}</span>
                      <span className="text-xs text-muted-foreground font-mono">
                        {p.skuCode}
                        {p.barcode ? ` · ${p.barcode}` : ""}
                      </span>
                    </span>
                    <span className="flex items-center gap-2 whitespace-nowrap">
                      <span className="font-medium">{formatMoney(Number(p.salePrice))}</span>
                      <span
                        className={
                          p.stockQty <= 0 ? "text-destructive text-xs" : "text-xs text-muted-foreground"
                        }
                      >
                        ост. {p.stockQty}
                      </span>
                    </span>
                  </button>
                ))}
                {searching && results.length === 0 && (
                  <div className="px-3 py-2 text-sm text-muted-foreground">Поиск...</div>
                )}
              </div>
            )}
          </div>

          <div className="rounded-md border bg-background flex-1">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Товар</TableHead>
                  <TableHead className="text-right">Цена</TableHead>
                  <TableHead className="text-right w-32">Кол-во</TableHead>
                  <TableHead className="text-right">Сумма</TableHead>
                  <TableHead />
                </TableRow>
              </TableHeader>
              <TableBody>
                {lines.length === 0 && (
                  <TableRow>
                    <TableCell colSpan={5} className="text-center text-muted-foreground py-10">
                      Корзина пуста. Отсканируйте товар или найдите его через поиск.
                    </TableCell>
                  </TableRow>
                )}
                {lines.map((l) => (
                  <TableRow key={l.product.id}>
                    <TableCell>
                      <div className="flex flex-col">
                        <span>{l.product.name}</span>
                        <span className="text-xs text-muted-foreground font-mono">
                          {l.product.skuCode}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-right">
                      {formatMoney(Number(l.product.salePrice))}
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex items-center justify-end gap-1">
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setQty(l.product.id, l.qty - 1)}
                        >
                          −
                        </Button>
                        <Input
                          type="number"
                          value={l.qty}
                          onChange={(e) => setQty(l.product.id, Number(e.target.value) || 0)}
                          className="w-14 text-center"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setQty(l.product.id, l.qty + 1)}
                        >
                          +
                        </Button>
                      </div>
                    </TableCell>
                    <TableCell className="text-right font-medium">
                      {formatMoney(Number(l.product.salePrice) * l.qty)}
                    </TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removeFromCart(l.product.id)}
                      >
                        ✕
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </div>

        <div className="lg:w-80 flex flex-col gap-3">
          <div className="rounded-md border bg-background p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1.5">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Клиент *</label>
                <QuickAddClientDialog
                  onCreated={(c) => {
                    setResolvedClient(c);
                    setClientQuery("");
                    setClientResults([]);
                  }}
                />
              </div>
              {resolvedClient ? (
                <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm">
                  <span>
                    {resolvedClient.fullName} · <span className="font-mono">{resolvedClient.phone}</span>
                  </span>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setResolvedClient(null)}
                  >
                    Изменить
                  </Button>
                </div>
              ) : (
                <div className="relative">
                  <Input
                    placeholder="Поиск по имени или телефону..."
                    value={clientQuery}
                    onChange={(e) => setClientQuery(e.target.value)}
                  />
                  {clientQuery.trim() && clientResults.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full rounded-md border bg-popover shadow-md max-h-60 overflow-y-auto">
                      {clientResults.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => {
                            setResolvedClient(c);
                            setClientQuery("");
                            setClientResults([]);
                          }}
                          className="w-full text-left px-3 py-2 hover:bg-accent text-sm"
                        >
                          {c.fullName} · <span className="font-mono text-xs">{c.phone}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="flex items-center justify-between text-lg font-semibold">
              <span>Итого</span>
              <span>{formatMoney(total)} сум</span>
            </div>

            <div className="flex gap-2">
              <Button
                type="button"
                variant={paymentType === "cash" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setPaymentType("cash")}
              >
                Наличные
              </Button>
              <Button
                type="button"
                variant={paymentType === "card" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setPaymentType("card")}
              >
                Карта
              </Button>
              <Button
                type="button"
                variant={paymentType === "debt" ? "default" : "outline"}
                className="flex-1"
                onClick={() => setPaymentType("debt")}
              >
                Долг
              </Button>
            </div>

            {paymentType === "debt" && (
              <div className="flex flex-col gap-2 rounded-md border p-3">
                <div className="grid grid-cols-2 gap-2">
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Платежей</label>
                    <Input
                      type="number"
                      min={1}
                      max={24}
                      value={installments}
                      onChange={(e) => setInstallments(Number(e.target.value) || 1)}
                    />
                  </div>
                  <div className="flex flex-col gap-1">
                    <label className="text-xs text-muted-foreground">Первый платёж</label>
                    <Input
                      type="date"
                      value={firstDueDate}
                      onChange={(e) => setFirstDueDate(e.target.value)}
                    />
                  </div>
                </div>
                <div className="flex flex-col gap-1">
                  <label className="text-xs text-muted-foreground">Наценка за рассрочку, %</label>
                  <Input
                    type="number"
                    min={0}
                    max={100}
                    step="0.1"
                    value={markupPercent}
                    onChange={(e) => setMarkupPercent(Number(e.target.value) || 0)}
                  />
                </div>
                {markupPercent > 0 && (
                  <p className="text-xs text-muted-foreground">
                    Долг с наценкой: {formatMoney(total * (1 + markupPercent / 100))} сум
                  </p>
                )}
              </div>
            )}

            <Button
              type="button"
              size="lg"
              disabled={lines.length === 0 || checkingOut}
              onClick={handleCheckout}
            >
              {checkingOut ? "Оформление..." : "Оформить продажу"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}

function filterLocalProducts(catalog: PosProduct[], q: string) {
  const query = q.toLowerCase();
  return catalog
    .filter(
      (p) =>
        p.skuCode.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query),
    )
    .slice(0, 8);
}

function filterLocalClients(list: PosClient[], q: string) {
  const query = q.toLowerCase();
  return list
    .filter((c) => c.fullName.toLowerCase().includes(query) || c.phone.toLowerCase().includes(query))
    .slice(0, 8);
}
