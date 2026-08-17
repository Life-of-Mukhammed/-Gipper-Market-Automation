function money(n: number | string) {
  return Number(n).toLocaleString("ru-RU");
}

const DIVIDER = "▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬";

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
  debtSummary?: {
    subtotal: string;
    markupAmount: string;
    markupPercent: number;
    installments: number;
    firstDueDate: string;
  };
}) {
  const { storeName, clientName, items, total, paymentType, createdAt, debtSummary } = params;

  const itemLines = items.map(
    (i, idx) => `${idx + 1}. ${i.name}\n   ${i.qty} × ${money(i.unitPrice)} = *${money(i.lineTotal)} сум*`,
  );

  const lines = [
    `🧾 *${storeName}*`,
    DIVIDER,
    `👤 Клиент: ${clientName}`,
    `📅 ${createdAt.toLocaleString("ru-RU")}`,
    "",
    "*Товары:*",
    ...itemLines,
    DIVIDER,
  ];

  if (paymentType === "debt" && debtSummary) {
    lines.push(`Сумма товаров: ${money(debtSummary.subtotal)} сум`);
    if (Number(debtSummary.markupAmount) > 0) {
      lines.push(
        `Наценка за рассрочку (${debtSummary.markupPercent}%): +${money(debtSummary.markupAmount)} сум`,
      );
    }
    lines.push(
      `💰 *Итого в долг: ${money(total)} сум*`,
      "",
      `📆 Разбито на ${debtSummary.installments} платеж(ей)`,
      `Первый платёж: ${debtSummary.firstDueDate}`,
    );
  } else {
    lines.push(`💰 *Итого: ${money(total)} сум*`, `💳 Оплата: ${PAYMENT_LABELS[paymentType] ?? paymentType}`);
  }

  lines.push("", "Спасибо за покупку! 🙏");

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
    `🧾 *${storeName}*`,
    DIVIDER,
    `👤 Клиент: ${clientName}`,
    `📅 ${createdAt.toLocaleString("ru-RU")}`,
    "",
    `✅ *Оплата долга: ${money(paidAmount)} сум*`,
    remainingBalance > 0
      ? `📉 Остаток долга: *${money(remainingBalance)} сум*`
      : "🎉 *Долг полностью погашен!*",
    "",
    "Спасибо за оплату! 🙏",
  ];

  return lines.join("\n");
}

export function buildPaymentReminderText(params: {
  storeName: string;
  clientName: string;
  amount: number;
  installmentNumber: number;
  dueDate: string;
  overdue: boolean;
}) {
  const { storeName, clientName, amount, installmentNumber, dueDate, overdue } = params;

  const lines = overdue
    ? [
        `🔴 *${storeName} — просрочен платёж*`,
        DIVIDER,
        `Здравствуйте, ${clientName}!`,
        `Платёж №${installmentNumber} был должен быть оплачен ${dueDate}.`,
        `💰 К оплате: *${money(amount)} сум*`,
        "",
        "Просим оплатить задолженность в ближайшее время.",
      ]
    : [
        `🔔 *${storeName} напоминает*`,
        DIVIDER,
        `Здравствуйте, ${clientName}!`,
        `Сегодня (${dueDate}) срок платежа №${installmentNumber}.`,
        `💰 К оплате: *${money(amount)} сум*`,
        "",
        "Ждём вас в магазине! 🙏",
      ];

  return lines.join("\n");
}
