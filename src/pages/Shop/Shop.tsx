import { useEffect, useMemo, useState } from "react";
import { Link, useLocation, useParams } from "react-router-dom";
import {
  getCampaignAccess,
  getCharacters,
  listarItensDaLoja,
  listarMinhasCampanhas,
  comprarItem,
} from "../../services/api";
import type { Campaign, ShopItem as ApiShopItem } from "../../services/api";
import type { Character } from "../../types/character";
import "./Shop.css";

interface ShopItem {
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

const RARIDADES = [
  "Todas",
  "Comum",
  "Incomum",
  "Raro",
  "Épico",
  "Lendário",
];

function getCartStorageKey(campaignId: string) {
  return `rpg-platform-cart-${campaignId}`;
}

function readStoredCart(campaignId: string): CartEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved = window.localStorage.getItem(
      getCartStorageKey(campaignId),
    );

    return saved ? (JSON.parse(saved) as CartEntry[]) : [];
  } catch {
    return [];
  }
}

function mapRarity(value: string | null): ShopItem["raridade"] {
  switch ((value ?? "").toUpperCase()) {
    case "COMUM":
      return "Comum";
    case "INCOMUM":
      return "Incomum";
    case "RARO":
      return "Raro";
    case "EPICO":
    case "ÉPICO":
      return "Épico";
    case "LENDARIO":
    case "LENDÁRIO":
      return "Lendário";
    default:
      return "Comum";
  }
}

function mapCategory(tipo: string | null): {
  categoria: string;
  subcategoria: string;
} {
  switch ((tipo ?? "").toUpperCase()) {
    case "ARMA":
      return {
        categoria: "Armas",
        subcategoria: "Equipamentos",
      };

    case "ARMADURA":
      return {
        categoria: "Armaduras",
        subcategoria: "Equipamentos",
      };

    case "CONSUMIVEL":
    case "CONSUMÍVEL":
      return {
        categoria: "Poções",
        subcategoria: "Consumíveis",
      };

    case "ACESSORIO":
    case "ACESSÓRIO":
      return {
        categoria: "Acessórios",
        subcategoria: "Acessórios",
      };

    default:
      return {
        categoria: "Diversos",
        subcategoria: "Outros",
      };
  }
}

function convertApiItem(item: ApiShopItem): ShopItem {
  const category = mapCategory(item.tipo);

  return {
    id: item.id,
    campaignId: item.campanhaId,
    nome: item.nome,
    categoria: category.categoria,
    subcategoria: category.subcategoria,
    raridade: mapRarity(item.raridade),
    descricao: item.descricao ?? "",
    efeitos: item.efeito
      ? item.efeito
          .split(/\r?\n/)
          .map((effect) => effect.trim())
          .filter(Boolean)
      : [],
    preco: Number(item.precoCompra),
    moeda: item.moedaId,
    estoque: Number(item.estoque),
    disponivel: item.ativo && item.estoque > 0,
    imagem: item.imagemUrl ?? "",
  };
}

export default function Shop() {
  const { id } = useParams();
  const location = useLocation();

  const campaignId = id ?? "campanha-demo";

  const [items, setItems] = useState<ShopItem[]>([]);
  const [loadingItems, setLoadingItems] = useState(Boolean(id));
  const [itemsError, setItemsError] = useState("");

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] = useState("Todas");
  const [selectedRarity, setSelectedRarity] = useState("Todas");
  const [sortBy, setSortBy] = useState("nome");

  const [cart, setCart] = useState<CartEntry[]>(() =>
    readStoredCart(campaignId),
  );

  const [checkoutMessage, setCheckoutMessage] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [campaignSettingsLoaded, setCampaignSettingsLoaded] = useState(false);
  const [startingGold, setStartingGold] = useState(0);

  const [selectedItem, setSelectedItem] = useState<ShopItem | null>(null);
  const [isMaster, setIsMaster] = useState(false);

  const [characters, setCharacters] = useState<Character[]>([]);
  const [activeCharacterId, setActiveCharacterId] = useState("");

  const [availableCampaigns, setAvailableCampaigns] = useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] = useState(!id);
  const [campaignsError, setCampaignsError] = useState("");

  async function loadShopItems() {
    if (!id) {
      return;
    }

    setLoadingItems(true);
    setItemsError("");

    try {
      const data = await listarItensDaLoja(campaignId);

      const converted = data.map(convertApiItem);

      setItems(converted);
    } catch (error) {
      setItemsError(
        error instanceof Error
          ? error.message
          : "Não foi possível carregar os itens da loja.",
      );
      setItems([]);
    } finally {
      setLoadingItems(false);
    }
  }

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
    loadShopItems();
  }, [campaignId, id]);

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
          setCampaignsError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar suas campanhas.",
          );
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
      .then(({ isMaster: hasMasterAccess, startingGold: campaignGold }) => {
        if (!active) {
          return;
        }

        setIsMaster(hasMasterAccess);
        setStartingGold(campaignGold);
        setCampaignSettingsLoaded(true);
      })
      .catch(() => {
        if (active) {
          setIsMaster(false);
          setStartingGold(0);
          setCampaignSettingsLoaded(true);
        }
      });

    return () => {
      active = false;
    };
  }, [campaignId, id]);

  useEffect(() => {
    if (
      id &&
      typeof window !== "undefined"
    ) {
      window.localStorage.setItem(
        getCartStorageKey(campaignId),
        JSON.stringify(cart),
      );
    }
  }, [campaignId, cart, id]);

  const activeCharacter =
    characters.find((character) => character.id === activeCharacterId) ??
    characters[0];

  const cartRows = useMemo(
    () =>
      cart.flatMap((entry) => {
        const item = items.find(
          (candidate) => candidate.id === entry.itemId,
        );

        return item ? [{ item, quantity: entry.quantity }] : [];
      }),
    [cart, items],
  );

  const cartCount = cartRows.reduce(
    (sum, entry) => sum + entry.quantity,
    0,
  );

  const cartTotal = cartRows.reduce(
    (sum, entry) => sum + entry.item.preco * entry.quantity,
    0,
  );

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
          selectedCategory === "Todas" ||
          item.categoria === selectedCategory;

        const matchesRarity =
          selectedRarity === "Todas" ||
          item.raridade === selectedRarity;

        return (
          matchesSearch &&
          matchesCategory &&
          matchesRarity
        );
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
  }, [
    items,
    search,
    selectedCategory,
    selectedRarity,
    sortBy,
  ]);

  const addToCart = (item: ShopItem) => {
    if (!item.disponivel) {
      window.alert(
        "Este item está temporariamente indisponível.",
      );
      return;
    }

    const quantityInCart =
      cart.find((entry) => entry.itemId === item.id)?.quantity ?? 0;

    if (item.estoque <= quantityInCart) {
      window.alert(
        "Não há estoque suficiente para adicionar mais unidades.",
      );
      return;
    }

    setCart((previous) => {
      const existing = previous.find(
        (entry) => entry.itemId === item.id,
      );

      if (existing) {
        return previous.map((entry) =>
          entry.itemId === item.id
            ? {
                ...entry,
                quantity: entry.quantity + 1,
              }
            : entry,
        );
      }

      return [
        ...previous,
        {
          itemId: item.id,
          quantity: 1,
        },
      ];
    });

    setCheckoutMessage("");
  };

  const setCartQuantity = (
    item: ShopItem,
    quantity: number,
  ) => {
    setCart((previous) =>
      previous.map((entry) =>
        entry.itemId === item.id
          ? {
              ...entry,
              quantity: Math.max(
                1,
                Math.min(item.estoque, quantity),
              ),
            }
          : entry,
      ),
    );
  };

  const removeFromCart = (itemId: string) => {
    setCart((previous) =>
      previous.filter(
        (entry) => entry.itemId !== itemId,
      ),
    );
  };

  const checkout = async () => {
    if (!cartRows.length) {
      return;
    }

    if (!activeCharacter) {
      window.alert(
        "Você precisa ter um personagem para realizar a compra.",
      );
      return;
    }

    const unavailableEntry = cartRows.find(
      ({ item, quantity }) =>
        !item.disponivel ||
        item.estoque < quantity,
    );

    if (unavailableEntry) {
      window.alert(
        `O estoque de ${unavailableEntry.item.nome} mudou. Atualize a loja e tente novamente.`,
      );

      await loadShopItems();
      return;
    }

    setCheckoutLoading(true);
    setCheckoutMessage("");

    try {
      for (const entry of cartRows) {
        await comprarItem(
          activeCharacter.id,
          entry.item.id,
          entry.quantity,
        );
      }

      setCart([]);

      setCheckoutMessage(
        "Compra concluída. Os itens foram entregues ao personagem.",
      );

      await loadShopItems();
    } catch (error) {
      const message =
        error instanceof Error
          ? error.message
          : "Não foi possível concluir a compra.";

      window.alert(message);

      await loadShopItems();
    } finally {
      setCheckoutLoading(false);
    }
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
              <Link
                className="shop-campaign-option"
                key={campaign.id}
                to={`/campanha/${campaign.id}/loja`}
              >
                <strong>{campaign.nome}</strong>

                <span>
                  {campaign.sistema ||
                    "Sistema não informado"}
                </span>

                <span>
                  {campaign.ouro_inicial ?? 0} PO
                  iniciais por jogador
                </span>
              </Link>
            ))}
          </div>
        ) : (
          <div className="shop-empty">
            <h2>Nenhuma campanha disponível</h2>

            <p>
              Crie uma campanha ou entre em uma para
              acessar sua loja.
            </p>

            <Link
              className="shop-admin-button"
              to="/campanhas"
            >
              Ir para campanhas
            </Link>
          </div>
        )}
      </div>
    );
  }

  const isCartPage =
    location.pathname.endsWith("/carrinho");

  if (isCartPage) {
    return (
      <div className="shop-page shop-cart-page">
        <header className="shop-header">
          <div className="shop-header-title">
            <span className="shop-kicker">
              Loja da campanha
            </span>

            <h1>Carrinho</h1>
          </div>

          <div className="shop-wallet">
            <span>Seu ouro</span>

            <strong>
              Consulte sua carteira
            </strong>
          </div>
        </header>

        <Link
          className="shop-return-link"
          to={`/campanha/${campaignId}/loja`}
        >
          Voltar à loja
        </Link>

        {checkoutMessage && (
          <p
            className="shop-checkout-message"
            role="status"
          >
            {checkoutMessage}
          </p>
        )}

        {cartRows.length ? (
          <>
            <section
              className="shop-cart-list"
              aria-label="Itens do carrinho"
            >
              {cartRows.map(
                ({ item, quantity }) => (
                  <article
                    className="shop-cart-entry"
                    key={item.id}
                    aria-label={item.nome}
                  >
                    <div className="shop-cart-entry-image">
                      {item.imagem ? (
                        <img
                          src={item.imagem}
                          alt=""
                        />
                      ) : (
                        <span>
                          {item.nome
                            .slice(0, 2)
                            .toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="shop-cart-entry-info">
                      <span className="shop-kicker">
                        {item.raridade} •{" "}
                        {item.categoria}
                      </span>

                      <h2>{item.nome}</h2>

                      <span>
                        {item.preco} {item.moeda} cada
                      </span>
                    </div>

                    <div
                      className="shop-cart-quantity"
                      aria-label={`Quantidade de ${item.nome}`}
                    >
                      <button
                        type="button"
                        aria-label={`Diminuir ${item.nome}`}
                        onClick={() =>
                          setCartQuantity(
                            item,
                            quantity - 1,
                          )
                        }
                      >
                        −
                      </button>

                      <span>{quantity}</span>

                      <button
                        type="button"
                        aria-label={`Aumentar ${item.nome}`}
                        disabled={
                          quantity >= item.estoque
                        }
                        onClick={() =>
                          setCartQuantity(
                            item,
                            quantity + 1,
                          )
                        }
                      >
                        +
                      </button>
                    </div>

                    <strong className="shop-cart-entry-total">
                      {item.preco * quantity}{" "}
                      {item.moeda}
                    </strong>

                    <button
                      type="button"
                      className="shop-remove-button"
                      onClick={() =>
                        removeFromCart(item.id)
                      }
                    >
                      Remover
                    </button>
                  </article>
                ),
              )}
            </section>

            <section className="shop-cart-checkout">
              <div>
                <span>Total do pedido</span>

                <strong>
                  {cartTotal} PO
                </strong>
              </div>

              <button
                className="btn-primary"
                type="button"
                onClick={checkout}
                disabled={checkoutLoading}
              >
                {checkoutLoading
                  ? "Processando..."
                  : "Finalizar compra"}
              </button>
            </section>
          </>
        ) : (
          <div className="shop-empty">
            <h2>Sua sacola está vazia</h2>

            <p>
              Adicione itens do catálogo para montar
              seu pedido.
            </p>

            <Link
              className="shop-empty-action"
              to={`/campanha/${campaignId}/loja`}
            >
              Explorar a loja
            </Link>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="shop-page">
      <header className="shop-header">
        <div className="shop-header-title">
          <span className="shop-kicker">
            Mercado da campanha
          </span>

          <h1>Loja</h1>
        </div>

        <div className="shop-header-actions">
          <div className="shop-wallet">
            <span>Bolsa</span>

            <strong>
              Peso de Ouro
            </strong>
          </div>

          <Link
            className="shop-cart-link"
            to={`/campanha/${campaignId}/loja/carrinho`}
          >
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
            onChange={(event) =>
              setSearch(event.target.value)
            }
            placeholder="Procurar no catálogo..."
          />
        </label>

        <label className="shop-select">
          <span>Ordenar</span>

          <select
            value={sortBy}
            onChange={(event) =>
              setSortBy(event.target.value)
            }
          >
            <option value="nome">
              Nome A-Z
            </option>

            <option value="z-a">
              Nome Z-A
            </option>

            <option value="menor-preco">
              Menor preço
            </option>

            <option value="maior-preco">
              Maior preço
            </option>
          </select>
        </label>
      </div>

      <div className="shop-filters">
        <div className="shop-filter-group">
          <span className="shop-filter-label">
            Categoria
          </span>

          <div className="shop-filter-pills">
            {CATEGORIAS.map((category) => (
              <button
                key={category}
                type="button"
                className={
                  category === selectedCategory
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setSelectedCategory(category)
                }
              >
                {category}
              </button>
            ))}
          </div>
        </div>

        <div className="shop-filter-group">
          <span className="shop-filter-label">
            Raridade
          </span>

          <div className="shop-filter-pills">
            {RARIDADES.map((rarity) => (
              <button
                key={rarity}
                type="button"
                className={
                  rarity === selectedRarity
                    ? "is-active"
                    : ""
                }
                onClick={() =>
                  setSelectedRarity(rarity)
                }
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
            <span className="shop-kicker">
              Administração
            </span>

            <h2>Administrar loja</h2>

            <p>
              O cadastro de novos itens pelo Mestre
              será conectado ao banco na próxima etapa.
            </p>
          </div>
        </section>
      )}

      <aside className="shop-sidebar">
        <div className="shop-persona-card">
          <div className="shop-persona-heading">
            <span
              className="shop-persona-mark"
              aria-hidden="true"
            >
              {(activeCharacter?.nome ??
                "Personagem")
                .split(/\s+/)
                .filter(Boolean)
                .slice(0, 2)
                .map((part) => part[0])
                .join("")
                .toUpperCase()}
            </span>

            <div className="shop-persona-title">
              <span className="shop-kicker">
                Personagem ativo
              </span>

              <h3>
                {activeCharacter?.nome ??
                  "Nenhum personagem"}
              </h3>
            </div>
          </div>

          <div className="shop-persona-stats">
            <div className="shop-persona-stat">
              <span>Classe</span>

              <strong>
                {activeCharacter?.classe ??
                  "—"}
              </strong>
            </div>

            <div className="shop-persona-stat shop-persona-level">
              <span>Nível</span>

              <strong>
                {activeCharacter?.nivel ?? "—"}
              </strong>
            </div>
          </div>
        </div>

        <div className="shop-cart">
          <span className="shop-kicker">
            Sacola do mercador
          </span>

          <h3>Seu carrinho</h3>

          <p>
            {cartCount
              ? `${cartCount} ${
                  cartCount === 1
                    ? "item"
                    : "itens"
                } na sacola`
              : "Nenhum item selecionado"}
          </p>

          <div className="shop-cart-total">
            <span>Total</span>

            <strong>
              {cartTotal} PO
            </strong>
          </div>

          <Link
            className="shop-cart-link shop-cart-link-full"
            to={`/campanha/${campaignId}/loja/carrinho`}
          >
            Ir para o carrinho
          </Link>
        </div>
      </aside>

      <div className="shop-layout">
        <section
          className="shop-catalogue"
          aria-live="polite"
        >
          {loadingItems ? (
            <div className="shop-empty">
              <h3>Carregando loja...</h3>

              <p>
                Buscando os itens cadastrados
                nesta campanha.
              </p>
            </div>
          ) : itemsError ? (
            <div className="shop-empty">
              <h3>Não foi possível carregar a loja</h3>

              <p role="alert">{itemsError}</p>
            </div>
          ) : filteredItems.length === 0 ? (
            <div className="shop-empty">
              <h3>Nenhum item encontrado</h3>

              <p>
                Esta loja ainda não possui itens
                disponíveis para venda.
              </p>
            </div>
          ) : (
            filteredItems.map((item) => (
              <article
                key={item.id}
                className="shop-card"
                aria-label={item.nome}
              >
                <div className="shop-card-image">
                  {item.imagem ? (
                    <img
                      src={item.imagem}
                      alt={item.nome}
                    />
                  ) : (
                    <div className="shop-card-placeholder">
                      {item.nome
                        .slice(0, 2)
                        .toUpperCase()}
                    </div>
                  )}
                </div>

                <div className="shop-card-body">
                  <div className="shop-card-header">
                    <h3>{item.nome}</h3>

                    <span
                      className={`rarity rarity-${item.raridade.toLowerCase()}`}
                    >
                      {item.raridade}
                    </span>
                  </div>

                  <p className="shop-card-meta">
                    {item.categoria} •{" "}
                    {item.subcategoria}
                  </p>

                  <div className="shop-price-row">
                    <strong>
                      {item.preco} {item.moeda}
                    </strong>

                    <span>
                      {item.estoque} em estoque
                    </span>
                  </div>

                  <div className="shop-card-actions">
                    <button
                      type="button"
                      className="btn-secondary"
                      onClick={() =>
                        setSelectedItem(item)
                      }
                    >
                      Examinar
                    </button>

                    <button
                      type="button"
                      className="btn-primary"
                      onClick={() =>
                        addToCart(item)
                      }
                      disabled={
                        !item.disponivel ||
                        item.estoque <=
                          (cart.find(
                            (entry) =>
                              entry.itemId ===
                              item.id,
                          )?.quantity ?? 0)
                      }
                    >
                      {item.estoque > 0
                        ? "Adicionar"
                        : "Sem estoque"}
                    </button>
                  </div>
                </div>
              </article>
            ))
          )}
        </section>
      </div>

      {selectedItem && (
        <div
          className="shop-modal-backdrop"
          onClick={() =>
            setSelectedItem(null)
          }
        >
          <div
            className="shop-modal"
            onClick={(event) =>
              event.stopPropagation()
            }
          >
            <div className="shop-modal-header">
              <div>
                <span className="shop-kicker">
                  Pergaminho de item
                </span>

                <h2>
                  {selectedItem.nome}
                </h2>
              </div>

              <button
                type="button"
                className="shop-close"
                onClick={() =>
                  setSelectedItem(null)
                }
              >
                Fechar
              </button>
            </div>

            <div className="shop-modal-body">
              <div className="shop-modal-art">
                {selectedItem.imagem ? (
                  <img
                    src={selectedItem.imagem}
                    alt={selectedItem.nome}
                  />
                ) : (
                  <div className="shop-card-placeholder large">
                    {selectedItem.nome
                      .slice(0, 2)
                      .toUpperCase()}
                  </div>
                )}
              </div>

              <div className="shop-modal-content">
                <p className="shop-card-meta">
                  {selectedItem.categoria} •{" "}
                  {selectedItem.subcategoria} •{" "}
                  {selectedItem.raridade}
                </p>

                <p className="shop-modal-description">
                  {selectedItem.descricao}
                </p>

                {selectedItem.efeitos.length > 0 && (
                  <ul className="shop-effects">
                    {selectedItem.efeitos.map(
                      (efeito) => (
                        <li key={efeito}>
                          {efeito}
                        </li>
                      ),
                    )}
                  </ul>
                )}

                <div className="shop-modal-footer">
                  <span>
                    Preço: {selectedItem.preco}{" "}
                    {selectedItem.moeda}
                  </span>

                  <span>
                    Estoque:{" "}
                    {selectedItem.estoque}
                  </span>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    addToCart(selectedItem);
                    setSelectedItem(null);
                  }}
                  disabled={
                    !selectedItem.disponivel
                  }
                >
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