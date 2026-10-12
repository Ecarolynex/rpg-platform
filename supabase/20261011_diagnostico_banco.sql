-- Elementum: DIAGNÓSTICO (só lê, não altera nada).
-- Rode no SQL Editor e me envie o resultado das duas tabelas.

-- 1) Funções (RPCs) que o código chama e NÃO existem no banco
select f.nome as funcao_faltando
from unnest(array[
  'adicionar_item_existente_loja','alterar_item_equipado','atualizar_personagem_versionado',
  'creditar_experiencia_campanha','creditar_ouro_campanha','criar_campanha_atomica',
  'entregar_item_campanha','get_character_resource_maximums','listar_maximos_recursos_campanha',
  'reconciliar_limites_recursos_personagem','registrar_compra_carrinho','remover_item_loja',
  'salvar_item_loja','usar_item_personagem','vincular_personagem_campanha'
]) as f(nome)
where not exists (
  select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname = 'public' and p.proname = f.nome
);

-- 2) Tabelas esperadas que NÃO existem
select t.nome as tabela_faltando
from unnest(array[
  'profiles','campanhas','campanha_membros','personagens','inventarios','itens','lojas',
  'loja_itens','mapas','mapa_marcadores','retratos','global_class_catalog',
  'campanha_classes_conteudos','campanha_recompensas'
]) as t(nome)
where to_regclass('public.' || t.nome) is null;
