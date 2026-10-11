import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import {
  alterarItemEquipado,
  getInventory,
  usarItemPersonagem,
  type ItemUseReceipt,
} from "../../services/api";
import "./InventoryItems.css";

type InventoryItemData = {
  id: string;
  bonus_atributos?: Record<string, number> | null;
  nome: string;
  descricao: string | null;
  tipo: string | null;
  raridade: string | null;
  efeito: string | null;
  imagem_url: string | null;
  efeito_mecanico?: { tipo: string; recurso?: "hp" | "mp"; valor?: number } | null;
  cargas_maximas?: number | null;
};

type InventoryRow = {
  personagem_id: string;
  item_id: string;
  quantidade: number;
  cargas_atuais?: number | null;
  equipado?: boolean;
  itens: InventoryItemData | InventoryItemData[] | null;
};

type PersistedInventoryItem = {
  itemId: string;
  quantidade: number;
  cargasAtuais: number | null;
  equipado: boolean;
  item: InventoryItemData | null;
};

type InventoryItemsProps = {
  characterId: string;
  campaignId?: string | null;
  onEquipmentChanged?: () => void;
  onItemUsed?: (receipt: ItemUseReceipt) => void | Promise<void>;
};

function normalizeInventoryRows(
  rows: InventoryRow[],
): PersistedInventoryItem[] {
  return rows.map((row) => {
    const quantidade = Number(row.quantidade) || 0;
    const item = Array.isArray(row.itens) ? row.itens[0] ?? null : row.itens;
    return {
      itemId: row.item_id,
      quantidade,
      cargasAtuais: row.cargas_atuais ?? (item?.cargas_maximas ? item.cargas_maximas * quantidade : null),
      equipado: row.equipado === true,
      item,
    };
  });
}

export default function InventoryItems({
  characterId,
  campaignId,
  onEquipmentChanged,
  onItemUsed,
}: InventoryItemsProps) {
  const [items, setItems] = useState<PersistedInventoryItem[]>([]);
  const [loadResult, setLoadResult] = useState<{
    requestKey: string;
    error: string;
  } | null>(null);
  const [attempt, setAttempt] = useState(0);
  const [actionError, setActionError] = useState("");
  const requestKey = `${characterId}:${attempt}`;
  const loading = loadResult?.requestKey !== requestKey;
  const loadError = loadResult?.requestKey === requestKey ? loadResult.error : "";
  const error = actionError || loadError;
  const [alterandoItem, setAlterandoItem] = useState<string | null>(
    null,
  );

  useEffect(() => {
    let active = true;

    getInventory(characterId)
      .then((data) => {
        if (active) {
          setItems(normalizeInventoryRows(data as InventoryRow[]));
          setLoadResult({ requestKey, error: "" });
        }
      })
      .catch((err: unknown) => {
        console.error("Erro ao carregar inventário:", err);

        if (active) {
          setItems([]);
          setLoadResult({
            requestKey,
            error:
              err instanceof Error
                ? err.message
                : "Não foi possível carregar o inventário.",
          });
        }
      });

    return () => {
      active = false;
    };
  }, [characterId, requestKey]);

  async function usarItem(item: PersistedInventoryItem) {
    if (!item.item || (!item.item.efeito_mecanico || item.item.efeito_mecanico.tipo === "NENHUM") && item.item.tipo !== "CONSUMIVEL" && !item.item.cargas_maximas) return;
    setAlterandoItem(item.itemId);
    setActionError("");
    try {
      const receipt = await usarItemPersonagem(characterId, item.itemId);
      setItems((current) => current.map((entry) => entry.itemId === item.itemId
        ? { ...entry, quantidade: receipt.quantidade, cargasAtuais: item.item?.cargas_maximas ? Math.max(0, (item.cargasAtuais ?? 0) - 1) : entry.cargasAtuais }
        : entry).filter((entry) => entry.quantidade > 0));
      await onItemUsed?.(receipt);
      setAttempt((current) => current + 1);
    } catch (error) {
      setActionError(error instanceof Error ? error.message : "Não foi possível usar o item.");
    } finally {
      setAlterandoItem(null);
    }
  }

  async function alternarEquipamento(
    item: PersistedInventoryItem,
  ) {
    if (!item.itemId) {
      return;
    }

    setAlterandoItem(item.itemId);
    setActionError("");

    const novoEstado = !item.equipado;

    try {
      await alterarItemEquipado(
        characterId,
        item.itemId,
        novoEstado,
      );

      setItems((atual) =>
        atual.map((itemAtual) =>
          itemAtual.itemId === item.itemId
            ? {
                ...itemAtual,
                equipado: novoEstado,
              }
            : itemAtual,
        ),
      );
      onEquipmentChanged?.();
    } catch (err: unknown) {
      console.error(
        "Erro ao alterar equipamento:",
        err,
      );

      setActionError(
        err instanceof Error
          ? err.message
          : "Não foi possível alterar o equipamento.",
      );
    } finally {
      setAlterandoItem(null);
    }
  }

  if (loading) {
    return (
      <p
        className="status-message"
        role="status"
      >
        Carregando inventário...
      </p>
    );
  }

  if (error && items.length === 0) {
    return (
      <div
        className="status-message status-message--error"
        role="alert"
      >
        <p>{error}</p>

        <button
          type="button"
          className="btn-ghost inventory-retry"
          onClick={() => {
            setActionError("");
            setAttempt((current) => current + 1);
          }}
        >
          Tentar novamente
        </button>
      </div>
    );
  }

  if (items.length === 0) {
    return (
      <div className="inventory-empty">
        <h2>Inventário vazio</h2>

        <p>
          O inventário persistido deste personagem está vazio.
        </p>

        {campaignId && (
          <Link
            to={`/campanha/${campaignId}/loja`}
            className="btn-primary"
          >
            Adicionar itens pela loja
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="inventory-content">
      <div className="inventory-actions">
        <h2 className="inventory-section-title">
          Itens do personagem
        </h2>

        {campaignId && (
          <Link
            to={`/campanha/${campaignId}/loja`}
            className="btn-ghost inventory-shop-link"
          >
            Adicionar itens pela loja
          </Link>
        )}
      </div>

      {error && (
        <div
          className="status-message status-message--error"
          role="alert"
        >
          {error}
        </div>
      )}

      <div
        className="inventory-grid"
        role="region"
        aria-label="Inventário persistido do personagem"
      >
        {items.map((inventoryItem) => {
          const estaEquipado =
            inventoryItem.equipado === true;

          const alterando =
            alterandoItem === inventoryItem.itemId;

          return (
            <article
              key={inventoryItem.itemId}
              className={
                estaEquipado
                  ? "inventory-item inventory-item--equipped"
                  : "inventory-item"
              }
            >
              <div className="inventory-item-head">
                {inventoryItem.item?.imagem_url && (
                  <img
                    className="inventory-item-image"
                    src={inventoryItem.item.imagem_url}
                    alt=""
                    aria-hidden="true"
                    onError={(event) => {
                      event.currentTarget.hidden = true;
                    }}
                  />
                )}

                <h2 className="inventory-item-title">
                  {inventoryItem.item
                    ? inventoryItem.item.nome
                    : "Item desconhecido"}
                </h2>

                <span className="inventory-item-quantity">
                  x{inventoryItem.quantidade}
                </span>
              </div>

              {(inventoryItem.item?.tipo ||
                inventoryItem.item?.raridade ||
                estaEquipado) && (
                <div className="inventory-item-meta">
                  {(inventoryItem.item?.tipo ||
                    inventoryItem.item?.raridade) && (
                    <span className="inventory-item-kind">
                      {[
                        inventoryItem.item?.tipo,
                        inventoryItem.item?.raridade,
                      ]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                  )}

              {estaEquipado && (
                    <span className="inventory-item-equipped">
                      Equipado
                    </span>
                  )}
                  {inventoryItem.item?.cargas_maximas && (
                    <span className="inventory-item-equipped">
                      Cargas {inventoryItem.cargasAtuais ?? 0}
                    </span>
                  )}
                </div>
              )}

              {inventoryItem.item?.descricao && (
                <p className="inventory-item-description">
                  {inventoryItem.item.descricao}
                </p>
              )}

              {inventoryItem.item?.efeito && (
                <p className="inventory-item-effect">
                  ✦ {inventoryItem.item.efeito}
                </p>
              )}

              <div className="inventory-item-actions">
                <button
                  type="button"
                  className={
                    estaEquipado
                      ? "btn-ghost inventory-equip-button inventory-equip-button--equipped"
                      : "btn-primary inventory-equip-button"
                  }
                  disabled={alterando}
                  onClick={() => void alternarEquipamento(inventoryItem)}
                >
                  {alterando
                    ? "Salvando..."
                    : estaEquipado
                      ? "Desequipar"
                      : "Equipar"}
                </button>
                {(inventoryItem.item?.tipo === "CONSUMIVEL" || (inventoryItem.item?.cargas_maximas ?? 0) > 0) && (
                  <button
                    type="button"
                    className="btn-ghost inventory-use-button"
                    disabled={alterando || inventoryItem.quantidade <= 0 || (inventoryItem.cargasAtuais !== null && inventoryItem.cargasAtuais <= 0)}
                    onClick={() => void usarItem(inventoryItem)}
                  >
                    {alterando ? "Usando..." : "Usar"}
                  </button>
                )}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
