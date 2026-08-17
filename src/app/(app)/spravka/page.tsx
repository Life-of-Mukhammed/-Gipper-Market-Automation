import { Card, CardContent } from "@/components/ui/card";

const SECTIONS = [
  {
    title: "Продажа",
    text: "Сканируйте штрихкод товара или найдите его по названию/артикулу. Выберите способ оплаты (наличные, карта или долг) и нажмите «Оформить продажу». Работает даже без интернета — продажа отправится автоматически, когда связь восстановится.",
  },
  {
    title: "Товар / Ассортимент",
    text: "В разделе «Товар» добавляйте и редактируйте товары. «Ассортимент» — это витрина для быстрого поиска цены и остатка.",
  },
  {
    title: "Клиенты / Долги",
    text: "Заведите клиента перед продажей в долг. В «Долгах» видно, кто сколько должен, график платежей и можно принять оплату.",
  },
  {
    title: "Поступление",
    text: "Оприходуйте товар от поставщика — остатки на складе увеличатся автоматически.",
  },
  {
    title: "Отчёт по кассе",
    text: "В начале дня откройте смену, в конце — закройте, указав фактическую сумму в кассе.",
  },
  {
    title: "Анализ",
    text: "Отчёт по выручке, количеству продаж и топ товаров за выбранный период.",
  },
];

export default function SpravkaPage() {
  return (
    <div className="flex-1 flex flex-col">
      <div className="border-b bg-background px-6 py-4">
        <h1 className="text-lg font-semibold">Справка</h1>
        <p className="text-sm text-muted-foreground">Краткое описание разделов системы</p>
      </div>

      <main className="flex-1 p-6 flex flex-col gap-3 max-w-2xl">
        {SECTIONS.map((s) => (
          <Card key={s.title}>
            <CardContent className="py-4">
              <div className="font-medium mb-1">{s.title}</div>
              <p className="text-sm text-muted-foreground">{s.text}</p>
            </CardContent>
          </Card>
        ))}
      </main>
    </div>
  );
}
