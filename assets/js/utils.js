// ============================================================
// MACEDO & REIS - Utilitários
// Formatadores e helpers usados em todas as páginas
// ============================================================

/**
 * Formata CNPJ: 12345678000190 -> 12.345.678/0001-90
 */
export function formatCNPJ(cnpj) {
  if (!cnpj) return '';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

/**
 * Formata CPF: 12345678901 -> 123.456.789-01
 */
export function formatCPF(cpf) {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

/**
 * Formata documento detectando se é CPF ou CNPJ pelo tamanho
 */
export function formatDocumento(doc) {
  if (!doc) return '';
  const digits = doc.replace(/\D/g, '');
  if (digits.length === 14) return formatCNPJ(digits);
  if (digits.length === 11) return formatCPF(digits);
  return doc;
}

/**
 * Formata telefone: 51999998888 -> (51) 99999-8888
 */
export function formatTelefone(tel) {
  if (!tel) return '';
  const digits = tel.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return tel;
}

/**
 * Formata CEP: 95380000 -> 95380-000
 */
export function formatCEP(cep) {
  if (!cep) return '';
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return cep;
  return digits.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}

/**
 * Remove formatação, deixando apenas dígitos
 */
export function onlyDigits(str) {
  return (str || '').replace(/\D/g, '');
}

/**
 * Formata data ISO para pt-BR: 2026-05-15 -> 15/05/2026
 */
export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

/**
 * Formata moeda BRL: 1234.56 -> R$ 1.234,56
 */
export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '';
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

/**
 * Capitaliza primeira letra de cada palavra
 */
export function titleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
}

/**
 * Mapeia o enum de status para label amigável em pt-BR
 */
export const STATUS_LABELS = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  em_transicao: 'Em transição',
  prospect: 'Prospect'
};

/**
 * Mapeia o enum de setor para label amigável
 */
export const SETOR_LABELS = {
  fiscal: 'Fiscal',
  departamento_pessoal: 'DP',
  contabil: 'Contábil',
  societario: 'Societário',
  financeiro: 'Financeiro'
};
