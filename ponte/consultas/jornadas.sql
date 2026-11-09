-- jornadas.sql (versão 4 do pacote, 09/11/2026): a jornada dos funcionários — a foto do dia, uma vez por rodada, pro
-- fim da escala 6x1 (EC 141/2026: 42 horas e 2 dias de repouso a partir de 16/12/2026, 40 horas a partir de 16/12/2027).
-- Uma linha por empresa e GRUPO de empregados: o grupo é (codigo, jornada, horas_semana, horas_mes, forma, controle,
-- categoria, unidade). Só quantos e somas: nome, CPF, cargo e o salário de cada pessoa ficam no PC.
-- Parâmetros, nessa ordem: o dia de hoje (date) e o salário do art. 8º da EC 141 (numeric; 2,5 × o teto do RGPS do
-- ano, a constante TETO_ART8 de ponte/fonte.py).
-- Tabelas: bethadba.foempregados ("Empregados - Cadastro": I_JORNADA, horas_semana, horas_mes, FORMA_CALCULO,
-- TIPO_HORARIO, HORAS_COMPENSADAS, grau_instrucao, salario, categoria e as categorias eSocial), bethadba.FOTROCAS_JORNADAS
-- (DATA_TROCA, I_JORNADA), bethadba.FOJORNADAS (TIPO, TIPO_ESCALA), bethadba.FOJORNADAS_HORARIOS (DIA_SEMANA, I_HORARIO)
-- e bethadba.FOHORARIOS (TIPO, DURACAO_JORNADA_MINUTOS); os ativos, os afastados e o corte das empresas, como no
-- folha.sql (bethadba.forescisoes, bethadba.FOAFASTAMENTOS, bethadba.fobasesserv, bethadba.geempre).
-- Ativo hoje: empregado (categoria eSocial de 101 a 111), admitido até hoje (no cadastro por sucessão ou transferência, a
--   partir da data_transf) e sem rescisão normal (tipo 1) com demissão até hoje; na empresa ativa no Domínio (stat_emp
--   A, M, C ou B) ou com a folha mensal do mês de hoje calculada — o corte do folha.sql, pra somar o mesmo que o
--   funcionarios_ativos do mês. afastados: os do folha.sql, no dia de hoje.
-- jornada: a da troca mais recente até hoje (bethadba.FOTROCAS_JORNADAS); sem troca, o I_JORNADA do cadastro (em
--   09/11/2026 as duas eram a mesma nos 275 ativos). tipo e tipo_escala: os da FOJORNADAS.
-- semana: segunda a domingo, um caractere por dia — T trabalhado, C compensado, F folga, - sem horário (FOHORARIOS.TIPO
--   1, 2 e 3). O DIA_SEMANA 1 (segunda a sexta) vale pros dias de 2 a 6 que não têm linha própria (a linha do dia manda);
--   mais de um horário no mesmo dia: T se algum é trabalhado, senão C, senão F, e os minutos somam. A jornada com
--   linha nos dias 9 a 12 (1º, 2º e 3º dia, escala) é de escala: semana null, e o ciclo é contado nessas linhas (cada
--   linha um dia do ciclo; em 09/11/2026 nenhuma jornada em uso tinha esses dias).
-- min_semana e min_maior_dia: os minutos dos dias trabalhados, pelo DURACAO_JORNADA_MINUTOS, que já desconta o intervalo
--   (75 dos 94 horários trabalhados com intervalo fixo em uso batem com a saída menos a entrada menos o intervalo; o
--   resto, até 54 minutos a menos). Horário trabalhado com duração de 0 ou 1 minuto é um marcador sem a hora (entrada
--   igual à saída): o dia não tem os minutos, e o min_semana e o min_maior_dia saem null. Na escala, a média do ciclo:
--   7 × os minutos trabalhados no ciclo ÷ os dias do ciclo, arredondado.
-- unidade: a unidade do salário no código do eSocial (undSalFixo), pela categoria do cadastro do Domínio (a coluna
--   categoria, que os parâmetros da folha chamam de mensalista, horista…): 1 = mensalista → 5 (mês); 5 = horista → 1
--   (hora) — conferido em 09/11/2026 contra o salário-hora do último cálculo da folha (fobasesserv.SALARIO_HORA): na 1, o
--   salário é o salário-hora × as horas do mês; na 5, é o salário-hora. Outro código fica null (em 09/11/2026, o 7, de
--   4 cadastros, sem salário-hora no cálculo).
-- superior: grau_instrucao 9 ou mais (a tabela do grau de instrução do eSocial: 9 é o superior completo; 10 a 12, a
--   pós-graduação, o mestrado e o doutorado). superior_teto: deles, com o salário do mês a partir do 2º parâmetro (o do
--   horista, salário × horas_mes).
-- salarios: a soma do salário do cadastro do grupo, na unidade do grupo (o grupo leva a unidade: a hora do horista não
--   se mistura com o mês do mensalista).
WITH p AS (SELECT CAST(? AS DATE) AS hoje, CAST(? AS NUMERIC(17, 2)) AS teto),
mm AS (SELECT p.hoje, p.teto, YMD(YEAR(p.hoje), MONTH(p.hoje), 1) AS ini,
              DATEADD(day, -1, DATEADD(month, 1, YMD(YEAR(p.hoje), MONTH(p.hoje), 1))) AS fim FROM p),
calc AS (
    SELECT b.codi_emp
      FROM bethadba.fobasesserv b, mm
     WHERE b.competencia BETWEEN mm.ini AND mm.fim AND b.tipo_process = 11 AND b.simulacao = 0
     GROUP BY b.codi_emp
),
empresas AS (
    SELECT g.codi_emp FROM bethadba.geempre g WHERE UPPER(TRIM(g.stat_emp)) IN ('A', 'M', 'C', 'B')
    UNION
    SELECT c.codi_emp FROM calc c
),
emp AS (
    SELECT e.codi_emp,
           COALESCE((SELECT t.I_JORNADA FROM bethadba.FOTROCAS_JORNADAS t
                      WHERE t.CODI_EMP = e.codi_emp AND t.I_EMPREGADOS = e.i_empregados
                        AND t.DATA_TROCA = (SELECT MAX(t2.DATA_TROCA) FROM bethadba.FOTROCAS_JORNADAS t2
                                             WHERE t2.CODI_EMP = e.codi_emp AND t2.I_EMPREGADOS = e.i_empregados
                                               AND t2.DATA_TROCA <= mm.hoje)), e.I_JORNADA) AS jornada,
           e.horas_semana, e.horas_mes, e.FORMA_CALCULO AS forma, e.TIPO_HORARIO AS controle,
           COALESCE(e.CATEGORIA_ESOCIAL_EMPREGADO, e.CATEGORIA_ESOCIAL) AS categoria,
           CASE e.categoria WHEN 1 THEN 5 WHEN 5 THEN 1 END AS unidade,
           e.salario AS valor,
           CASE WHEN EXISTS (SELECT 1 FROM bethadba.FOAFASTAMENTOS a
                              WHERE a.CODI_EMP = e.codi_emp AND a.I_EMPREGADOS = e.i_empregados
                                AND a.DATA_REAL <= mm.hoje
                                AND (a.DATA_FIM IS NULL OR a.DATA_FIM >= mm.hoje)
                                AND a.I_AFASTAMENTOS NOT IN (1, 8, 9, 23, 52, 53))
                THEN 1 ELSE 0 END AS afastado,
           CASE WHEN COALESCE(e.HORAS_COMPENSADAS, 0) > 0 THEN 1 ELSE 0 END AS compensa,
           CASE WHEN e.grau_instrucao >= 9 THEN 1 ELSE 0 END AS superior,
           CASE WHEN e.grau_instrucao >= 9
                 AND (CASE e.categoria WHEN 5 THEN e.salario * e.horas_mes ELSE e.salario END) >= mm.teto
                THEN 1 ELSE 0 END AS superior_teto
      FROM bethadba.foempregados e, mm
     WHERE COALESCE(e.CATEGORIA_ESOCIAL_EMPREGADO, e.CATEGORIA_ESOCIAL) BETWEEN 101 AND 111
       AND (CASE WHEN e.emprego_ant IN (2, 3, 4) AND e.data_transf > e.admissao
                 THEN e.data_transf ELSE e.admissao END) <= mm.hoje
       AND NOT EXISTS (SELECT 1 FROM bethadba.forescisoes r
                        WHERE r.codi_emp = e.codi_emp AND r.i_empregados = e.i_empregados
                          AND r.tipo = 1 AND r.demissao <= mm.hoje)
       AND e.codi_emp IN (SELECT x.codi_emp FROM empresas x)
),
uso AS (SELECT DISTINCT codi_emp, jornada FROM emp WHERE jornada IS NOT NULL),
dias AS (SELECT 2 AS d UNION ALL SELECT 3 UNION ALL SELECT 4 UNION ALL SELECT 5 UNION ALL SELECT 6
         UNION ALL SELECT 7 UNION ALL SELECT 8),
hj AS (
    SELECT DISTINCT h.CODI_EMP AS codi_emp, h.I_JORNADA AS jornada, dias.d AS dia, h.I_HORARIO AS horario
      FROM bethadba.FOJORNADAS_HORARIOS h
      JOIN uso ON uso.codi_emp = h.CODI_EMP AND uso.jornada = h.I_JORNADA
      JOIN dias ON dias.d = h.DIA_SEMANA
                OR (h.DIA_SEMANA = 1 AND dias.d BETWEEN 2 AND 6
                    AND NOT EXISTS (SELECT 1 FROM bethadba.FOJORNADAS_HORARIOS h2
                                     WHERE h2.CODI_EMP = h.CODI_EMP AND h2.I_JORNADA = h.I_JORNADA
                                       AND h2.DIA_SEMANA = dias.d))
),
hd AS (
    SELECT hj.codi_emp, hj.jornada, hj.dia,
           CASE MIN(o.TIPO) WHEN 1 THEN 'T' WHEN 2 THEN 'C' WHEN 3 THEN 'F' ELSE '-' END AS letra,
           SUM(CASE WHEN o.TIPO = 1 AND o.DURACAO_JORNADA_MINUTOS > 1 THEN o.DURACAO_JORNADA_MINUTOS ELSE 0 END) AS minutos,
           SUM(CASE WHEN o.TIPO = 1 AND COALESCE(o.DURACAO_JORNADA_MINUTOS, 0) <= 1 THEN 1 ELSE 0 END) AS sem_duracao
      FROM hj JOIN bethadba.FOHORARIOS o ON o.CODI_EMP = hj.codi_emp AND o.I_HORARIO = hj.horario
     GROUP BY hj.codi_emp, hj.jornada, hj.dia
),
sem AS (
    SELECT codi_emp, jornada,
           COALESCE(MAX(CASE WHEN dia = 2 THEN letra END), '-') || COALESCE(MAX(CASE WHEN dia = 3 THEN letra END), '-')
           || COALESCE(MAX(CASE WHEN dia = 4 THEN letra END), '-') || COALESCE(MAX(CASE WHEN dia = 5 THEN letra END), '-')
           || COALESCE(MAX(CASE WHEN dia = 6 THEN letra END), '-') || COALESCE(MAX(CASE WHEN dia = 7 THEN letra END), '-')
           || COALESCE(MAX(CASE WHEN dia = 8 THEN letra END), '-') AS semana,
           CASE WHEN SUM(sem_duracao) > 0 THEN NULL ELSE SUM(minutos) END AS min_semana,
           CASE WHEN SUM(sem_duracao) > 0 THEN NULL
                ELSE MAX(CASE WHEN letra = 'T' AND minutos > 0 THEN minutos END) END AS min_maior_dia
      FROM hd
     GROUP BY codi_emp, jornada
),
esc AS (
    SELECT h.CODI_EMP AS codi_emp, h.I_JORNADA AS jornada, COUNT(*) AS ciclo_dias,
           SUM(CASE WHEN o.TIPO = 1 THEN 1 ELSE 0 END) AS ciclo_trabalho,
           SUM(CASE WHEN o.TIPO = 1 AND o.DURACAO_JORNADA_MINUTOS > 1 THEN o.DURACAO_JORNADA_MINUTOS ELSE 0 END) AS min_ciclo,
           SUM(CASE WHEN o.TIPO = 1 AND COALESCE(o.DURACAO_JORNADA_MINUTOS, 0) <= 1 THEN 1 ELSE 0 END) AS sem_duracao,
           MAX(CASE WHEN o.TIPO = 1 AND o.DURACAO_JORNADA_MINUTOS > 1 THEN o.DURACAO_JORNADA_MINUTOS END) AS maior
      FROM bethadba.FOJORNADAS_HORARIOS h
      JOIN uso ON uso.codi_emp = h.CODI_EMP AND uso.jornada = h.I_JORNADA
      LEFT JOIN bethadba.FOHORARIOS o ON o.CODI_EMP = h.CODI_EMP AND o.I_HORARIO = h.I_HORARIO
     WHERE h.DIA_SEMANA BETWEEN 9 AND 12
     GROUP BY h.CODI_EMP, h.I_JORNADA
),
jor AS (
    SELECT uso.codi_emp, uso.jornada, j.TIPO AS tipo, j.TIPO_ESCALA AS tipo_escala,
           CASE WHEN esc.jornada IS NOT NULL THEN NULL ELSE COALESCE(sem.semana, REPEAT('-', 7)) END AS semana,
           CASE WHEN esc.jornada IS NULL THEN sem.min_semana
                WHEN esc.sem_duracao > 0 THEN NULL
                ELSE CAST(ROUND(7.0 * esc.min_ciclo / esc.ciclo_dias, 0) AS INTEGER) END AS min_semana,
           CASE WHEN esc.jornada IS NULL THEN sem.min_maior_dia
                WHEN esc.sem_duracao > 0 THEN NULL
                ELSE esc.maior END AS min_maior_dia,
           esc.ciclo_dias, esc.ciclo_trabalho
      FROM uso
      LEFT JOIN bethadba.FOJORNADAS j ON j.CODI_EMP = uso.codi_emp AND j.I_JORNADA = uso.jornada
      LEFT JOIN sem ON sem.codi_emp = uso.codi_emp AND sem.jornada = uso.jornada
      LEFT JOIN esc ON esc.codi_emp = uso.codi_emp AND esc.jornada = uso.jornada
),
grp AS (
    SELECT codi_emp, jornada, horas_semana, horas_mes, forma, controle, categoria, unidade,
           COUNT(*) AS empregados, SUM(afastado) AS afastados, SUM(compensa) AS compensa_sabado,
           SUM(superior) AS superior, SUM(superior_teto) AS superior_teto, SUM(valor) AS soma
      FROM emp
     GROUP BY codi_emp, jornada, horas_semana, horas_mes, forma, controle, categoria, unidade
)
SELECT grp.codi_emp AS codigo,
       grp.jornada AS jornada,
       jor.tipo AS tipo,
       jor.tipo_escala AS tipo_escala,
       jor.semana AS semana,
       jor.min_semana AS min_semana,
       jor.min_maior_dia AS min_maior_dia,
       jor.ciclo_dias AS ciclo_dias,
       jor.ciclo_trabalho AS ciclo_trabalho,
       grp.horas_semana AS horas_semana,
       grp.horas_mes AS horas_mes,
       grp.forma AS forma,
       grp.controle AS controle,
       grp.categoria AS categoria,
       grp.unidade AS unidade,
       grp.empregados AS empregados,
       grp.afastados AS afastados,
       grp.compensa_sabado AS compensa_sabado,
       grp.superior AS superior,
       grp.superior_teto AS superior_teto,
       grp.soma AS salarios
  FROM grp
  LEFT JOIN jor ON jor.codi_emp = grp.codi_emp AND jor.jornada = grp.jornada
 ORDER BY grp.codi_emp, grp.jornada, grp.horas_semana, grp.horas_mes, grp.forma, grp.controle, grp.categoria, grp.unidade
