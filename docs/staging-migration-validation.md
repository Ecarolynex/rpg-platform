# Reconciliação e validação de migrations antes de integração

## Estado desta revisão

A revisão e as correções do frontend são locais. Nenhuma consulta, autenticação, migration, reparo ou escrita foi executada em Supabase. Não há confirmação do estado remoto, e este documento **não autoriza** aplicar migrations.

Existe uma colisão histórica no repositório: `202610010001_fix_shop_item_creator.sql` e `202610010001_shared_class_catalog.sql` tiveram o mesmo prefixo. A árvore de trabalho atual nomeia o catálogo `202610010002_shared_class_catalog.sql` e contém `202610100004_reconcile_shop_item_creator.sql`, mas isso não prova qual SQL está gravado na tabela de migrations de nenhum projeto remoto. Não renumerar nem reparar a história remota por inferência.

## Preflight obrigatório (sem writes)

1. Obter aprovação explícita para o projeto Supabase **dedicado a QA** e confirmar project ref/URL fora da produção. Não usar a URL/chave de outro `.env` ou um fallback.
2. Obter o resultado do histórico remoto de migrations e um dump `schema-only` desse projeto. Não executar `db push`, `migration repair`, SQL mutável, restauração nem seed nesta fase.
3. Identificar o conteúdo SQL efetivamente aplicado sob `202610010001` comparando função/tabelas/estado do schema. Registrar se corresponde ao fix da loja, catálogo de classe, ambos parcialmente ou a outro estado.
4. Comparar o schema com todas as migrations locais, em ordem cronológica, incluindo objetos preexistentes. O conjunto atualizado para validação vai até **`202610100007_idempotent_shop_purchases.sql`**:
   - `202610100001`: contrato V1, `dados_version`, item tipado e cargas;
   - `202610100002`: máximos autoritativos e consumo de item;
   - `202610100003`: ledger de recompensas, XP e RPCs de recursos;
   - `202610100004`: reconciliação da RPC de loja após a colisão antiga;
   - `202610100005`: criação atômica/idempotente de campanha;
   - `202610100006`: RLS de marcadores do mapa;
   - `202610100007`: checkout idempotente com `campanha_compras` e argumento `p_request_id`.
5. Conferir especificamente as assinaturas chamadas pela versão local do frontend. O checkout atual envia `p_request_id`; portanto, a RPC local de dois argumentos não satisfaz o contrato atual. Conferir também pré-requisitos e permissões para tabelas-base (`personagens`, `campanhas`, `campanha_membros`, `itens`, `inventarios`, `lojas`, `loja_itens`, `mapas` e `mapa_marcadores`), colunas, triggers e policies.
6. Produzir uma proposta de reconciliação versionada e revisável para o ambiente de QA. A proposta deve deixar claro como preservar a história remota e alinhar o schema com a migração `202610010002` sem reescrever o significado já aplicado de `202610010001`. Aguardar aprovação separada antes de qualquer operação que grave.

## Validação pós-aprovação (etapa futura)

Somente após o preflight, projeto isolado confirmado, backup e aprovação explícita:

1. Aplicar a proposta aprovada **apenas** no projeto de QA, nunca em produção.
2. Exercitar funções/RLS como proprietário, Mestre ativo, jogador ativo e usuário sem vínculo.
3. Verificar `request_id` repetido após resposta perdida para criação de campanha, checkout e recompensas; confirmar uma aplicação e comparar histórico/saldo/estoque/inventário.
4. Comparar máximos do servidor com `calculateDerivedCharacterStats` para raça, filiação, catálogo, override, classe de campanha, equipamento e limites; verificar ficha, resumo e uso de item.
5. Testar consumo/cargas, rollback em erro e RLS de marcadores invisíveis, alterações de posição e exclusão.
6. Registrar diferenças encontradas e resultados antes de considerar qualquer promoção.

**Não aplicar migrations com base apenas nesta revisão estática ou na numeração local.** O projeto de staging atual permanece desconhecido até a reconciliação documentada.
