export const currency = (value: number) =>
  new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' }).format(
    value,
  );
export const dateLabel = (value: string) =>
  new Intl.DateTimeFormat('pt-BR').format(new Date(`${value}T12:00:00`));
