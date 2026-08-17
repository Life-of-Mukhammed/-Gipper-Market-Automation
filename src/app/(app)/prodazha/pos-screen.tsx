"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { checkoutSale, type DebtPlanInput } from "./actions";
import {
  cacheProducts,
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
  items: { productId: string; qty: number }[];
  paymentType: "cash" | "card";
  total: number;
}) {
  return queueOfflineSale({ ...sale, createdAt: Date.now(), status: "pending" });
}

export function PosScreen({
  products: serverProducts,
  clients,
}: {
  products: PosProduct[];
  clients: PosClient[];
}) {
  const [catalog, setCatalog] = useState<PosProduct[]>(serverProducts);
  const [cart, setCart] = useState<Map<string, CartLine>>(new Map());
  const [search, setSearch] = useState("");
  const [paymentType, setPaymentType] = useState<"cash" | "card" | "debt">("cash");
  const [debtClientId, setDebtClientId] = useState<string>("");
  const [installments, setInstallments] = useState(1);
  const [firstDueDate, setFirstDueDate] = useState(defaultFirstDueDate);
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

  // Seed the offline product cache whenever we have fresh server data
  // (the initial catalog state already mirrors serverProducts on mount).
  // Fall back to the cache if this page ever loads with no server data
  // (fully offline first load served by the service worker).
  useEffect(() => {
    if (serverProducts.length > 0) {
      void cacheProducts(serverProducts);
      // Client-navigation to this page only ever fetches RSC payloads, not
      // the full document, so the service worker never gets a full-page
      // snapshot to serve on a later offline reload. A plain fetch() here
      // requests the full HTML document and warms that cache entry.
      if (navigator.onLine) {
        fetch(window.location.pathname).catch(() => {});
      }
    } else if (!navigator.onLine) {
      void getCachedProducts().then((cached) => {
        if (cached.length > 0) setCatalog(cached);
      });
    }
  }, [serverProducts]);

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

  const results = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return [];
    return catalog
      .filter(
        (p) =>
          p.skuCode.toLowerCase().includes(q) ||
          p.barcode?.toLowerCase().includes(q) ||
          p.name.toLowerCase().includes(q),
      )
      .slice(0, 8);
  }, [search, catalog]);

  function addToCart(product: PosProduct) {
    setCart((prev) => {
      const next = new Map(prev);
      const existing = next.get(product.id);
      next.set(product.id, { product, qty: (existing?.qty ?? 0) + 1 });
      return next;
    });
    setSearch("");
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

  function handleSearchKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key !== "Enter") return;
    e.preventDefault();
    const q = search.trim().toLowerCase();
    if (!q) return;

    const exact = catalog.find(
      (p) => p.barcode?.toLowerCase() === q || p.skuCode.toLowerCase() === q,
    );
    if (exact) {
      addToCart(exact);
      return;
    }
    if (results.length === 1) {
      addToCart(results[0]);
    }
  }

  const lines = Array.from(cart.values());
  const total = lines.reduce(
    (sum, l) => sum + Number(l.product.salePrice) * l.qty,
    0,
  );

  async function handleCheckout() {
    if (lines.length === 0) return;
    if (paymentType === "debt" && !debtClientId) {
      toast.error("Выберите клиента для продажи в долг");
      return;
    }
    setCheckingOut(true);
    const items = lines.map((l) => ({ productId: l.product.id, qty: l.qty }));
    const uuid = clientUuid;
    const debtPlan: DebtPlanInput | undefined =
      paymentType === "debt"
        ? { clientId: debtClientId, installments, firstDueDate }
        : undefined;

    if (!navigator.onLine) {
      if (paymentType === "debt") {
        setCheckingOut(false);
        toast.error("Продажа в долг недоступна офлайн — дождитесь подключения к интернету");
        return;
      }
      await saveSaleToOutbox({ clientUuid: uuid, items, paymentType, total });
      // optimistic local stock decrement so this cashier doesn't oversell
      // against their own cached view while offline
      setCatalog((prev) =>
        prev.map((p) => {
          const line = cart.get(p.id);
          return line ? { ...p, stockQty: p.stockQty - line.qty } : p;
        }),
      );
      await cacheProducts(
        catalog.map((p) => {
          const line = cart.get(p.id);
          return line ? { ...p, stockQty: p.stockQty - line.qty } : p;
        }),
      );
      toast.warning("Нет соединения — продажа сохранена локально и будет отправлена автоматически");
      setCart(new Map());
      setClientUuid(crypto.randomUUID());
      setCheckingOut(false);
      await refreshPendingCount();
      searchInputRef.current?.focus();
      return;
    }

    try {
      const res = await checkoutSale(uuid, items, paymentType, { debtPlan });
      setCheckingOut(false);

      if (res.ok) {
        toast.success(`Продажа оформлена: ${formatMoney(Number(res.total))} сум`);
        setCart(new Map());
        setClientUuid(crypto.randomUUID());
        setDebtClientId("");
        setInstallments(1);
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
        await saveSaleToOutbox({ clientUuid: uuid, items, paymentType, total });
        toast.warning("Нет соединения — продажа сохранена локально и будет отправлена автоматически");
        setCart(new Map());
        setClientUuid(crypto.randomUUID());
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
            {results.length > 0 && (
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
                <Select value={debtClientId} onValueChange={(v) => setDebtClientId(v ?? "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder="Выберите клиента" />
                  </SelectTrigger>
                  <SelectContent>
                    {clients.map((c) => (
                      <SelectItem key={c.id} value={c.id}>
                        {c.fullName} · {c.phone}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
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
