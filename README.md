# Macedo & Reis — Dashboards Internos

Sistema interno do escritório para gestão unificada dos setores: cadastro de clientes, departamento pessoal, fiscal, contábil, societário e financeiro.

## Stack

- **Frontend:** HTML/CSS/JavaScript (sem framework, sem build tools)
- **Hospedagem:** GitHub Pages
- **Backend:** [Supabase](https://supabase.com) (PostgreSQL + REST API + Auth)

## Estrutura

```
.
├── index.html              # Menu principal — entrada do sistema (protegido)
├── login.html              # Tela de login
├── clientes/               # Dashboard de cadastro de clientes
│   └── index.html          # Listagem (protegida)
└── assets/
    ├── css/
    │   └── style.css       # Estilos compartilhados (tema dark editorial)
    └── js/
        ├── supabase.js     # Inicialização do cliente Supabase + helpers de auth
        ├── auth-guard.js   # Proteção de páginas (exige login)
        └── utils.js        # Formatadores (CNPJ, CPF, telefone, data)
```

## Modelo de dados

Tabelas no Supabase:

- `clientes` — registro mestre (PJ e PF)
- `socios` — sócios de clientes PJ
- `contatos` — contatos adicionais por cliente
- `servicos_contratados` — quais setores do escritório atendem cada cliente

## Segurança

- Todas as tabelas usam **Row Level Security (RLS)**
- Acesso restrito a usuários autenticados via Supabase Auth
- Usuários criados manualmente no painel do Supabase (Authentication → Users)
