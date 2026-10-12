# Orientação ao backend: compatibilidade de recompensas e Vitalidade

Este documento descreve o contrato que o frontend local espera do Supabase para distribuição de recompensas, histórico, XP e recursos HP/MP. É orientação de implementação e teste; **não autoriza nem executa alterações no banco**.

## 1. Estado remoto confirmado pelo engenheiro

Conforme resultados colados do SQL Editor:

- As sete RPCs esperadas existem com assinaturas/parâmetros correspondentes ao frontend.
- `campanha_recompensas` existe e `personagens.dados_version` existe.
- Estão presentes os triggers `personagens_00_limitar_recursos_insert`, `personagens_00_limitar_recursos_update` e `personagens_incrementar_versao_dados`.
- Antes da correção de ACL, `anon` e `authenticated` tinham grants diretos em todas as funções consultadas. A migration local [202610120001_restrict_internal_reward_function_execution.sql](../supabase/migrations/202610120001_restrict_internal_reward_function_execution.sql) propõe limitar esse acesso; sua execução remota ainda deve ser confirmada pelo responsável.

## 2. Contratos RPC chamados pelo frontend

As implementações estão em [`src/services/api.ts`](../src/services/api.ts:1561-1774); as chamadas de interface estão em [`Campaign.tsx`](../src/pages/Campaign/Campaign.tsx:432-489) e [`CharacterSheet.tsx`](../src/pages/CharacterSheet/CharacterSheet.tsx:685-723).

| RPC | Argumentos JSON do Supabase | Resposta esperada | Segurança de execução esperada |
|---|---|---|---|
| `creditar_ouro_campanha` | `p_campanha_id: uuid`, `p_quantia: integer`, `p_personagem_id: uuid \| null`, `p_request_id: uuid` | inteiro: destinatários atualizados | `authenticated`; valida Mestre ativo |
| `creditar_experiencia_campanha` | mesmos nomes/tipos da RPC de ouro | inteiro: destinatários atualizados | `authenticated`; valida Mestre ativo |
| `entregar_item_campanha` | `p_campanha_id: uuid`, `p_item_id: uuid`, `p_quantidade: integer`, `p_personagem_id: uuid \| null`, `p_request_id: uuid` | inteiro: destinatários atualizados | `authenticated`; valida Mestre ativo |
| `listar_maximos_recursos_campanha` | `p_campanha_id: uuid` | linhas `{personagem_id, hp_atual, hp_max, mp_atual, mp_max}` | `authenticated`; membro ativo |
| `get_character_resource_maximums` | `p_personagem_id: uuid` | JSON `{dados_version, hp_atual, mp_atual, hp_max, mp_max}` | `authenticated`; dono ou membro ativo |
| `reconciliar_limites_recursos_personagem` | `p_personagem_id: uuid` | JSON com os mesmos cinco campos de recursos | `authenticated`; dono ou Mestre ativo; mutação clamp intencional |
| `listar_recompensas_campanha` | `p_campanha_id: uuid` | conjunto de linhas de `campanha_recompensas` | `authenticated`; membro ativo; RPC atualmente não chamada pelo frontend |

Não renomear os argumentos; o PostgREST os usa para resolver as RPCs. Não converter as respostas em envelopes incompatíveis (`{data: ...}` adicional, strings numéricas ou nomes de coluna diferentes).

## 3. Contrato da tabela e do modelo de personagem

### `campanha_recompensas`

Campos consumidos pelo cliente: `id`, `campanha_id`, `personagem_id`, `item_id`, `tipo`, `quantidade`, `quantidade_item`, `total_destinatarios` e `created_at`. `tipo` aceita `OURO`, `XP` ou `ITEM`; uma chave única `(created_by, request_id)` protege replays.

O frontend **não chama** `listar_recompensas_campanha`: `listarRecompensasCampanha` faz `.from("campanha_recompensas").select(...).eq("campanha_id", ...).order("created_at", {ascending:false}).limit(20)`. Portanto, o backend precisa manter `SELECT` de `authenticated` na tabela e uma policy RLS que permita leitura a membro ativo da campanha. A policy e RPC não substituem a validação de acesso das operações mutáveis.

`personagem_id = null` representa recompensa para o grupo; `total_destinatarios` deve refletir quantos personagens receberam a recompensa. Para recompensa específica, preservar o ID do personagem. `quantidade_item` deve estar preenchida para `ITEM`.

### `personagens`

- `xp` é uma coluna relacional, devolvida no row mapper; não gravar XP dentro de `dados`.
- `dados_version` é relacional e controla concorrência otimista. O cliente espera inteiro; incrementá-lo quando `dados`, `nome`, `nivel` ou `campanha_id` realmente mudarem.
- `dados.hp.atual`, `dados.hp.temp`, `dados.mp.atual` e `dados.mp.temp` são persistíveis. Máximos (`hp_max`, `mp_max`) são derivados e **não devem** ser persistidos no JSON.
- Leitura de máximos devolve os valores atuais limitados aos máximos calculados. `reconciliar_limites_recursos_personagem` persiste o clamp em ficha editável e retorna a versão e valores atualizados.
- Os triggers de INSERT/UPDATE chamam a função de limite; o trigger de versão cuida do contrato de concorrência.

## 4. Regras de negócio que o backend deve preservar

1. Só Mestre com membership `MESTRE` e `status = 'ATIVO'` distribui OURO/XP/ITEM.
2. Destinatário deve pertencer à campanha e ser membro ativo; seleção de grupo atualiza apenas personagens elegíveis vinculados a membros ativos.
3. As funções validam autenticação, quantidades positivas e limites; preservar os limites atuais: ouro `1..100000`, item `1..9999`, XP inteiro positivo armazenável em `integer`.
4. `request_id` é chave idempotente por usuário: replay com mesmo payload retorna o resultado já registrado sem duplicar; reutilização com payload diferente falha claramente. Clientes mantêm a chave durante retries iguais.
5. As operações de recompensa e ledger devem ocorrer na mesma transação; falha no crédito, XP, inventário ou auditoria deve reverter o lote inteiro.
6. Não exponha funções auxiliares/de trigger por RPC direta. Com ACL confirmada, retirar `EXECUTE` de `anon` e `authenticated` nos seis helpers; preservar o owner/`service_role`. Manter sete RPCs de aplicação para `authenticated`, retirar acesso de `anon` a elas, conforme a migration de ACL local.
7. `listar_maximos_recursos_campanha` e `listar_recompensas_campanha` exigem membership ativo. Recursos de personagem exigem dono ou membership/Mestre conforme o contrato de cada RPC.

## 5. Fluxos do frontend para validar

### Campanha / distribuição

A tela carrega máximos autoritativos e histórico ao abrir uma campanha. Mestre pode entregar OURO, XP ou ITEM ao grupo ou a personagem específico. Sucesso atualiza mensagem e recarrega dados; erro permanece visível. O histórico fica visível a membro autorizado e combina o item com o catálogo para apresentar descrição.

### Ficha / Vitalidade

Ao carregar regras e permissões, a ficha chama `reconciliar_limites_recursos_personagem` quando pode editar; leitura sem permissão de edição chama `get_character_resource_maximums`. Até a sincronização autoritativa concluir, os controles ficam desabilitados. Resposta usa os nomes `dados_version`, `hp_atual`, `mp_atual`, `hp_max`, `mp_max`. Erro habilita tentativa de sincronização manual.

### Dados e concorrência

O row mapper usa `personagens.xp`, `personagens.dados_version`, `nivel` e `nome` relacionais. O autosave chama `atualizar_personagem_versionado(p_personagem_id, p_versao_esperada, p_nome, p_nivel, p_dados)`; mudanças em XP via recompensa não devem substituir o JSON de ficha nem causar regressão de versão.

## 6. Sequência recomendada de teste em staging

Use projeto de staging isolado, contas de teste reais para Mestre e jogador, campanha/personagens/item dedicados e quantidades pequenas. Não use produção, não limpe registros automaticamente, e registre saldos/XP/inventário antes/depois.

1. Confirmar ACL: `anon = false` para as 13 funções; `authenticated = false` para os seis helpers; `authenticated = true` para as sete RPCs; manter triggers ligados às mesmas funções.
2. Como Mestre ativo, ler máximos de campanha e de personagem; comparar `hp_atual <= hp_max` e `mp_atual <= mp_max`.
3. Como proprietário editável, chamar reconciliação; conferir clamp, ausência de chaves `max` no JSON e `dados_version` coerente. Como leitor sem edição, chamar apenas a leitura de máximos e confirmar ausência de alteração.
4. Dar quantidades pequenas de OURO, XP e um ITEM a um personagem dedicado. Conferir retorno (contagem), `carteira.po`, coluna `personagens.xp`, `inventarios.quantidade` e uma linha de histórico por request.
5. Repetir cada requisição com o mesmo `request_id` e mesmo payload: saldo/XP/quantidade do inventário e número de linhas não devem aumentar. Reutilizar a chave com payload diferente deve retornar erro e não gravar alterações.
6. Validar negações: anon não executa RPCs; jogador ativo não distribui; usuário fora da campanha não lista histórico/máximos nem reconcilia personagem alheio.
7. Recarregar as telas Campanha e Ficha como Mestre e jogador; confirmar histórico, XP, moedas e HP/MP atualizados pelo backend.

Executar uma categoria por vez. Se ocorrer erro, interromper, preservar o estado de staging e coletar request ID, horário, RPC e mensagem antes de repetir.

## 7. Cobertura automática existente e limite

- `src/services/api.test.ts`: mocks confirmam nomes dos RPCs, argumentos e shape das respostas.
- `src/pages/Campaign/Campaign.test.tsx`: cobre entrega de XP/item e chave estável durante retry.
- `src/pages/CharacterSheet/CharacterSheet.test.tsx` e `CharacterSheetInventory.test.tsx`: cobrem sincronização/reconciliação por mocks, além de interações da ficha.
- `src/domain/characterRules.test.ts` e `characterResources.test.ts`: cobrem cálculos locais e limites no cliente.

Esses testes não provam transações, grants, RLS ou execução PostgreSQL. O teste de staging acima é a verificação de integração necessária; não foi executado nesta tarefa.
