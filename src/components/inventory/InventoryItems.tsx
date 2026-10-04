import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { getInventory } from "../../services/api";
import "./InventoryItems.css";

type InventoryItemData = {
  id: string;
  nome: string;
  descricao: string | null;
  tipo: string | null;
  raridade: string | null;
  efeito: string | null;
  imagem_url: string | null;
};

type InventoryRow = {
  item_id: string;
  quantidade: number;
  equipado?: boolean;
  itens: InventoryItemData | InventoryItemData[] | null;
};

type PersistedInventoryItem = {
  itemId: string;
  quantidade: number;
  equipado: boolean;
  item: InventoryItemData | null;
};

type InventoryItemsProps = {
  characterId: string;
  campaignId?: string | null;
};

function normalizeInventoryRows(rows: InventoryRow[]): PersistedInventoryItem[] {
  return rows.map((row) => ({
    itemId: row.item_id,
    quantidade: Number(row.quantidade) || 0,
    equipado: row.equipado === true,
    item: Array.isArray(row.itens) ? row.itens[0] ?? null : row.itens,
  }));
}

export default function InventoryItems({ characterId, campaignId }: InventoryItemsProps) {
  const [items, setItems] = useState<PersistedInventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    let active = true;

    getInventory(characterId)
      .then((data) => {
        if (active) setItems(normalizeInventoryRows(data as InventoryRow[]));
      })
      .catch((err: unknown) => {
        console.error("Erro ao carregar inventário:", err);
        if (active) {
          setError(
            err instanceof Error
              ? err.message
              : "Não foi possível carregar o inventário.",
          );
        }
      })
      .finally(() => {
        if (active) setLoading(false);
      });

    return () => {
      active = false;
    };
  }, [characterId, attempt]);

  if (loading) {
    return <p className="status-message" role="status">Carregando inventário...</p>;
  }

  if (error) {
    return (
      <div className="status-message status-message--error" role="alert">
        <p>{error}</p>
        <button
          type="button"
          className="btn-ghost inventory-retry"
          onClick={() => {
            setLoading(true);
            setError("");
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
        <p>O inventário persistido deste personagem está vazio.</p>
        {campaignId && (
          <Link to={`/campanha/${campaignId}/loja`} className="btn-primary">
            Adicionar itens pela loja
          </Link>
        )}
      </div>
    );
  }

  return (
    <div className="inventory-content">
      <div className="inventory-actions">
        <h2 className="inventory-section-title">Itens do personagem</h2>
        {campaignId && (
          <Link
            to={`/campanha/${campaignId}/loja`}
            className="btn-ghost inventory-shop-link"
          >
            Adicionar itens pela loja
          </Link>
        )}
      </div>
      <div
        className="inventory-grid"
        role="region"
        aria-label="Inventário persistido do personagem"
      >
        {items.map((inventoryItem) => (
          <article key={inventoryItem.itemId} className="inventory-item">
            <div className="inventory-item-head">
              {inventoryItem.item?.imagem_url && (
                <img
                  className="inventory-item-image"
                  src={inventoryItem.item.imagem_url}
                  alt=""
                  aria-hidden="true"
                  onError={(event) => { event.currentTarget.hidden = true; }}
                />
              )}
              <h2 className="inventory-item-title">
                {inventoryItem.item ? inventoryItem.item.nome : "Item desconhecido"}
              </h2>
              <span className="inventory-item-quantity">x{inventoryItem.quantidade}</span>
            </div>

            {(inventoryItem.item?.tipo || inventoryItem.item?.raridade || inventoryItem.equipado) && (
              <div className="inventory-item-meta">
                {(inventoryItem.item?.tipo || inventoryItem.item?.raridade) && (
                  <span className="inventory-item-kind">
                    {[inventoryItem.item?.tipo, inventoryItem.item?.raridade].filter(Boolean).join(" · ")}
                  </span>
                )}
                {inventoryItem.equipado && (
                  <span className="inventory-item-equipped">Equipado</span>
                )}
              </div>
            )}

            {inventoryItem.item?.descricao && (
              <p className="inventory-item-description">{inventoryItem.item.descricao}</p>
            )}
            {inventoryItem.item?.efeito && (
              <p className="inventory-item-effect">✦ {inventoryItem.item.efeito}</p>
            )}
          </article>
        ))}
      </div>
    </div>
  );
}
