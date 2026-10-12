# Relatório de auditoria — recompensas e Vitalidade

**Data:** 12 de outubro de 2026  
**Escopo:** Supabase, contratos entre frontend e backend, permissões e testes locais.

## Resumo

O erro inicial na tela de Vitalidade foi causado pela ausência de funções no banco, não apenas por um cache desatualizado do PostgREST. O engenheiro aplicou manualmente `supabase/migrations/202610110001_repair_character_resources_and_reward_rpcs.sql` no SQL Editor. As consultas posteriores confirmaram as sete RPCs, a tabela de histórico, a coluna `dados_version` e os três triggers esperados.

A auditoria também encontrou grants diretos de execução para `anon` e `authenticated` nas funções internas e nas RPCs. Foi preparada localmente uma migration separada para restringir esse acesso, mantendo as RPCs acessíveis a `authenticated`; a execução dessa migration no Supabase ainda precisa ser confirmada.

Nenhuma fixture foi criada no banco remoto. Os testes executados nesta sessão usam mocks locais.

## Diagnóstico e evidências do SQL Editor

Antes da migration de recuperação, os resultados informados mostraram:

- Sete RPCs ausentes: `creditar_ouro_campanha`, `creditar_experiencia_campanha`, `entregar_item_campanha`, `listar_recompensas_campanha`, `listar_maximos_recursos_campanha`, `get_character_resource_maximums` e `reconciliar_limites_recursos_personagem`.
- Ausência de `personagens.dados_version`.
- Ausência da tabela `public.campanha_recompensas`.
- Nenhum trigger instalado em `public.personagens`.
- A consulta ao histórico falhou com `42P01`: `supabase_migrations.schema_migrations` não existe neste projeto.

Depois de executar manualmente a migration `202610110001_repair_character_resources_and_reward_rpcs.sql`, o engenheiro informou:

- As sete RPCs existem com os nomes de parâmetros esperados e `authenticated_can_execute = true`.
- `campanha_recompensas` existe e `personagens.dados_version` está presente.
- Existem os triggers `personagens_00_limitar_recursos_insert`, `personagens_00_limitar_recursos_update` e `personagens_incrementar_versao_dados`.

A consulta posterior de ACL mostrou grants diretos do proprietário `postgres` para `anon`, `authenticated` e `service_role` nas 13 funções listadas (seis funções internas/de trigger e sete RPCs). Esses resultados foram fornecidos pelo engenheiro; não houve conexão direta do assistente ao banco.

## Alterações locais

### Corrigida a grafia da ficha

Em [CharacterSheet.tsx](../src/pages/CharacterSheet/CharacterSheet.tsx), os textos com codificação incorreta foram substituídos por português brasileiro válido em UTF-8. A correção inclui, entre outros, “Força”, “Constituição”, “Inventário”, “História”, “Nível”, mensagens de salvamento e rótulos acessíveis. Também foram corrigidos símbolos de navegação, separadores e o botão para esquecer magia. A lógica de dados, cálculos, permissões e interações foi preservada.

Os rótulos das abas agora correspondem às expectativas dos testes, inclusive “Inventário” e “História”.

### Fixtures locais e contratos

- [rewards.ts](../src/test/fixtures/rewards.ts) contém factories tipadas para campanha, personagem, item, histórico, associação e respostas de recursos.
- `src/pages/Campaign/Campaign.test.tsx`, `src/services/api.test.ts`, `src/pages/CharacterSheet/CharacterSheet.test.tsx` e `src/pages/CharacterSheet/CharacterSheetInventory.test.tsx` reutilizam essas fixtures.
- As fixtures são dados locais para o Vitest: não incluem credenciais nem fazem chamadas ao Supabase.
- [backend-compatibility-rewards-resources.md](./backend-compatibility-rewards-resources.md) documenta assinaturas RPC, permissões e roteiro de validação em staging.

### Migration local de permissões

[202610120001_restrict_internal_reward_function_execution.sql](../supabase/migrations/202610120001_restrict_internal_reward_function_execution.sql) foi criada como migration forward-only. Ela revoga `EXECUTE` de `anon` e `authenticated` nas seis funções internas, remove `anon` das sete RPCs e reafirma `authenticated` nas sete RPCs do app. Preserva proprietário, `service_role`, corpos de função, dados, triggers e RLS. O engenheiro ainda precisa confirmar sua aplicação remota.

## Compatibilidade esperada entre frontend e backend

- Créditos de ouro, XP e itens recebem os argumentos `p_campanha_id`, `p_quantia`/`p_item_id`/`p_quantidade`, `p_personagem_id` opcional e `p_request_id`; retornam um inteiro com a contagem de destinatários.
- A leitura de máximos da campanha recebe `p_campanha_id` e devolve linhas com `personagem_id`, `hp_atual`, `hp_max`, `mp_atual`, `mp_max`.
- A leitura/reconciliação de uma ficha recebe `p_personagem_id` e devolve `dados_version`, `hp_atual`, `mp_atual`, `hp_max`, `mp_max`.
- O frontend lê o histórico diretamente de `campanha_recompensas`, não pela RPC `listar_recompensas_campanha`. A tabela precisa permitir `SELECT` a membros autenticados ativos, protegido por RLS.
- XP e `dados_version` são colunas relacionais. O JSON `personagens.dados` mantém os valores atuais/temporários de HP e MP, não seus máximos derivados.
- Recompensas exigem Mestre ativo, membership/personagem elegível, execução transacional e idempotência por `request_id`.

## Validação local

- `npm run build`: aprovado após as alterações.
- `npm test -- --run`: **116 testes passaram em 18 arquivos**.
- As abas “Inventário” e “História” correspondem aos rótulos acessíveis esperados; os testes da ficha e da integração do inventário passaram.
- O Vitest ainda emitiu avisos React de atualizações fora de `act()` em testes da ficha e avisos `BufferGeometry` em testes de dados; não houve falhas.
- `npm run build`: aprovado após as alterações.
- Não foi executado teste funcional com gravações no Supabase remoto.

## Ações ainda necessárias

1. **Revisar e aplicar a migration de ACL no ambiente correto**, se aprovada. Depois, confirmar: `anon` sem execução nas 13 funções; `authenticated` sem execução nos seis helpers e com execução nas sete RPCs. Conferir também que `service_role` e os três triggers permanecem intactos.
2. **Documentar o fluxo de migrations deste projeto.** A tabela de histórico consultada não existe; não criar nem reparar histórico manualmente por inferência.
3. **Validar em staging isolado**, com contas e fixtures dedicadas: leitura do histórico e máximos; reconciliação de HP/MP; distribuição de ouro, XP e item; repetição de `request_id`; payload conflitante; e recusas de acesso para anônimo, jogador sem papel de Mestre e usuário fora da campanha.
4. **Não usar produção nem limpar fixtures automaticamente.** Operações de recompensa alteram saldo, XP, inventário e histórico e precisam de autorização explícita para ambiente e dados.

## Limites desta auditoria

- O assistente não executou consultas nem migrations remotas.
- O banco remoto foi avaliado somente pelos resultados colados pelo engenheiro.
- Os testes locais verificam contratos mockados; não comprovam ACL, RLS, transações, triggers ou idempotência real do PostgreSQL.
