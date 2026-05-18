// ============================================================
// MACEDO & REIS - Utilitários
// Formatadores, máscaras e validações
// ============================================================

// FORMATADORES (entrada com/sem máscara → saída formatada) ---------

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
  return Number(value).toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
}

export function titleCase(str) {
  if (!str) return '';
  return str.toLowerCase().replace(/(?:^|\s)\S/g, c => c.toUpperCase());
}

// MÁSCARAS DINÂMICAS (aplicar ao input enquanto digita) -------------

/**
 * Liga uma máscara ao input, atualizando o valor enquanto o usuário digita.
 * Use: bindMask(inputEl, maskCNPJ)
 */
export function bindMask(input, maskFn) {
  input.addEventListener('input', () => {
    const cursorEnd = input.selectionEnd === input.value.length;
    const masked = maskFn(input.value);
    input.value = masked;
    if (cursorEnd) input.setSelectionRange(masked.length, masked.length);
  });
}

export function maskCNPJ(value) {
  const d = onlyDigits(value).slice(0, 14);
  if (d.length <= 2) return d;
  if (d.length <= 5) return `${d.slice(0,2)}.${d.slice(2)}`;
  if (d.length <= 8) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5)}`;
  if (d.length <= 12) return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8)}`;
  return `${d.slice(0,2)}.${d.slice(2,5)}.${d.slice(5,8)}/${d.slice(8,12)}-${d.slice(12)}`;
}

export function maskCPF(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 3) return d;
  if (d.length <= 6) return `${d.slice(0,3)}.${d.slice(3)}`;
  if (d.length <= 9) return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6)}`;
  return `${d.slice(0,3)}.${d.slice(3,6)}.${d.slice(6,9)}-${d.slice(9)}`;
}

export function maskTelefone(value) {
  const d = onlyDigits(value).slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : '';
  if (d.length <= 6) return `(${d.slice(0,2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0,2)}) ${d.slice(2,6)}-${d.slice(6)}`;
  return `(${d.slice(0,2)}) ${d.slice(2,7)}-${d.slice(7)}`;
}

export function maskCEP(value) {
  const d = onlyDigits(value).slice(0, 8);
  if (d.length <= 5) return d;
  return `${d.slice(0,5)}-${d.slice(5)}`;
}

// VALIDAÇÕES (algoritmo dos dígitos verificadores) ------------------

export function isValidCNPJ(cnpj) {
  const d = onlyDigits(cnpj);
  if (d.length !== 14) return false;
  if (/^(\d)\1+$/.test(d)) return false; // todos iguais
  const calc = (slice) => {
    const weights = slice.length === 12
      ? [5,4,3,2,9,8,7,6,5,4,3,2]
      : [6,5,4,3,2,9,8,7,6,5,4,3,2];
    let sum = 0;
    for (let i = 0; i < slice.length; i++) sum += parseInt(slice[i]) * weights[i];
    const mod = sum % 11;
    return mod < 2 ? 0 : 11 - mod;
  };
  const dv1 = calc(d.slice(0, 12));
  const dv2 = calc(d.slice(0, 13));
  return dv1 === parseInt(d[12]) && dv2 === parseInt(d[13]);
}

export function isValidCPF(cpf) {
  const d = onlyDigits(cpf);
  if (d.length !== 11) return false;
  if (/^(\d)\1+$/.test(d)) return false;
  const calc = (slice, factor) => {
    let sum = 0;
    for (let i = 0; i < slice.length; i++) sum += parseInt(slice[i]) * (factor - i);
    const mod = (sum * 10) % 11;
    return mod === 10 ? 0 : mod;
  };
  const dv1 = calc(d.slice(0, 9), 10);
  const dv2 = calc(d.slice(0, 10), 11);
  return dv1 === parseInt(d[9]) && dv2 === parseInt(d[10]);
}

// VIACEP - busca endereço por CEP -----------------------------------

export async function buscarCEP(cep) {
  const d = onlyDigits(cep);
  if (d.length !== 8) return null;
  try {
    const res = await fetch(`https://viacep.com.br/ws/${d}/json/`);
    if (!res.ok) return null;
    const data = await res.json();
    if (data.erro) return null;
    return {
      logradouro: data.logradouro || '',
      bairro: data.bairro || '',
      cidade: data.localidade || '',
      uf: data.uf || '',
      complemento: data.complemento || ''
    };
  } catch {
    return null;
  }
}

// LABELS para enums do banco ----------------------------------------

export const STATUS_LABELS = {
  ativo: 'Ativo',
  inativo: 'Inativo',
  em_transicao: 'Em transição',
  prospect: 'Prospect'
};

export const SETOR_LABELS = {
  fiscal: 'Fiscal',
  departamento_pessoal: 'Departamento Pessoal',
  contabil: 'Contábil',
  societario: 'Societário',
  financeiro: 'Financeiro'
};

export const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];
