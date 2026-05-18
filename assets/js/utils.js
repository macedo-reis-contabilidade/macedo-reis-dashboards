// ============================================================
// MACEDO & REIS - Utilitários
// ============================================================

export function formatCNPJ(cnpj) {
  if (!cnpj) return '';
  const digits = cnpj.replace(/\D/g, '');
  if (digits.length !== 14) return cnpj;
  return digits.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5');
}

export function formatCPF(cpf) {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

export function formatDocumento(doc) {
  if (!doc) return '';
  const digits = doc.replace(/\D/g, '');
  if (digits.length === 14) return formatCNPJ(digits);
  if (digits.length === 11) return formatCPF(digits);
  return doc;
}

export function formatTelefone(tel) {
  if (!tel) return '';
  const digits = tel.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return tel;
}

export function formatCEP(cep) {
  if (!cep) return '';
  const digits = cep.replace(/\D/g, '');
  if (digits.length !== 8) return cep;
  return digits.replace(/^(\d{5})(\d{3})$/, '$1-$2');
}

export function onlyDigits(str) {
  return (str || '').replace(/\D/g, '');
}

export function formatDate(iso) {
  if (!iso) return '';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

export function formatCurrency(value) {
  if (value === null || value === undefined || value === '') return '';
  return Number(value).toLocaleString('pt-BR', {
    style: 'currency',
    currency: 'BRL'
  });
}

export function titleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
}

export const STATUS_LABELS = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  em_transicao: 'Em transição',
  prospect: 'Prospect'
};

export const SETOR_LABELS = {
  fiscal: 'Fiscal',
  departamento_pessoal: 'DP',
  contabil: 'Contábil',
  societario: 'Societário',
  financeiro: 'Financeiro'
};
