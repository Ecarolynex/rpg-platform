# Contrato de dados da personagem — versão 1

## Fronteira entre linha e JSONB

`personagens.id`, `user_id`, `campanha_id`, `nome`, `nivel`, `xp` e `dados_version` são metadados relacionais. O JSONB `personagens.dados` contém estado de ficha, iniciado com `schemaVersion: 1`. XP é atualizado por RPC de recompensa, não pelo autosave do JSON.

```json
{
  "schemaVersion": 1,
  "raca": "Humano",
  "classe": "Guerreiro",
  "classeId": "guerreiro",
  "nivel": 1,
  "attributes": {
    "forca": 10,
    "destreza": 10,
    "constituicao": 10,
    "inteligencia": 10,
    "carisma": 10
  },
  "hp": { "atual": 18, "temp": 3 },
  "mp": { "atual": 12, "temp": 0 },
  "skills": [],
  "inventory": [],
  "spells": [],
  "carteira": { "pc": 0, "pp": 0, "pe": 0, "po": 0, "pl": 0 },
  "notas": ""
}
```

`hp.atual`, `mp.atual` e as reservas temporárias são persistidos. Máximos, atributos efetivos e bônus agregados são derivados e não fazem parte do JSONB V1. `parseCharacterData` lê registros legados sem versão e normaliza para V1; campos desconhecidos são preservados em round-trip.

## Resolução de regras

`calculateDerivedCharacterStats` é a implementação canônica de frontend: mantém os atributos-base e devolve bônus discriminados por raça, classe, filiação e equipamento. Precedência de classe: override explícito da campanha, conteúdo de classe da campanha, catálogo global e regra local. Uma campanha substitui bônus de classe correspondentes; os demais tipos de origem são somados.

Fórmulas aprovadas:

- PV: `dado de vida + modificador de Constituição + (nível - 1) × max(1, floor(dado / 2) + 1 + modificador de Constituição)`; somar bônus aplicáveis e limitar a 200.
- PM: `8 + Inteligência`; somar bônus aplicáveis e limitar entre 0 e 200.
- Ao aumentar máximos, os atuais não são restaurados. Se o máximo cair abaixo do atual, o atual é limitado ao novo máximo.
- Em perdas/consumos, PV/PM temporário é consumido antes do recurso normal.

## Persistência e concorrência

- `atualizar_personagem_versionado` usa `dados_version` para rejeitar snapshots obsoletos.
- `vincular_personagem_campanha` é transacional/idempotente, conserva ficha e carteira e não concede ouro inicial automaticamente.
- `registrar_compra` e `registrar_compra_carrinho` continuam como operações transacionais existentes.
- `creditar_ouro_campanha`, `creditar_experiencia_campanha` e `entregar_item_campanha` aplicam recompensas do Mestre em uma transação, sem regravar snapshot de ficha; `request_id` idempotente e `campanha_recompensas` permitem evitar duplicidade e consultar o histórico.
- `reconciliar_limites_recursos_personagem` devolve PV/PM atuais e máximos calculados pelo servidor para a ficha, usando o mesmo conjunto de fontes que a RPC de uso de item.
- `salvar_item_loja` armazena bônus/efeitos/cargas tipados; `usar_item_personagem` consome item/cargas e aplica restauração de recurso na mesma transação.
- `aplicar_limites_recursos_personagem` é executada em criação e atualização da ficha para garantir no banco que PV/PM atuais não excedam os máximos efetivos e que máximos derivados não sejam persistidos.

`usar_item_personagem` agora deriva PV/PM máximos dentro do PostgreSQL a partir dos dados-base persistidos, bônus fixos de raça/filiação/classe, catálogo global, substituições/conteúdo da campanha e bônus de atributos dos itens equipados. Os parâmetros antigos de máximo permanecem opcionais e ignorados durante rollout de clientes antigos; o novo cliente deixa de enviá-los. A RPC retorna `hp_max` e `mp_max` derivados pelo servidor.

A migration protege a escrita do catálogo global com a claim confiável `app_metadata.global_rules_admin=true`; atribua-a somente a operadores autorizados via painel/API administrativa. O cliente oculta os controles para usuários sem claim, mas a policy RLS é a barreira de segurança. Esta mudança impede falsificar máximos via payload da RPC, mas não substitui a autorização adequada para administrar regras da campanha.

## Rollout

1. Antes de qualquer aplicação, usar um projeto Supabase de QA isolado, backup e aprovação explícita. Consultar o histórico e comparar schema/RPCs/policies; reconciliar a colisão histórica `202610010001` conforme [staging-migration-validation.md](./staging-migration-validation.md). Só então aplicar, em ordem, o conjunto local até `202610100007`, incluindo a migration de checkout idempotente `registrar_compra_carrinho(..., p_request_id)`.
2. Verificar criação/serialização de V1 e campos temporários com fichas legadas; exercitar concorrência entre edição da ficha, compra, vínculo, distribuição de ouro e consumo.
3. Testar autorização negativa/positiva para proprietário, Mestre, jogador e usuário sem vínculo; confirmar rollback de falhas em compras e uso de itens.
4. Comparar saldos, XP, entregas, histórico, contagens e quantidades antes/depois; só então aplicar em produção com cópia de segurança e plano de recuperação.

**Limite atual:** as migrações e RPCs foram versionadas no repositório, mas não aplicadas nem executadas contra um Supabase conectado nesta implementação. A aplicação em produção exige auditoria do esquema real e execução do roteiro em staging.
