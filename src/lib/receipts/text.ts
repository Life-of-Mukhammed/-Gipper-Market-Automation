function money(n: number | string) {
  return Number(n).toLocaleString("ru-RU");
}

export type ReceiptItem = {
  name: string;
  qty: number;
  unitPrice: string;
  lineTotal: string;
};

const PAYMENT_LABELS: Record<string, string> = {
  cash: "Наличные",
  card: "Карта",
  debt: "Долг (насия)",
};

export function buildSaleReceiptText(params: {
  storeName: string;
  clientName: string;
  items: ReceiptItem[];
  total: string;
  paymentType: "cash" | "card" | "debt";
  createdAt: Date;
  debtSummary?: { installments: number; firstDueDate: string };
}) {
  const { storeName, clientName, items, total, paymentType, createdAt, debtSummary } = params;

  const lines = [
    `🧾 ${storeName}`,
    `Клиент: ${clientName}`,
    `Дата: ${createdAt.toLocaleString("ru-RU")}`,
    "",
    ...items.map(
      (i) => `${i.name}\n  ${i.qty} × ${money(i.unitPrice)} = ${money(i.lineTotal)} сум`,
    ),
    "",
    `Итого: ${money(total)} сум`,
    `Оплата: ${PAYMENT_LABELS[paymentType] ?? paymentType}`,
  ];

  if (paymentType === "debt" && debtSummary) {
    lines.push(
      "",
      `Продажа оформлена в долг, разбита на ${debtSummary.installments} платеж(ей).`,
      `Первый платёж: ${debtSummary.firstDueDate}`,
    );
  }

  lines.push("", "Спасибо за покупку!");

  return lines.join("\n");
}

export function buildDebtPaymentReceiptText(params: {
  storeName: string;
  clientName: string;
  paidAmount: number;
  remainingBalance: number;
  createdAt: Date;
}) {
  const { storeName, clientName, paidAmount, remainingBalance, createdAt } = params;

  const lines = [
    `🧾 ${storeName}`,
    `Клиент: ${clientName}`,
    `Дата: ${createdAt.toLocaleString("ru-RU")}`,
    "",
    `Оплата долга: ${money(paidAmount)} сум`,
    remainingBalance > 0
      ? `Остаток долга: ${money(remainingBalance)} сум`
      : "Долг полностью погашен ✅",
    "",
    "Спасибо за оплату!",
  ];

  return lines.join("\n");
}
