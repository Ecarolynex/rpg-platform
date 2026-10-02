import { useEffect, useState } from "react";
import { Link, useParams } from "react-router-dom";
import {
  getCharacterById,
  getCharacters,
  getInventory,
  listarPersonagensDaCampanha,
} from "../../services/api";
import type { Character } from "../../types/character";

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
  const { id, characterId } = useParams<{
    id?: string;
    characterId?: string;
  }>();

  const [activeChar, setActiveChar] = useState<Character | null>(null);
  const [partyChars, setPartyChars] = useState<Character[]>([]);
  const [items, setItems] = useState<InventoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        setError("");

        let targetCharId = characterId;

        // Se characterId não foi passado, investiga se `id` é characterId ou campaignId
        if (!targetCharId && id) {
          try {
            const char = await getCharacterById(id);
            if (char) {
              targetCharId = char.id;
              setActiveChar(char);
            }
          } catch {
            // id não era de um personagem, provavelmente é de uma campanha
          }

          if (!targetCharId) {
            // Tenta carregar os personagens da campanha
            const [daCampanha, meus] = await Promise.all([
              listarPersonagensDaCampanha(id).catch(() => []),
              getCharacters().catch(() => []),
            ]);

            setPartyChars(daCampanha);

            // Procura o personagem do próprio usuário nesta campanha
            const meu = meus.find((c) => c.campanhaId === id);
            if (meu) {
              targetCharId = meu.id;
              setActiveChar(meu);
            } else if (daCampanha[0]) {
              targetCharId = daCampanha[0].id;
              setActiveChar(daCampanha[0]);
            }
          }
        } else if (targetCharId) {
          const char = await getCharacterById(targetCharId).catch(() => null);
          if (char) setActiveChar(char);
        }

        if (!targetCharId) {
          setError("Nenhum personagem foi selecionado para visualizar o inventário.");
          return;
        }

        const data = await getInventory(targetCharId);

        const normalizedItems: InventoryItem[] = data.map(
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
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

    loadData();
  }, [id, characterId]);

  if (loading) {
    return (
      <div style={{ maxWidth: 800, margin: "40px auto", padding: "0 16px" }}>
        <p>Carregando inventário e pertences...</p>
      </div>
    );
  }

  return (
    <section style={{ maxWidth: 900, margin: "24px auto", padding: "0 16px" }}>
      <div style={{ marginBottom: 16 }}>
        {activeChar?.campanhaId ? (
          <Link to={"/campanha/" + activeChar.campanhaId} className="btn-ghost" style={{ fontSize: "0.85rem", textDecoration: "none" }}>
            ← Voltar para a Campanha
          </Link>
        ) : activeChar?.id ? (
          <Link to={"/personagem/" + activeChar.id} className="btn-ghost" style={{ fontSize: "0.85rem", textDecoration: "none" }}>
            ← Voltar para a Ficha
          </Link>
        ) : (
          <Link to="/campanhas" className="btn-ghost" style={{ fontSize: "0.85rem", textDecoration: "none" }}>
            ← Campanhas
          </Link>
        )}
      </div>

      <header style={{ borderBottom: "1px solid rgba(201, 162, 39, 0.3)", paddingBottom: 16, marginBottom: 20 }}>
        <h1 style={{ fontFamily: "var(--font-display)", color: "var(--gold-bright)", margin: "0 0 6px" }}>
          Inventário de Campanha
        </h1>
        {activeChar && (
          <p style={{ color: "var(--muted)", margin: 0 }}>
            Pertences e itens de <strong>{activeChar.nome}</strong> ({activeChar.raca} · {activeChar.classe})
          </p>
        )}
      </header>

      {/* Seletor de personagens caso existam múltiplos na campanha */}
      {partyChars.length > 1 && (
        <div style={{ marginBottom: 20, display: "flex", alignItems: "center", gap: 8 }}>
          <span style={{ fontSize: "0.85rem", color: "var(--muted)" }}>Alternar aventureiro:</span>
          {partyChars.map((p) => (
            <Link
              key={p.id}
              to={id ? `/campanha/${id}/inventario/${p.id}` : `/personagem/${p.id}/inventario`}
              className={p.id === activeChar?.id ? "btn-primary" : "btn-ghost"}
              style={{ fontSize: "0.78rem", padding: "4px 10px", textDecoration: "none" }}
            >
              {p.nome}
            </Link>
          ))}
        </div>
      )}

      {error ? (
        <div style={{ padding: 16, background: "rgba(160, 30, 30, 0.2)", border: "1px solid #f87171", borderRadius: 6, color: "#fca5a5" }}>
          <p style={{ margin: 0 }}>{error}</p>
        </div>
      ) : items.length === 0 ? (
        <div style={{ padding: 32, textAlign: "center", background: "rgba(0, 0, 0, 0.25)", border: "1px dashed rgba(201, 162, 39, 0.3)", borderRadius: 8 }}>
          <p style={{ color: "var(--muted)", margin: "0 0 12px" }}>O inventário deste personagem está vazio.</p>
          {activeChar?.campanhaId && (
            <Link to={"/campanha/" + activeChar.campanhaId + "/loja"} className="btn-primary" style={{ textDecoration: "none", fontSize: "0.85rem" }}>
              Visitar o Mercado & Loja
            </Link>
          )}
        </div>
      ) : (
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 14 }}>
          {items.map((item) => (
            <article
              key={item.item_id}
              style={{
                border: "1px solid rgba(201, 162, 39, 0.3)",
                background: "rgba(22, 16, 11, 0.75)",
                borderRadius: 6,
                padding: 14,
                display: "flex",
                flexDirection: "column",
                gap: 8,
              }}
            >
              <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                {item.itens?.imagem_url && (
                  <img
                    src={item.itens.imagem_url}
                    alt=""
                    aria-hidden="true"
                    onError={(event) => { event.currentTarget.hidden = true; }}
                    style={{
                      width: 52,
                      height: 52,
                      flex: "0 0 52px",
                      objectFit: "cover",
                      borderRadius: 6,
                      border: "1px solid rgba(201, 162, 39, 0.3)",
                    }}
                  />
                )}
                <h2 style={{ fontSize: "1.1rem", margin: 0, color: "var(--parchment)", fontFamily: "var(--font-display)" }}>
                  {item.itens ? item.itens.nome : "Item desconhecido"}
                </h2>
                <span style={{ fontSize: "0.8rem", fontWeight: "bold", background: "rgba(201, 162, 39, 0.2)", padding: "2px 8px", borderRadius: 4, color: "var(--gold-bright)", marginLeft: "auto", flexShrink: 0 }}>
                  x{item.quantidade}
                </span>
              </div>

              {item.itens?.tipo && (
                <span style={{ fontSize: "0.72rem", textTransform: "uppercase", letterSpacing: "0.06em", color: "var(--muted)" }}>
                  {item.itens.tipo} {item.itens.raridade ? `· ${item.itens.raridade}` : ""}
                </span>
              )}

              {item.itens?.descricao && (
                <p style={{ fontSize: "0.85rem", color: "var(--muted)", margin: "4px 0 0", lineHeight: 1.4 }}>
                  {item.itens.descricao}
                </p>
              )}

              {item.itens?.efeito && (
                <p style={{ fontSize: "0.8rem", color: "var(--gold-bright)", margin: "4px 0 0" }}>
                  ✨ {item.itens.efeito}
                </p>
              )}

            </article>
          ))}
        </div>
      )}
    </section>
  );
}