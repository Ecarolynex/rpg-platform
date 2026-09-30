import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { getInventory } from "../../services/api";

type InventoryItem = {
  personagem_id: string;
  item_id: string;
  quantidade: number;
  updated_at: string;
  itens: {
    id: string;
    nome: string;
    descricao: string | null;
    tipo: string | null;
    raridade: string | null;
    efeito: string | null;
    imagem_url: string | null;
  } | null;
};

export default function Inventory() {
  const { characterId } = useParams<{
    characterId: string;
  }>();

  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadInventory() {
      if (!characterId) {
        setError("Personagem não identificado na URL.");
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        setError("");

        const data = await getInventory(characterId);

        const normalizedItems: InventoryItem[] = data.map(
          (row: any) => ({
            personagem_id: row.personagem_id,
            item_id: row.item_id,
            quantidade: row.quantidade,
            updated_at: row.updated_at,
            itens: Array.isArray(row.itens)
              ? row.itens[0] ?? null
              : row.itens ?? null,
          }),
        );

        setItems(normalizedItems);
      } catch (err) {
        console.error("Erro ao carregar inventário:", err);

        setError(
          err instanceof Error
            ? err.message
            : "Não foi possível carregar o inventário.",
        );
      } finally {
        setLoading(false);
      }
    }

    loadInventory();
  }, [characterId]);

  if (loading) {
    return <p>Carregando inventário...</p>;
  }

  if (error) {
    return <p>{error}</p>;
  }

  return (
    <section>
      <h1>Inventário</h1>

      {items.length === 0 ? (
        <p>Seu inventário está vazio.</p>
      ) : (
        <div>
          {items.map((item) => (
            <article key={item.item_id}>
              <h2>
                {item.itens
                  ? item.itens.nome
                  : "Item desconhecido"}
              </h2>

              <p>Quantidade: {item.quantidade}</p>

              {item.itens?.tipo ? (
                <p>Tipo: {item.itens.tipo}</p>
              ) : null}

              {item.itens?.raridade ? (
                <p>Raridade: {item.itens.raridade}</p>
              ) : null}

              {item.itens?.descricao ? (
                <p>{item.itens.descricao}</p>
              ) : null}

              {item.itens?.efeito ? (
                <p>Efeito: {item.itens.efeito}</p>
              ) : null}

              {item.itens?.imagem_url ? (
                <img
                  src={item.itens.imagem_url}
                  alt={item.itens.nome}
                  width={120}
                />
              ) : null}
            </article>
          ))}
        </div>
      )}
    </section>
  );
}