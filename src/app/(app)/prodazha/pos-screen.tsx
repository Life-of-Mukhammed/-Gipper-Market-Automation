"use client";

import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PackageIcon } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import {
  checkoutSale,
  getClientsBatch,
  getProductCategories,
  getProductsBatch,
  browseProducts,
  searchClientsOnline,
  searchProductsOnline,
  type DebtPlanInput,
} from "./actions";
import { QuickAddClientDialog } from "./quick-add-client-dialog";
import { ProductFormDialog } from "../tovar/product-form-dialog";
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

type BrowseProduct = PosProduct & {
  minStockThreshold?: number;
  category?: string | null;
  purchasePrice?: string;
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
  discount: number;
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
  const [categories, setCategories] = useState<string[]>([]);
  const [activeCategory, setActiveCategory] = useState<string | null>(null);
  const [gridItems, setGridItems] = useState<BrowseProduct[]>([]);
  const [gridOffset, setGridOffset] = useState(0);
  const [gridHasMore, setGridHasMore] = useState(false);
  const [gridLoading, setGridLoading] = useState(false);

  const [resolvedClient, setResolvedClient] = useState<PosClient | null>(null);
  const [clientQuery, setClientQuery] = useState("");
  const [clientResults, setClientResults] = useState<PosClient[]>([]);

  const [paymentType, setPaymentType] = useState<"cash" | "card" | "debt">("cash");
  const [discount, setDiscount] = useState(0);
  const [installmentPlanEnabled, setInstallmentPlanEnabled] = useState(false);
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
      void getProductCategories().then(setCategories);
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

  // Product browse grid — debounced, server-backed page-at-a-time while
  // online (category tabs + text filter), offline cache filter otherwise.
  // Resets to the first page whenever the query or category changes.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- flips a loading flag for the debounced fetch below; there's no derivable value to replace it with
    setGridLoading(true);
    const timer = setTimeout(async () => {
      if (navigator.onLine) {
        try {
          const { items, hasMore } = await browseProducts({
            category: activeCategory,
            query: search,
            offset: 0,
          });
          setGridItems(items);
          setGridHasMore(hasMore);
          setGridOffset(items.length);
        } catch {
          setGridItems(filterLocalProducts(offlineCatalog, search));
          setGridHasMore(false);
        }
      } else {
        setGridItems(filterLocalProducts(offlineCatalog, search));
        setGridHasMore(false);
      }
      setGridLoading(false);
    }, 250);
    return () => clearTimeout(timer);
  }, [search, activeCategory, offlineCatalog]);

  async function loadMoreGrid() {
    setGridLoading(true);
    try {
      const { items, hasMore } = await browseProducts({
        category: activeCategory,
        query: search,
        offset: gridOffset,
      });
      setGridItems((prev) => [...prev, ...items]);
      setGridHasMore(hasMore);
      setGridOffset((prev) => prev + items.length);
    } catch {
      setGridHasMore(false);
    }
    setGridLoading(false);
  }

  // Re-fetches from the first page, used after an inline product edit so
  // the card reflects the new name/price/stock right away.
  async function refetchGridFromStart() {
    if (!navigator.onLine) return;
    try {
      const { items, hasMore } = await browseProducts({
        category: activeCategory,
        query: search,
        offset: 0,
      });
      setGridItems(items);
      setGridHasMore(hasMore);
      setGridOffset(items.length);
    } catch {
      // ignore — the stale card just won't reflect the edit until the next search/category change
    }
  }

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
    if (product.stockQty <= 0) return;
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      next.set(product.id, { product, qty: (existing?.qty ?? 0) + 1 });
      return next;
    });
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

    // A barcode scan resolves to exactly one exact sku/barcode match.
    const exact = navigator.onLine
      ? (await searchProductsOnline(q).catch(() => []))[0]
      : offlineCatalog.find(
          (p) => p.barcode?.toLowerCase() === q.toLowerCase() || p.skuCode.toLowerCase() === q.toLowerCase(),
        );
    if (exact) {
      addToCart(exact);
      setSearch("");
    }
  }

  const lines = Array.from(cart.values());
  const subtotal = lines.reduce(
    (sum, l) => sum + Number(l.product.salePrice) * l.qty,
    0,
  );
  const clampedDiscount = Math.max(0, Math.min(subtotal, discount || 0));
  const total = subtotal - clampedDiscount;

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
    // Installment plan fields are optional — when the cashier hasn't turned
    // them on, the debt is still recorded (single payment, no markup) using
    // these already-sane defaults.
    const debtPlan: DebtPlanInput | undefined =
      paymentType === "debt" ? { installments, firstDueDate, markupPercent } : undefined;

    function resetForm() {
      setCart(new Map());
      setClientUuid(crypto.randomUUID());
      setResolvedClient(null);
      setClientQuery("");
      setDiscount(0);
      setInstallmentPlanEnabled(false);
      setInstallments(1);
      setMarkupPercent(0);
    }

    if (!navigator.onLine) {
      if (paymentType === "debt") {
        setCheckingOut(false);
        toast.error("Продажа в долг недоступна офлайн — дождитесь подключения к интернету");
        return;
      }
      await saveSaleToOutbox({ clientUuid: uuid, clientId, items, paymentType, total, discount: clampedDiscount });
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
      const res = await checkoutSale(uuid, items, paymentType, clientId, {
        debtPlan,
        discount: clampedDiscount,
      });
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
        await saveSaleToOutbox({ clientUuid: uuid, clientId, items, paymentType, total, discount: clampedDiscount });
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

      <div className="flex-1 flex flex-col lg:flex-row gap-4 p-4 min-h-0">
        {/* LEFT: browse & search */}
        <div className="flex-1 flex flex-col gap-3 min-w-0">
          <Input
            ref={searchInputRef}
            autoFocus
            placeholder="Сканируйте штрихкод или введите артикул / название..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={handleSearchKeyDown}
          />

          {isOnline && categories.length > 0 && (
            <div className="flex items-center gap-2 overflow-x-auto pb-1">
              <Button
                type="button"
                size="sm"
                variant={activeCategory === null ? "default" : "outline"}
                className="shrink-0"
                onClick={() => setActiveCategory(null)}
              >
                Все
              </Button>
              {categories.map((c) => (
                <Button
                  key={c}
                  type="button"
                  size="sm"
                  variant={activeCategory === c ? "default" : "outline"}
                  className="shrink-0"
                  onClick={() => setActiveCategory(c)}
                >
                  {c}
                </Button>
              ))}
            </div>
          )}

          <div className="flex-1 overflow-y-auto rounded-md border bg-background p-3">
            {gridItems.length === 0 && !gridLoading && (
              <p className="text-center text-muted-foreground py-10">
                Ничего не найдено
              </p>
            )}
            <div className="grid grid-cols-2 sm:grid-cols-3 xl:grid-cols-4 gap-3">
              {gridItems.map((p) => {
                const outOfStock = p.stockQty <= 0;
                const lowStock =
                  !outOfStock && p.minStockThreshold !== undefined && p.stockQty <= p.minStockThreshold;
                return (
                  <div key={p.id} className="relative">
                    {/* Sibling of the add-to-cart button (not nested inside
                        it) — a Dialog trigger nested in a <button> would be
                        invalid HTML, and its portaled content would still
                        bubble clicks up through React's tree either way. */}
                    <div className="absolute top-1.5 left-1.5 z-10">
                      <ProductFormDialog
                        compact
                        product={{
                          id: p.id,
                          skuCode: p.skuCode,
                          barcode: p.barcode,
                          name: p.name,
                          unit: p.unit,
                          category: p.category ?? null,
                          purchasePrice: p.purchasePrice ?? "0",
                          salePrice: p.salePrice,
                          stockQty: p.stockQty,
                          minStockThreshold: p.minStockThreshold ?? 0,
                        }}
                        onSaved={refetchGridFromStart}
                      />
                    </div>
                    {lowStock && (
                      <span className="absolute -top-1.5 -right-1.5 z-10 flex h-5 min-w-5 items-center justify-center rounded-full bg-destructive px-1 text-xs font-medium text-destructive-foreground">
                        {p.stockQty}
                      </span>
                    )}
                    <button
                      type="button"
                      disabled={outOfStock}
                      onClick={() => addToCart(p)}
                      className={`flex w-full flex-col gap-2 rounded-md border p-3 text-left transition-colors ${
                        outOfStock
                          ? "opacity-50 cursor-not-allowed"
                          : "hover:border-primary hover:bg-accent cursor-pointer"
                      }`}
                    >
                      <div className="flex h-14 w-14 items-center justify-center rounded-md bg-muted text-muted-foreground">
                        <PackageIcon className="size-6" />
                      </div>
                      <div className="flex flex-col gap-0.5">
                        <span className="text-sm font-medium leading-snug line-clamp-2">{p.name}</span>
                        <span className="text-sm font-semibold">{formatMoney(Number(p.salePrice))} сум</span>
                        <span className={`text-xs ${outOfStock ? "text-destructive" : "text-muted-foreground"}`}>
                          {outOfStock ? "нет в наличии" : `ост. ${p.stockQty} ${p.unit}`}
                        </span>
                      </div>
                    </button>
                  </div>
                );
              })}
            </div>
            {gridHasMore && (
              <div className="flex justify-center pt-4">
                <Button type="button" variant="outline" size="sm" onClick={loadMoreGrid} disabled={gridLoading}>
                  {gridLoading ? "Загрузка..." : "Показать ещё"}
                </Button>
              </div>
            )}
          </div>
        </div>

        {/* RIGHT: cart, client, payment */}
        <div className="lg:w-96 flex flex-col gap-3 lg:h-full">
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

          <div className="flex-1 flex flex-col rounded-md border bg-background min-h-0">
            <div className="px-3 py-2 border-b text-sm font-medium">Корзина</div>
            <div className="flex-1 overflow-y-auto">
              {lines.length === 0 ? (
                <p className="text-center text-muted-foreground text-sm py-10 px-3">
                  Корзина пуста. Нажмите на товар слева, чтобы добавить.
                </p>
              ) : (
                <div className="flex flex-col divide-y">
                  {lines.map((l) => (
                    <div key={l.product.id} className="flex items-center gap-2 px-3 py-2">
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{l.product.name}</div>
                        <div className="text-xs text-muted-foreground">
                          {formatMoney(Number(l.product.salePrice))} × {l.qty} ={" "}
                          <span className="font-medium text-foreground">
                            {formatMoney(Number(l.product.salePrice) * l.qty)}
                          </span>
                        </div>
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
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
                          className="w-12 text-center px-1"
                        />
                        <Button
                          type="button"
                          variant="outline"
                          size="icon-sm"
                          onClick={() => setQty(l.product.id, l.qty + 1)}
                        >
                          +
                        </Button>
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon-sm"
                          onClick={() => removeFromCart(l.product.id)}
                        >
                          ✕
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>

          <div className="rounded-md border bg-background p-4 flex flex-col gap-3">
            <div className="flex flex-col gap-1">
              <div className="flex items-center justify-between">
                <label className="text-xs text-muted-foreground">Скидка, сум</label>
                {clampedDiscount > 0 && (
                  <span className="text-xs text-muted-foreground">
                    Подытог: {formatMoney(subtotal)} сум
                  </span>
                )}
              </div>
              <Input
                type="number"
                min={0}
                max={subtotal}
                value={discount}
                onChange={(e) => setDiscount(Number(e.target.value) || 0)}
                placeholder="0"
              />
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
                <div className="flex items-center justify-between">
                  <Label htmlFor="installment-plan-toggle" className="text-sm">
                    Рассрочка (платежи и наценка)
                  </Label>
                  <Switch
                    id="installment-plan-toggle"
                    checked={installmentPlanEnabled}
                    onCheckedChange={(checked) => {
                      setInstallmentPlanEnabled(checked);
                      if (!checked) {
                        setInstallments(1);
                        setFirstDueDate(defaultFirstDueDate());
                        setMarkupPercent(0);
                      }
                    }}
                  />
                </div>
                {!installmentPlanEnabled && (
                  <p className="text-xs text-muted-foreground">
                    Простой долг без графика — вся сумма к оплате целиком.
                  </p>
                )}
                {installmentPlanEnabled && (
                  <>
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
                  </>
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
  const query = q.trim().toLowerCase();
  if (!query) return catalog.slice(0, 60);
  return catalog
    .filter(
      (p) =>
        p.skuCode.toLowerCase().includes(query) ||
        p.barcode?.toLowerCase().includes(query) ||
        p.name.toLowerCase().includes(query),
    )
    .slice(0, 60);
}

function filterLocalClients(list: PosClient[], q: string) {
  const query = q.toLowerCase();
  return list
    .filter((c) => c.fullName.toLowerCase().includes(query) || c.phone.toLowerCase().includes(query))
    .slice(0, 8);
}
