# Macedo & Reis — Dashboards Internos

Sistema interno do escritório para gestão unificada dos setores: cadastro de clientes, departamento pessoal, fiscal, contábil, societário e financeiro.

## Stack

- **Frontend:** HTML/CSS/JavaScript (sem framework, sem build tools)
- **Hospedagem:** GitHub Pages
- **Backend:** [Supabase](https://supabase.com) (PostgreSQL + REST API + Auth)

## Estrutura

```
.
├── index.html              # Menu principal — entrada do sistema
├── login.html              # Tela de login (Supabase Auth)
├── clientes/               # Dashboard de cadastro de clientes
│   └── index.html          # Listagem
└── assets/
    ├── css/
    │   └── style.css       # Estilos compartilhados (tema dark editorial)
    └── js/
        ├── supabase.js     # Inicialização do cliente Supabase
        ├── auth-guard.js   # Proteção de páginas (exige login)
        └── utils.js        # Formatadores (CNPJ, CPF, telefone, data)
```

## Status dos dashboards

| Dashboard | Status |
|-----------|--------|
| Cadastro de clientes | 🟢 Em desenvolvimento (listagem ativa, cadastro pendente) |
| Departamento Pessoal | ⚪ Planejado |
| Fiscal | ⚪ Planejado |
| Contábil | ⚪ Planejado |
| Societário | ⚪ Planejado |
| Financeiro | ⚪ Planejado |

## Modelo de dados

Tabelas principais no Supabase:

- `clientes` — registro mestre (PJ e PF)
- `socios` — sócios de clientes PJ
- `contatos` — contatos adicionais por cliente
- `servicos_contratados` — quais setores do escritório atendem cada cliente

## Segurança

- Todas as tabelas usam **Row Level Security (RLS)**
- Apenas usuários autenticados via Supabase Auth conseguem ler/escrever
- A `publishable key` no `assets/js/supabase.js` é pública por design — a proteção real está nas policies do banco
- Cada colaborador do escritório terá seu próprio usuário criado manualmente no painel do Supabase
