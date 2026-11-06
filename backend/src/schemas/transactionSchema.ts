import { z } from 'zod';
function validDate(value: string) {
  const date = new Date(`${value}T12:00:00Z`);
  return (
    /^\d{4}-\d{2}-\d{2}$/.test(value) &&
    value >= '1900-01-01' &&
    value <= '9999-12-31' &&
    Number.isFinite(date.getTime()) &&
    date.toISOString().slice(0, 10) === value
  );
}
export const transactionSchema = z
  .object({
    description: z.string().trim().min(1, 'Informe a descrição.').max(120),
    amount: z
      .number()
      .finite()
      .min(0.01, 'O valor deve ser de pelo menos R$ 0,01.')
      .max(999999999.99)
      .refine(
        (value) => Math.round(value * 100) / 100 === value,
        'Use no máximo duas casas decimais.',
      ),
    type: z.enum(['income', 'expense']),
    category: z.string().trim().min(1, 'Informe a categoria.').max(60),
    categoryId: z.string().uuid().optional(),
    notes: z.string().trim().max(1000).nullable().optional(),
    date: z
      .string()
      .refine(
        validDate,
        'Use uma data válida no formato AAAA-MM-DD, entre 1900 e 9999.',
      ),
  })
  .strict();
export const idSchema = z.string().uuid('Identificador inválido. Use um UUID.');
