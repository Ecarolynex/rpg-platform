import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import { getCampaignAccess, getCharacters, listarMinhasCampanhas } from "../../services/api";
import type { Campaign } from "../../services/api";
import type { Character } from "../../types/character";
import "./Shop.css";

export interface ShopItem {
  id: string;
  campaignId: string;
  nome: string;
  categoria: string;
  subcategoria: string;
  raridade: "Comum" | "Incomum" | "Raro" | "Épico" | "Lendário";
  descricao: string;
  efeitos: string[];
  preco: number;
  moeda: string;
  estoque: number;
  disponivel: boolean;
  imagem?: string;
}

interface CartEntry {
  itemId: string;
  quantity: number;
}

const CATEGORIAS = [
  "Todas",
  "Armas",
  "Armaduras",
  "Poções",
  "Acessórios",
  "Diversos",
];

const RARIDADES = ["Todas", "Comum", "Incomum", "Raro", "Épico", "Lendário"];

const initialItemDraft = {
  nome: "",
  categoria: "Armas",
  subcategoria: "",
  raridade: "Comum" as ShopItem["raridade"],
  descricao: "",
  efeitos: "",
  preco: "",
  estoque: "1",
  imagem: "",
};

const defaultItems: ShopItem[] = [
  {
    id: "item-espada",
    campaignId: "campanha-demo",
    nome: "Espada do Crepúsculo",
    categoria: "Armas",
    subcategoria: "Espadas",
    raridade: "Épico",
    descricao: "Uma lâmina forjada em sombra e orvalho, ideal para guerreiros que desejam a noite em suas mãos.",
    efeitos: ["+15 Dano Sombrio", "+5 Força"],
    preco: 750,
    moeda: "PO",
    estoque: 5,
    disponivel: true,
    imagem: "",
  },
  {
    id: "item-pocao",
    campaignId: "campanha-demo",
    nome: "Poção de Cura",
    categoria: "Poções",
    subcategoria: "Cura",
    raridade: "Comum",
    descricao: "Frasco de ervas douradas restaurando uma parte essencial do vigor do aventureiro.",
    efeitos: ["Cura 25 HP", "Recupera energia"],
    preco: 80,
    moeda: "PO",
    estoque: 12,
    disponivel: true,
    imagem: "",
  },
  {
    id: "item-amuleto",
    campaignId: "campanha-demo",
    nome: "Amuleto do Pescador",
    categoria: "Acessórios",
    subcategoria: "Amuletos",
    raridade: "Incomum",
    descricao: "Uma joia simples, mas sagrada, que guarda o espírito do caminho de volta ao lar.",
    efeitos: ["+2 Sabedoria", "+1 Resistência"],
    preco: 180,
    moeda: "PO",
    estoque: 3,
    disponivel: true,
    imagem: "",
  },
  {
    id: "item-arco",
    campaignId: "campanha-demo",
    nome: "Arco de Carvalho Encantado",
    categoria: "Armas",
    subcategoria: "Arcos",
    raridade: "Raro",
    descricao: "Um arco de madeira antiga com corda de tendão de lobo e magia guardada em cada entalhe.",
    efeitos: ["+10 Dano à distância", "+3 Destreza"],
    preco: 520,
    moeda: "PO",
    estoque: 2,
    disponivel: true,
    imagem: "",
  },
];

function getStorageKey(campaignId: string) {
  return `rpg-platform-shop-${campaignId}`;
}

function getGoldStorageKey(campaignId: string) {
  return `rpg-platform-gold-${campaignId}`;
}

function getCartStorageKey(campaignId: string) {
  return `rpg-platform-cart-${campaignId}`;
}

function readStoredItems(campaignId: string): ShopItem[] {
  if (typeof window === "undefined") {
    return defaultItems;
  }

  const saved = window.localStorage.getItem(getStorageKey(campaignId));

  if (!saved) {
    return defaultItems;
  }

  try {
    const parsed = JSON.parse(saved) as ShopItem[];
    return parsed.length ? parsed : defaultItems;
  } catch {
    return defaultItems;
  }
}

function readStoredGold(campaignId: string): number {
  if (typeof window === "undefined") {
    return 1250;
  }

  const saved = window.localStorage.getItem(getGoldStorageKey(campaignId));
  return saved !== null && Number.isFinite(Number(saved)) ? Number(saved) : 1250;
}

function readStoredCart(campaignId: string): CartEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved = window.localStorage.getItem(getCartStorageKey(campaignId));
    return saved ? JSON.parse(saved) as CartEntry[] : [];
  } catch {
    return [];
  }
}

export default function Shop() {
  const { id } = useParams();
  const location = useLocation();
  const campaignId = id ?? "campanha-demo";
  const [items, setItems] = useState<ShopItem[]>(() => readStoredItems(campaignId));
  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedRarity, setSelectedRarity] = useState("Todas");
  const [sortBy, setSortBy] = useState("nome");
  const [gold, setGold] = useState(() => readStoredGold(campaignId));
  const [cart, setCart] = useState<CartEntry[]>(() => readStoredCart(campaignId));
  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [campaignSettingsLoaded, setCampaignSettingsLoaded] = useState(false);
  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [isMaster, setIsMaster] = useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState(initialItemDraft);
  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState("1");
  const [availableCampaigns, setAvailableCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(!id);
  const [campaignsError, setCampaignsError] = useState("");

  useEffect(() => {
    getCharacters()
      .then((data) => {
        setCharacters(data);
        if (data[0]) {
          setActiveCharacterId(data[0].id);
        }
      })
      .catch(() => {
        setCharacters([]);
      });
  }, []);

  useEffect(() => {
    if (id) {
      return;
    }

    let active = true;

    listarMinhasCampanhas()
      .then((campaigns) => {
        if (active) {
          setAvailableCampaigns(campaigns);
        }
      })
      .catch((error) => {
        if (active) {
          setCampaignsError(error instanceof Error ? error.message : "Não foi possível carregar suas campanhas.");
        }
      })
      .finally(() => {
        if (active) {
          setCampaignsLoading(false);
        }
      });

    return () => {
      active = false;
    };
  }, [id]);

  useEffect(() => {
    if (!id) {
      return;
    }

    let active = true;

    getCampaignAccess(campaignId)
      .then(({ isMaster: hasMasterAccess, startingGold }) => {
        if (!active) {
          return;
        }

        setIsMaster(hasMasterAccess);
        if (window.localStorage.getItem(getGoldStorageKey(campaignId)) === null) {
          setGold(startingGold);
        }
        setCampaignSettingsLoaded(true);
      })
      .catch(() => {
        if (active) {
          setIsMaster(false);
          setCampaignSettingsLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [campaignId]);

  useEffect(() => {
    if (id && typeof window !== "undefined") {
      window.localStorage.setItem(getStorageKey(campaignId), JSON.stringify(items));
    }
  }, [campaignId, id, items]);

  useEffect(() => {
    if (id && typeof window !== "undefined" && campaignSettingsLoaded) {
      window.localStorage.setItem(getGoldStorageKey(campaignId), String(gold));
    }
  }, [campaignId, campaignSettingsLoaded, gold, id]);

  useEffect(() => {
    if (id && typeof window !== "undefined") {
      window.localStorage.setItem(getCartStorageKey(campaignId), JSON.stringify(cart));
    }
  }, [campaignId, cart, id]);

  const activeCharacter =
    characters.find((character) => character.id === activeCharacterId) ?? characters[0];

  const cartRows = useMemo(
    () => cart.flatMap((entry) => {
      const item = items.find((candidate) => candidate.id === entry.itemId);
      return item ? [{ item, quantity: entry.quantity }] : [];
    }),
    [cart, items],
  );
  const cartCount = cartRows.reduce((sum, entry) => sum + entry.quantity, 0);
  const cartTotal = cartRows.reduce((sum, entry) => sum + entry.item.preco * entry.quantity, 0);

  const filteredItems = useMemo(() => {
    const query = search.trim().toLowerCase();

    return [...items]
      .filter((item) => {
        const matchesSearch =
          !query ||
          item.nome.toLowerCase().includes(query) ||
          item.categoria.toLowerCase().includes(query) ||
          item.subcategoria.toLowerCase().includes(query);

        const matchesCategory =
          selectedCategory === "Todas" || item.categoria === selectedCategory;

        const matchesRarity =
          selectedRarity === "Todas" || item.raridade === selectedRarity;

        return matchesSearch && matchesCategory && matchesRarity;
      })
      .sort((a, b) => {
        switch (sortBy) {
          case "menor-preco":
            return a.preco - b.preco;
          case "maior-preco":
            return b.preco - a.preco;
          case "z-a":
            return b.nome.localeCompare(a.nome);
          default:
            return a.nome.localeCompare(b.nome);
        }
      });
  }, [items, search, selectedCategory, selectedRarity, sortBy]);

  const addToCart = (item: ShopItem) => {
    if (!item.disponivel) {
      window.alert("❌ Este item está temporariamente indisponível.");
      return;
    }

    const quantityInCart = cart.find((entry) => entry.itemId === item.id)?.quantity ?? 0;
    if (item.estoque <= quantityInCart) {
      window.alert("📦 Prateleira vazia. O comerciante ainda não repôs este item.");
      return;
    }

    setCart((previous) => {
      const existing = previous.find((entry) => entry.itemId === item.id);
      return existing
        ? previous.map((entry) => entry.itemId === item.id
            ? { ...entry, quantity: entry.quantity + 1 }
            : entry)
        : [...previous, { itemId: item.id, quantity: 1 }];
    });
    setCheckoutMessage("");
  };

  const setCartQuantity = (item: ShopItem, quantity: number) => {
    setCart((previous) => previous.map((entry) => entry.itemId === item.id
      ? { ...entry, quantity: Math.max(1, Math.min(item.estoque, quantity)) }
      : entry));
  };

  const removeFromCart = (itemId: string) => {
    setCart((previous) => previous.filter((entry) => entry.itemId !== itemId));
  };

  const checkout = () => {
    if (!cartRows.length) {
      return;
    }

    const unavailableEntry = cartRows.find(({ item, quantity }) => !item.disponivel || item.estoque < quantity);
    if (unavailableEntry) {
      window.alert(`O estoque de ${unavailableEntry.item.nome} mudou. Ajuste sua sacola antes de finalizar.`);
      return;
    }

    if (gold < cartTotal) {
      window.alert(`Ouro insuficiente. Você tem ${gold} PO e precisa de ${cartTotal} PO.`);
      return;
    }

    setGold((previous) => previous - cartTotal);
    setItems((previous) => previous.map((item) => {
      const cartEntry = cartRows.find((entry) => entry.item.id === item.id);
      return cartEntry ? { ...item, estoque: item.estoque - cartEntry.quantity } : item;
    }));
    setCart([]);
    setCheckoutMessage("Compra concluída. Os itens foram entregues ao personagem.");
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (file.type !== "image/png") {
      window.alert("A imagem da carta deve ser um arquivo PNG.");
      event.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      setItemDraft((previous) => ({
        ...previous,
        imagem: typeof reader.result === "string" ? reader.result : "",
      }));
    };
    reader.readAsDataURL(file);
  };

  const handleItemSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const nextItem: ShopItem = {
      id: editingItemId ?? `item-${Date.now()}`,
      campaignId,
      nome: itemDraft.nome.trim(),
      categoria: itemDraft.categoria,
      subcategoria: itemDraft.subcategoria.trim(),
      raridade: itemDraft.raridade,
      descricao: itemDraft.descricao.trim(),
      efeitos: itemDraft.efeitos.split("\n").map((effect) => effect.trim()).filter(Boolean),
      preco: Number(itemDraft.preco),
      moeda: "PO",
      estoque: Number(itemDraft.estoque),
      disponivel: editingItemId
        ? items.find((item) => item.id === editingItemId)?.disponivel ?? true
        : true,
      imagem: itemDraft.imagem,
    };

    setItems((previous) => editingItemId
      ? previous.map((item) => item.id === editingItemId ? nextItem : item)
      : [nextItem, ...previous]);
    setItemDraft(initialItemDraft);
    setEditingItemId(null);
    setShowItemForm(false);
  };

  const editItem = (item: ShopItem) => {
    setItemDraft({
      nome: item.nome,
      categoria: item.categoria,
      subcategoria: item.subcategoria,
      raridade: item.raridade,
      descricao: item.descricao,
      efeitos: item.efeitos.join("\n"),
      preco: String(item.preco),
      estoque: String(item.estoque),
      imagem: item.imagem ?? "",
    });
    setEditingItemId(item.id);
    setShowItemForm(true);
  };

  const closeItemForm = () => {
    setShowItemForm(false);
    setEditingItemId(null);
    setItemDraft(initialItemDraft);
  };

  const toggleItemAvailability = (itemId: string) => {
    setItems((previous) =>
      previous.map((item) =>
        item.id === itemId ? { ...item, disponivel: !item.disponivel } : item,
      ),
    );
  };

  if (!id) {
    return (
      <div className="shop-page">
        <header className="shop-header">
          <div className="shop-header-title">
            <span className="shop-kicker">Loja</span>
            <h1>Escolher campanha</h1>
          </div>
        </header>
        {campaignsLoading ? (
          <p>Carregando campanhas...</p>
        ) : campaignsError ? (
          <p role="alert">{campaignsError}</p>
        ) : availableCampaigns.length ? (
          <div className="shop-campaign-list">
            {availableCampaigns.map((campaign) => (
              <Link className="shop-campaign-option" key={campaign.id} to={`/campanha/${campaign.id}/loja`}>
                <strong>{campaign.nome}</strong>
                <span>{campaign.sistema || "Sistema não informado"}</span>
                <span>{campaign.ouro_inicial ?? 1250} PO iniciais por jogador</span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="shop-empty">
            <h2>Nenhuma campanha disponível</h2>
            <p>Crie uma campanha ou entre em uma para acessar sua loja.</p>
            <Link className="shop-admin-button" to="/campanhas">Ir para campanhas</Link>
          </div>
        )}
      </div>
    );
  }

  const isCartPage = location.pathname.endsWith("/carrinho");

  if (isCartPage) {
    return (
      <div className="shop-page shop-cart-page">
        <header className="shop-header">
          <div className="shop-header-title">
            <span className="shop-kicker">Loja da campanha</span>
            <h1>Carrinho</h1>
          </div>
          <div className="shop-wallet">
            <span>Seu ouro</span>
            <strong>{gold} PO</strong>
          </div>
        </header>
        <Link className="shop-return-link" to={`/campanha/${campaignId}/loja`}>Voltar à loja</Link>
        {checkoutMessage && <p className="shop-checkout-message" role="status">{checkoutMessage}</p>}
        {cartRows.length ? (
          <>
            <section className="shop-cart-list" aria-label="Itens do carrinho">
              {cartRows.map(({ item, quantity }) => (
                <article className="shop-cart-entry" key={item.id} aria-label={item.nome}>
                  <div className="shop-cart-entry-image">
                    {item.imagem ? <img src={item.imagem} alt="" /> : <span>{item.nome.slice(0, 2).toUpperCase()}</span>}
                  </div>
                  <div className="shop-cart-entry-info">
                    <span className="shop-kicker">{item.raridade} • {item.categoria}</span>
                    <h2>{item.nome}</h2>
                    <span>{item.preco} PO cada</span>
                  </div>
                  <div className="shop-cart-quantity" aria-label={`Quantidade de ${item.nome}`}>
                    <button type="button" aria-label={`Diminuir ${item.nome}`} onClick={() => setCartQuantity(item, quantity - 1)}>−</button>
                    <span>{quantity}</span>
                    <button type="button" aria-label={`Aumentar ${item.nome}`} disabled={quantity >= item.estoque} onClick={() => setCartQuantity(item, quantity + 1)}>+</button>
                  </div>
                  <strong className="shop-cart-entry-total">{item.preco * quantity} PO</strong>
                  <button type="button" className="shop-remove-button" onClick={() => removeFromCart(item.id)}>Remover</button>
                </article>
              ))}
            </section>
            <section className="shop-cart-checkout">
              <div>
                <span>Total do pedido</span>
                <strong>{cartTotal} PO</strong>
              </div>
              <button className="btn-primary" type="button" onClick={checkout}>Finalizar compra</button>
            </section>
          </>
        ) : (
          <div className="shop-empty">
            <h2>Sua sacola está vazia</h2>
            <p>Adicione itens do catálogo para montar seu pedido.</p>
            <Link className="shop-empty-action" to={`/campanha/${campaignId}/loja`}>Explorar a loja</Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="shop-page">
      <header className="shop-header">
        <div className="shop-header-title">
          <span className="shop-kicker">Mercado da campanha</span>
          <h1>Loja</h1>
        </div>
        <div className="shop-header-actions">
          <div className="shop-wallet">
            <span>Bolsa</span>
            <strong>{gold} PO</strong>
          </div>
          <Link className="shop-cart-link" to={`/campanha/${campaignId}/loja/carrinho`}>
            Carrinho <span>{cartCount}</span>
          </Link>
        </div>
      </header>

      <div className="shop-topbar">
        <label className="shop-search">
          <span>Livro de registros</span>
          <input
            aria-label="Procurar no catálogo"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Procurar no catálogo..."
          />
        </label>

        <label className="shop-select">
          <span>Ordenar</span>
          <select value={sortBy} onChange={(event) => setSortBy(event.target.value)}>
            <option value="nome">Nome A-Z</option>
            <option value="z-a">Nome Z-A</option>
            <option value="menor-preco">Menor preço</option>
            <option value="maior-preco">Maior preço</option>
          </select>
        </label>
      </div>

      <div className="shop-filters">
        <div className="shop-filter-group">
          <span className="shop-filter-label">Categoria</span>
          <div className="shop-filter-pills">
            {CATEGORIAS.map((category) => (
              <button
                key={category}
                type="button"
                className={category === selectedCategory ? "is-active" : ""}
                onClick={() => setSelectedCategory(category)}
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="shop-filter-group">
          <span className="shop-filter-label">Raridade</span>
          <div className="shop-filter-pills">
            {RARIDADES.map((rarity) => (
              <button
                key={rarity}
                type="button"
                className={rarity === selectedRarity ? "is-active" : ""}
                onClick={() => setSelectedRarity(rarity)}
              >
                {rarity}
              </button>
            ))}
          </div>
        </div>
      </div>

      {isMaster && (
        <section className="shop-admin-panel">
          <div>
            <span className="shop-kicker">Administração</span>
            <h2>Administrar loja</h2>
          </div>
          <button type="button" className="shop-admin-button" onClick={() => showItemForm ? closeItemForm() : setShowItemForm(true)}>
            {showItemForm ? "Cancelar" : "+ Adicionar carta"}
          </button>
        </section>
      )}

      {isMaster && showItemForm && (
        <form className="shop-item-form" onSubmit={handleItemSubmit}>
          <h3>{editingItemId ? "Editar carta da loja" : "Nova carta da loja"}</h3>
          <div className="shop-item-form-grid">
            <label>
              Nome da carta
              <input required value={itemDraft.nome} onChange={(event) => setItemDraft((previous) => ({ ...previous, nome: event.target.value }))} />
            </label>
            <label>
              Categoria
              <select value={itemDraft.categoria} onChange={(event) => setItemDraft((previous) => ({ ...previous, categoria: event.target.value }))}>
                {CATEGORIAS.slice(1).map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Subcategoria
              <input required value={itemDraft.subcategoria} onChange={(event) => setItemDraft((previous) => ({ ...previous, subcategoria: event.target.value }))} />
            </label>
            <label>
              Raridade
              <select value={itemDraft.raridade} onChange={(event) => setItemDraft((previous) => ({ ...previous, raridade: event.target.value as ShopItem["raridade"] }))}>
                {RARIDADES.slice(1).map((rarity) => <option key={rarity}>{rarity}</option>)}
              </select>
            </label>
            <label>
              Preço em PO
              <input required type="number" min="0" value={itemDraft.preco} onChange={(event) => setItemDraft((previous) => ({ ...previous, preco: event.target.value }))} />
            </label>
            <label>
              Estoque
              <input required type="number" min="0" value={itemDraft.estoque} onChange={(event) => setItemDraft((previous) => ({ ...previous, estoque: event.target.value }))} />
            </label>
            <label className="shop-item-form-wide">
              Imagem da carta (PNG)
              <input required={!editingItemId} type="file" accept="image/png" onChange={handleImageUpload} />
            </label>
            {itemDraft.imagem && (
              <img className="shop-item-image-preview" src={itemDraft.imagem} alt="Prévia da carta" />
            )}
            <label className="shop-item-form-wide">
              Descrição
              <textarea required rows={3} value={itemDraft.descricao} onChange={(event) => setItemDraft((previous) => ({ ...previous, descricao: event.target.value }))} />
            </label>
            <label className="shop-item-form-wide">
              Efeitos (um por linha)
              <textarea rows={3} value={itemDraft.efeitos} onChange={(event) => setItemDraft((previous) => ({ ...previous, efeitos: event.target.value }))} />
            </label>
          </div>
          <div className="shop-item-form-actions">
            <button className="shop-admin-button" type="submit">
              {editingItemId ? "Salvar alterações" : "Publicar carta"}
            </button>
            <button className="btn-ghost" type="button" onClick={closeItemForm}>Cancelar</button>
          </div>
        </form>
      )}

      <aside className="shop-sidebar">
        <div className="shop-persona-card">
          <div className="shop-persona-heading">
            <span className="shop-persona-mark" aria-hidden="true">
              {(activeCharacter?.nome ?? "Ragnar Lord")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </span>
            <div className="shop-persona-title">
              <span className="shop-kicker">Personagem ativo</span>
              <h3>{activeCharacter?.nome ?? "Ragnar Lord"}</h3>
            </div>
          </div>
          <div className="shop-persona-stats">
            <div className="shop-persona-stat">
              <span>Classe</span>
              <strong>{activeCharacter?.classe ?? "Guerreiro"}</strong>
            </div>
            <div className="shop-persona-stat shop-persona-level">
              <span>Nível</span>
              <strong>{activeCharacter?.nivel ?? 10}</strong>
            </div>
          </div>
        </div>

        <div className="shop-cart">
          <span className="shop-kicker">Sacola do mercador</span>
          <h3>Seu carrinho</h3>
          <p>{cartCount ? `${cartCount} ${cartCount === 1 ? "item" : "itens"} na sacola` : "Nenhum item selecionado"}</p>
          <div className="shop-cart-total">
            <span>Total</span>
            <strong>{cartTotal} PO</strong>
          </div>
          <Link className="shop-cart-link shop-cart-link-full" to={`/campanha/${campaignId}/loja/carrinho`}>Ir para o carrinho</Link>
        </div>
      </aside>

      <div className="shop-layout">
        <section className="shop-catalogue" aria-live="polite">
          {filteredItems.length === 0 ? (
            <div className="shop-empty">
              <h3>Nenhum item encontrado</h3>
              <p>Os registros da prateleira não condizem com a busca escolhida.</p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <article key={item.id} className="shop-card" aria-label={item.nome}>
                <div className="shop-card-image">
                  {item.imagem ? (
                    <img src={item.imagem} alt={item.nome} />
                  ) : (
                    <div className="shop-card-placeholder">{item.nome.slice(0, 2).toUpperCase()}</div>
                  )}
                </div>

                <div className="shop-card-body">
                  <div className="shop-card-header">
                    <h3>{item.nome}</h3>
                    <span className={`rarity rarity-${item.raridade.toLowerCase()}`}>{item.raridade}</span>
                  </div>

                  <p className="shop-card-meta">
                    {item.categoria} • {item.subcategoria}
                  </p>

                  <div className="shop-price-row">
                    <strong>{item.preco} PO</strong>
                    <span>{item.estoque} em estoque</span>
                  </div>

                  <div className="shop-card-actions">
                    <button type="button" className="btn-secondary" onClick={() => setSelectedItem(item)}>
                      Examinar
                    </button>
                    <button type="button" className="btn-primary" onClick={() => addToCart(item)} disabled={!item.disponivel || item.estoque <= (cart.find((entry) => entry.itemId === item.id)?.quantity ?? 0)}>
                      Adicionar
                    </button>
                  </div>

                  {isMaster && (
                    <div className="shop-master-actions">
                      <button type="button" className="btn-secondary" onClick={() => editItem(item)}>
                        Editar
                      </button>
                      <button
                        type="button"
                        className="btn-ghost small"
                        onClick={() => toggleItemAvailability(item.id)}
                      >
                        {item.disponivel ? "Desativar" : "Ativar"}
                      </button>
                    </div>
                  )}
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      {selectedItem && (
        <div className="shop-modal-backdrop" onClick={() => setSelectedItem(null)}>
          <div className="shop-modal" onClick={(event) => event.stopPropagation()}>
            <div className="shop-modal-header">
              <div>
                <span className="shop-kicker">Pergaminho de item</span>
                <h2>{selectedItem.nome}</h2>
              </div>
              <button type="button" className="shop-close" onClick={() => setSelectedItem(null)}>
                Fechar
              </button>
            </div>

            <div className="shop-modal-body">
              <div className="shop-modal-art">
                {selectedItem.imagem ? (
                  <img src={selectedItem.imagem} alt={selectedItem.nome} />
                ) : (
                  <div className="shop-card-placeholder large">{selectedItem.nome.slice(0, 2).toUpperCase()}</div>
                )}
              </div>

              <div className="shop-modal-content">
                <p className="shop-card-meta">
                  {selectedItem.categoria} • {selectedItem.subcategoria} • {selectedItem.raridade}
                </p>
                <p className="shop-modal-description">{selectedItem.descricao}</p>

                <ul className="shop-effects">
                  {selectedItem.efeitos.map((efeito) => (
                    <li key={efeito}>{efeito}</li>
                  ))}
                </ul>

                <div className="shop-modal-footer">
                  <span>Preço: {selectedItem.preco} PO</span>
                  <span>Estoque: {selectedItem.estoque}</span>
                </div>

                <button type="button" className="btn-primary" onClick={() => addToCart(selectedItem)}>
                  Adicionar ao carrinho
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
