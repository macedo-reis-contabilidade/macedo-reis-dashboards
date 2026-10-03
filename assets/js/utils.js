// ============================================================
// MACEDO & REIS - Utilitários
// Formatadores, máscaras e validações
// ============================================================

// CNPJ ALFANUMÉRICO (IN RFB 2.229/2024; os primeiros saíram em julho/2026) -----------------------
// As 12 primeiras posições aceitam letras maiúsculas e números; os 2 dígitos verificadores seguem só números.
// O DV é o mesmo módulo 11 de sempre, com o valor de cada caractere = código ASCII − 48 ('0'..'9' = 0..9,
// 'A' = 17 … 'Z' = 42). CNPJ só de números continua valendo e não muda nada. Documento no banco: sem pontuação,
// letras em maiúsculo (ex.: 12ABC34501DE35).
const RX_CNPJ = /^[0-9A-Z]{12}\d{2}$/;

/** Documento sem pontuação: CNPJ alfanumérico preservado (maiúsculo); CPF e o resto, só dígitos. */
export function normalizarDocumento(doc) {
  const s = String(doc ?? '').toUpperCase().replace(/[\s.\-\/]/g, '');
  return RX_CNPJ.test(s) ? s : s.replace(/\D/g, '');
}

/** É CNPJ (numérico ou alfanumérico) no formato, sem conferir o DV? */
export function ehCnpj(doc) {
  return RX_CNPJ.test(normalizarDocumento(doc));
}

/** CNPJ válido pelos dígitos verificadores — numérico ou alfanumérico. */
export function cnpjValido(doc) {
  const c = normalizarDocumento(doc);
  if (!RX_CNPJ.test(c) || /^(\d)\1{13}$/.test(c)) return false;
  const dv = n => {
    let soma = 0, peso = n - 7;
    for (let i = 0; i < n; i++) { soma += (c.charCodeAt(i) - 48) * peso--; if (peso < 2) peso = 9; }
    const r = soma % 11;
    return r < 2 ? 0 : 11 - r;
  };
  return dv(12) === +c[12] && dv(13) === +c[13];
}

// FORMATADORES (entrada com/sem máscara → saída formatada) ---------

export function formatCNPJ(cnpj) {
  if (!cnpj) return '';
  const c = normalizarDocumento(cnpj);
  if (!RX_CNPJ.test(c)) return cnpj;
  return c.replace(/^(.{2})(.{3})(.{3})(.{4})(.{2})$/, '$1.$2.$3/$4-$5');
}

export function formatCPF(cpf) {
  if (!cpf) return '';
  const digits = cpf.replace(/\D/g, '');
  if (digits.length !== 11) return cpf;
  return digits.replace(/^(\d{3})(\d{3})(\d{3})(\d{2})$/, '$1.$2.$3-$4');
}

export function formatDocumento(doc) {
  if (!doc) return '';
  const c = normalizarDocumento(doc);
  if (c.length === 14) return formatCNPJ(c);
  if (c.length === 11) return formatCPF(c);
  return doc;
}

export function formatTelefone(tel) {
  if (!tel) return '';
  const digits = tel.replace(/\D/g, '');
  if (digits.length === 11) return digits.replace(/^(\d{2})(\d{5})(\d{4})$/, '($1) $2-$3');
  if (digits.length === 10) return digits.replace(/^(\d{2})(\d{4})(\d{4})$/, '($1) $2-$3');
  return tel;
}

export function onlyDigits(str) {
  return (str || '').replace(/\D/g, '');
}

export function formatDate(iso) {
  if (!iso) return '';
  // Data pura (YYYY-MM-DD): new Date() a interpreta como meia-noite UTC e a exibição
  // em America/Sao_Paulo caía no dia ANTERIOR em todas as telas. Montar como data
  // local resolve; timestamps completos seguem exibidos no fuso de São Paulo.
  const m = String(iso).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (m) return new Date(+m[1], +m[2] - 1, +m[3]).toLocaleDateString('pt-BR');
  const d = new Date(iso);
  if (isNaN(d.getTime())) return '';
  return d.toLocaleDateString('pt-BR', { timeZone: 'America/Sao_Paulo' });
}

// DATA LOCAL ('AAAA-MM-DD') -------------------------------------------
// toISOString() é UTC: em Brasília (UTC−3), das 21h à meia-noite ele já devolve o dia seguinte — em 30/09/2026 a
// Reforma disse, às 22h do último dia da opção, que a janela tinha fechado. Pra "hoje", "amanhã", "+N dias", mês
// atual etc., use estes, que leem o calendário no fuso do navegador. Carimbo com hora (created_at, concluida_em…)
// continua com new Date().toISOString() inteiro — em UTC está certo.

/** 'AAAA-MM-DD' de um Date qualquer, no fuso do navegador (ex.: dataLocal(new Date(Date.now() + 90 * 864e5))). */
export function dataLocal(d) {
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
}

/** 'AAAA-MM-DD' de hoje, no fuso do navegador. */
export function hojeLocal() {
  return dataLocal(new Date());
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
  // CNPJ alfanumérico: letra e número nas 12 primeiras posições; os 2 dígitos verificadores, só número
  let d = '';
  for (const ch of String(value || '').toUpperCase().replace(/[^0-9A-Z]/g, '')) {
    if (d.length >= 14) break;
    if (d.length >= 12 && !/\d/.test(ch)) continue;
    d += ch;
  }
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

export const ESTADOS_BR = [
  'AC','AL','AP','AM','BA','CE','DF','ES','GO','MA','MT','MS','MG','PA','PB',
  'PR','PE','PI','RJ','RN','RS','RO','RR','SC','SP','SE','TO'
];
