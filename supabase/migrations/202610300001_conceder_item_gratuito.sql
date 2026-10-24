-- Migration: Add RPC for free item granting by Master (conceder_item_gratuito)
-- This function validates Master permissions, records the reward in campanha_recompensas,
-- and upserts the inventory row for the character.

CREATE OR REPLACE FUNCTION public.conceder_item_gratuito(
  p_campanha_id uuid,
  p_item_id uuid,
  p_quantidade integer,
  p_personagem_id uuid DEFAULT NULL,
  p_request_id uuid DEFAULT gen_random_uuid()
) RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER SET search_path = public, pg_temp AS $$
DECLARE
  v_usuario_id uuid := auth.uid();
  v_req_id uuid := COALESCE(p_request_id, gen_random_uuid());
  v_operation_id bigint;
  v_existing public.campanha_recompensas%ROWTYPE;
BEGIN
  -- Auth check
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado.';
  END IF;

  -- Quantity validation
  IF p_quantidade IS NULL OR p_quantidade <= 0 OR p_quantidade > 9999 THEN
    RAISE EXCEPTION 'A quantidade de itens deve estar entre 1 e 9999.';
  END IF;

  -- Item existence
  IF NOT EXISTS (SELECT 1 FROM public.itens WHERE id = p_item_id) THEN
    RAISE EXCEPTION 'O item selecionado não existe mais.';
  END IF;

  -- Master permission for the campaign
  IF NOT EXISTS (
    SELECT 1 FROM public.campanha_membros membro
    WHERE membro.campanha_id = p_campanha_id
      AND membro.user_id = v_usuario_id
      AND membro.papel = 'MESTRE'
      AND membro.status = 'ATIVO'
  ) THEN
    RAISE EXCEPTION 'Somente o Mestre ativo pode conceder itens gratuitamente.';
  END IF;

  -- Verify character belongs to the campaign (if a specific character is given)
  IF p_personagem_id IS NOT NULL THEN
    IF NOT EXISTS (
      SELECT 1 FROM public.personagens pers
      WHERE pers.id = p_personagem_id
        AND pers.campanha_id = p_campanha_id
    ) THEN
      RAISE EXCEPTION 'O personagem não pertence à campanha especificada.';
    END IF;
  END IF;

  -- Insert reward record for audit
  INSERT INTO public.campanha_recompensas (
    campanha_id, personagem_id, item_id, tipo, quantidade, quantidade_item, request_id, created_by
  ) VALUES (
    p_campanha_id, p_personagem_id, p_item_id, 'ITEM', p_quantidade, p_quantidade, v_req_id, v_usuario_id
  ) ON CONFLICT (created_by, request_id) DO NOTHING
  RETURNING id INTO v_operation_id;

  -- If this request was already processed, fetch existing record (id not needed further)
  IF v_operation_id IS NULL THEN
    SELECT * INTO v_existing
    FROM public.campanha_recompensas
    WHERE created_by = v_usuario_id AND request_id = v_req_id;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'Operação de concessão inesperada – registro não encontrado.';
    END IF;
    RETURN 0; -- no new reward inserted
  END IF;

  -- Upsert inventory for the character (if a character was specified)
  IF p_personagem_id IS NOT NULL THEN
    INSERT INTO public.inventarios (personagem_id, item_id, quantidade, equipado, updated_at)
    VALUES (p_personagem_id, p_item_id, p_quantidade, false, now())
    ON CONFLICT (personagem_id, item_id) DO UPDATE
      SET quantidade = inventarios.quantidade + EXCLUDED.quantidade,
          updated_at = now();
  END IF;

  RETURN 1; -- new reward created
END;
$$;

-- Grant execute to authenticated role (RLS policies already protect access)
GRANT EXECUTE ON FUNCTION public.conceder_item_gratuito(uuid, uuid, integer, uuid, uuid) TO authenticated;
