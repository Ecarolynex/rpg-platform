import { useEffect, useMemo, useRef, useState } from "react";
import { Link, useLocation, useParams, useSearchParams } from "react-router-dom";
import {
  adicionarItemExistenteNaLoja,
  comprarCarrinho,
  getCampaignAccess,
  getCharacters,
  listarMinhasCampanhas,
  listarPersonagensDaCampanha,
  listarItensDaLoja,
  listarCatalogoItens,
  removerItemDaLoja,
  salvarItemDaLoja,
  enviarRetrato,
} from "../../services/api";
import type {
  Campaign,
  CatalogItem,
  ShopItem as DatabaseShopItem,
} from "../../services/api";
import type { Character } from "../../types/character";
import "./Shop.css";

interface ShopItem {
  id: string;
  itemId?: string;
  campaignId: string;
  nome: string;
  categoria: string;
  subcategoria: string;
  raridade:
    | "Comum"
    | "Incomum"
    | "Raro"
    | "Épico"
    | "Lendário";
  descricao: string;
  efeitos: string[];
  atributo?: string;
  bonus?: number;
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

const EMPTY_SHOP_ITEMS: ShopItem[] = [];

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

const ATRIBUTOS = [
  "Força",
  "Destreza",
  "Constituição",
  "Inteligência",
  "Carisma",
];

const MAX_SHOP_IMAGE_SIZE_BYTES = 3 * 1024 * 1024;

const initialItemDraft = {
  nome: "",
  categoria: "Armas",
  subcategoria: "",
  raridade: "Comum" as ShopItem["raridade"],
  descricao: "",
  efeitos: "",
  atributo: "",
  bonus: "0",
  preco: "",
  estoque: "1",
  imagem: "",
};

const defaultItems: ShopItem[] = [
  {
    id: "item-espada",
    campaignId: "",
    nome: "Espada do Crepúsculo",
    categoria: "Armas",
    subcategoria: "Espadas",
    raridade: "Épico",
    descricao: "Uma lâmina forjada em sombra e orvalho.",
    efeitos: ["+15 Dano Sombrio", "+5 Força"],
    atributo: "Força",
    bonus: 5,
    preco: 750,
    moeda: "PO",
    estoque: 5,
    disponivel: true,
    imagem: "",
  },
  {
    id: "item-pocao",
    campaignId: "",
    nome: "Poção de Cura",
    categoria: "Poções",
    subcategoria: "Cura",
    raridade: "Comum",
    descricao: "Um frasco de ervas que restaura o vigor do aventureiro.",
    efeitos: ["Cura 25 HP", "Recupera energia"],
    preco: 80,
    moeda: "PO",
    estoque: 12,
    disponivel: true,
    imagem: "",
  },
  {
    id: "item-amuleto",
    campaignId: "",
    nome: "Amuleto de Vitalidade",
    categoria: "Acessórios",
    subcategoria: "Amuletos",
    raridade: "Incomum",
    descricao: "Uma joia simples que guarda o espírito do caminho de volta ao lar.",
    efeitos: ["+2 Constituição", "+1 Resistência"],
    atributo: "Constituição",
    bonus: 2,
    preco: 180,
    moeda: "PO",
    estoque: 3,
    disponivel: true,
    imagem: "",
  },
];

function getShopStorageKey(campaignId: string) {
  return `rpg-platform-shop-${campaignId}`;
}

function getCartStorageKey(campaignId: string) {
  return `rpg-platform-cart-${campaignId}`;
}

function persistLocalStorageValue(key: string, value: unknown) {
  try {
    window.localStorage.setItem(key, JSON.stringify(value));
  } catch (error) {
    const errorName =
      typeof error === "object" && error !== null && "name" in error
        ? String(error.name)
        : "";
    const errorCode =
      typeof error === "object" && error !== null && "code" in error
        ? Number(error.code)
        : undefined;
    const quotaExceeded =
      /quota/i.test(errorName) || errorCode === 22 || errorCode === 1014;

    console.warn(
      quotaExceeded
        ? "A quota do armazenamento local foi atingida; a loja continuará funcionando sem atualizar este cache."
        : "Não foi possível atualizar o armazenamento local da loja.",
      error,
    );
  }
}

function shopItemsForLocalStorage(items: ShopItem[]): ShopItem[] {
  return items.map((item) => ({
    ...item,
    imagem: item.imagem?.startsWith("data:image/") ? undefined : item.imagem,
  }));
}

function getDefaultItems(campaignId: string): ShopItem[] {
  return defaultItems.map((item) => ({
    ...item,
    id: `${campaignId}-${item.id}`,
    campaignId,
  }));
}

function normalizeShopItem(item: ShopItem): ShopItem {
  if (item.atributo && item.bonus !== undefined) {
    return item;
  }

  const effectWithAttribute = (item.efeitos ?? [])
    .map((effect) => effect.match(/^\s*([+-]?\d+)\s+(Força|Destreza|Constituição|Inteligência|Carisma)\s*$/i))
    .find(Boolean);

  return {
    ...item,
    atributo: item.atributo ?? effectWithAttribute?.[2],
    bonus: item.bonus ?? (effectWithAttribute ? Number(effectWithAttribute[1]) : undefined),
  };
}

function getAdditionalCardEffect(item: ShopItem): string | undefined {
  const attributeBonus = item.atributo && item.bonus !== undefined
    ? `${item.bonus > 0 ? "+" : ""}${item.bonus} ${item.atributo}`
        .replace(/\s+/g, "")
        .toLocaleLowerCase()
    : undefined;

  return item.efeitos.find(
    (effect) =>
      effect.replace(/\s+/g, "").toLocaleLowerCase() !== attributeBonus,
  );
}

function fromDatabaseShopItem(item: DatabaseShopItem): ShopItem {
  const categoryByType: Record<string, ShopItem["categoria"]> = {
    ARMA: "Armas",
    ARMADURA: "Armaduras",
    CONSUMIVEL: "Poções",
    ACESSORIO: "Acessórios",
  };
  const raridade: ShopItem["raridade"] =
    RARIDADES.find(
      (option) => option !== "Todas" && option.toLowerCase() === item.raridade?.toLowerCase(),
    ) as ShopItem["raridade"] ?? "Comum";

  return normalizeShopItem({
    id: item.id,
    itemId: item.itemId,
    campaignId: item.campanhaId,
    nome: item.nome,
    categoria: categoryByType[item.tipo?.toUpperCase() ?? ""] ?? "Diversos",
    subcategoria: "",
    raridade,
    descricao: item.descricao ?? "",
    efeitos: item.efeito?.split(/\r?\n/).filter(Boolean) ?? [],
    preco: item.precoCompra,
    moeda: "PO",
    estoque: item.estoque,
    disponivel: item.ativo && item.estoque > 0,
    imagem: item.imagemUrl ?? undefined,
  });
}

function readStoredItems(campaignId: string): ShopItem[] {
  if (typeof window === "undefined") {
    return getDefaultItems(campaignId);
  }

  const saved = window.localStorage.getItem(getShopStorageKey(campaignId));
  if (saved === null) {
    return getDefaultItems(campaignId);
  }

  try {
    const parsed = JSON.parse(saved) as ShopItem[];
    return Array.isArray(parsed)
      ? parsed.map(normalizeShopItem)
      : getDefaultItems(campaignId);
  } catch {
    return getDefaultItems(campaignId);
  }
}

function readStoredCart(campaignId: string): CartEntry[] {
  if (typeof window === "undefined") {
    return [];
  }

  try {
    const saved = window.localStorage.getItem(
      getCartStorageKey(campaignId),
    );

    return saved
      ? (JSON.parse(saved) as CartEntry[])
      : [];
  } catch {
    return [];
  }
}

export default function Shop() {
  const { id } = useParams();
  const location = useLocation();
  const [searchParams] = useSearchParams();
  const requestedCharacterId = searchParams.get("personagem");

  const campaignId = id ?? "campanha-demo";

  const [storedItems, setItems] = useState<ShopItem[]>(
    () => (id ? [] : readStoredItems(campaignId)),
  );
  const [itemsLoadedFor, setItemsLoadedFor] = useState<string | null>(
    id ? null : campaignId,
  );
  const [itemsErrorState, setItemsErrorState] = useState("");
  const items = itemsLoadedFor === campaignId ? storedItems : EMPTY_SHOP_ITEMS;
  const itemsLoading = Boolean(id && itemsLoadedFor !== campaignId);
  const itemsError = itemsLoadedFor === campaignId ? itemsErrorState : "";

  const [search, setSearch] = useState("");
  const [selectedCategory, setSelectedCategory] =
    useState("Todas");
  const [selectedRarity, setSelectedRarity] =
    useState("Todas");
  const [sortBy, setSortBy] =
    useState("nome");

  const [cart, setCart] = useState<CartEntry[]>(
    () => readStoredCart(campaignId),
  );

  const [checkoutMessage, setCheckoutMessage] =
    useState("");
  const [checkoutError, setCheckoutError] = useState("");
  const [checkoutLoading, setCheckoutLoading] = useState(false);

  const [selectedItem, setSelectedItem] =
    useState<ShopItem | null>(null);

  const [isMaster, setIsMaster] =
    useState(false);
  const [showItemForm, setShowItemForm] = useState(false);
  const [editingItemId, setEditingItemId] = useState<string | null>(null);
  const [itemDraft, setItemDraft] = useState(initialItemDraft);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [selectedImagePreview, setSelectedImagePreview] = useState<string | null>(null);
  const imageReaderRef = useRef<FileReader | null>(null);
  const [itemSaving, setItemSaving] = useState(false);
  const [itemSaveError, setItemSaveError] = useState("");
  const [catalogItems, setCatalogItems] = useState<CatalogItem[]>([]);

  const clearSelectedImage = () => {
    const reader = imageReaderRef.current;
    if (reader?.readyState === FileReader.LOADING) {
      reader.abort();
    }
    imageReaderRef.current = null;
    setSelectedImageFile(null);
    setSelectedImagePreview(null);
  };
  const [showReuseForm, setShowReuseForm] = useState(false);
  const [selectedReuseItemIds, setSelectedReuseItemIds] = useState<string[]>([]);
  const [reusePrice, setReusePrice] = useState("100");
  const [reuseStock, setReuseStock] = useState("1");

  const [characters, setCharacters] =
    useState<Character[]>([]);
  const [activeCharacterId, setActiveCharacterId] =
    useState("");

  const [availableCampaigns, setAvailableCampaigns] =
    useState<Campaign[]>([]);
  const [campaignsLoading, setCampaignsLoading] =
    useState(!id);
  const [campaignsError, setCampaignsError] =
    useState("");

  useEffect(() => {
    let active = true;

    async function loadCharacters() {
      try {
        const ownedCharacters = await getCharacters();
        let selectable = ownedCharacters;

        if (id) {
          const [access, campaignCharacters] = await Promise.all([
            getCampaignAccess(campaignId),
            listarPersonagensDaCampanha(campaignId),
          ]);
          selectable = access.isMaster
            ? campaignCharacters
            : ownedCharacters.filter((character) => character.campanhaId === campaignId);
          setIsMaster(access.isMaster);
        }

        if (!active) return;

        setCharacters(selectable);
        const selectedCharacter =
          selectable.find((character) => character.id === requestedCharacterId) ??
          selectable.find((character) => character.campanhaId === campaignId) ??
          selectable[0];
        setActiveCharacterId(selectedCharacter?.id ?? "");
      } catch {
        if (active) setCharacters([]);
      }
    }

    void loadCharacters();

    return () => {
      active = false;
    };
  }, [campaignId, id, requestedCharacterId]);

  useEffect(() => {
    if (!id) return;

    let active = true;

    listarItensDaLoja(campaignId)
      .then((data) => {
        if (active) {
          setItems(data.map(fromDatabaseShopItem));
          setItemsErrorState("");
        }
      })
      .catch((error) => {
        if (active) {
          setItems([]);
          setItemsErrorState(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar o catálogo da campanha.",
          );
        }
      })
      .finally(() => {
        if (active) setItemsLoadedFor(campaignId);
      });

    return () => {
      active = false;
    };
  }, [campaignId, id]);

  useEffect(() => {
    if (!id || !isMaster || !showReuseForm) return;

    let active = true;
    listarCatalogoItens()
      .then((data) => {
        if (!active) return;
        setCatalogItems(data);
        const availableIds = new Set(
          data
            .filter((catalogItem) => !items.some((item) => item.itemId === catalogItem.itemId))
            .map((catalogItem) => catalogItem.itemId),
        );
        setSelectedReuseItemIds((current) =>
          current.filter((itemId) => availableIds.has(itemId)),
        );
      })
      .catch((error) => {
        if (active) {
          setItemSaveError(
            error instanceof Error
              ? error.message
              : "Não foi possível carregar as cartas reutilizáveis.",
          );
        }
      });

    return () => {
      active = false;
    };
  }, [id, isMaster, items, showReuseForm]);

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
    if (id && typeof window !== "undefined") {
      persistLocalStorageValue(
        getShopStorageKey(campaignId),
        shopItemsForLocalStorage(items),
      );
    }
  }, [campaignId, id, items]);

  useEffect(() => {
    if (
      id &&
      typeof window !== "undefined"
    ) {
      persistLocalStorageValue(
        getCartStorageKey(campaignId),
        cart,
      );
    }
  }, [campaignId, cart, id]);

  const activeCharacter =
    characters.find(
      (character) =>
        character.id === activeCharacterId,
    ) ?? characters[0];
  const gold = activeCharacter?.carteira?.po ?? 0;
  const selectableCharacters = id
    ? characters.filter((character) => character.campanhaId === campaignId)
    : characters;
  const reusableCatalogItems = catalogItems.filter(
    (catalogItem) => !items.some((item) => item.itemId === catalogItem.itemId),
  );
  const selectedReuseItemIdSet = new Set(selectedReuseItemIds);
  const selectedReusableItemCount = reusableCatalogItems.filter((catalogItem) =>
    selectedReuseItemIdSet.has(catalogItem.itemId),
  ).length;
  const allReusableItemsSelected =
    reusableCatalogItems.length > 0 &&
    selectedReusableItemCount === reusableCatalogItems.length;

  const cartRows = useMemo(
    () =>
      cart.flatMap((entry) => {
        const item = items.find(
          (candidate) =>
            candidate.id === entry.itemId,
        );

        return item
          ? [{ item, quantity: entry.quantity }]
          : [];
      }),
    [cart, items],
  );

  const cartCount = cartRows.reduce(
    (sum, entry) =>
      sum + entry.quantity,
    0,
  );

  const cartTotal = cartRows.reduce(
    (sum, entry) =>
      sum +
      entry.item.preco *
        entry.quantity,
    0,
  );

  const filteredItems = useMemo(() => {
    const query =
      search.trim().toLowerCase();

    return [...items]
      .filter((item) => {
        const matchesSearch =
          !query ||
          item.nome
            .toLowerCase()
            .includes(query) ||
          item.categoria
            .toLowerCase()
            .includes(query) ||
          item.subcategoria
            .toLowerCase()
            .includes(query);

        const matchesCategory =
          selectedCategory === "Todas" ||
          item.categoria ===
            selectedCategory;

        const matchesRarity =
          selectedRarity === "Todas" ||
          item.raridade ===
            selectedRarity;

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
            return b.nome.localeCompare(
              a.nome,
            );

          default:
            return a.nome.localeCompare(
              b.nome,
            );
        }
      });
  }, [
    items,
    search,
    selectedCategory,
    selectedRarity,
    sortBy,
  ]);

  const addToCart = (
    item: ShopItem,
  ) => {
    if (!item.disponivel) {
      window.alert(
        "Este item está temporariamente indisponível.",
      );
      return;
    }

    const quantityInCart =
      cart.find(
        (entry) =>
          entry.itemId === item.id,
      )?.quantity ?? 0;

    if (
      item.estoque <=
      quantityInCart
    ) {
      window.alert(
        "Não há estoque suficiente para adicionar mais unidades.",
      );
      return;
    }

    setCart((previous) => {
      const existing =
        previous.find(
          (entry) =>
            entry.itemId ===
            item.id,
        );

      if (existing) {
        return previous.map(
          (entry) =>
            entry.itemId ===
            item.id
              ? {
                  ...entry,
                  quantity:
                    entry.quantity +
                    1,
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
                Math.min(
                  item.estoque,
                  quantity,
                ),
              ),
            }
          : entry,
      ),
    );
  };

  const removeFromCart = (
    itemId: string,
  ) => {
    setCart((previous) =>
      previous.filter(
        (entry) =>
          entry.itemId !== itemId,
      ),
    );
  };

  const checkout = async () => {
    if (!cartRows.length) {
      return;
    }

    if (itemsLoading || itemsError) {
      setCheckoutError(itemsError || "Aguarde o carregamento do catálogo.");
      return;
    }

    if (!activeCharacter) {
      setCheckoutError("Selecione um personagem da campanha antes de comprar.");
      return;
    }

    const unavailableEntry =
      cartRows.find(
        ({ item, quantity }) =>
          !item.disponivel ||
          item.estoque < quantity,
      );

    if (unavailableEntry) {
      window.alert(
        `O estoque de ${unavailableEntry.item.nome} mudou. Atualize a loja e tente novamente.`,
      );

      return;
    }

    setCheckoutLoading(true);
    setCheckoutError("");

    try {
      const receipt = await comprarCarrinho(
        activeCharacter.id,
        cartRows.map(({ item, quantity }) => ({
          lojaItemId: item.id,
          quantidade: quantity,
        })),
      );

      setCharacters((current) => current.map((character) => {
        if (character.id !== activeCharacter.id) return character;

        const carteira = character.carteira ?? { pc: 0, pp: 0, pe: 0, po: 0, pl: 0 };
        return { ...character, carteira: { ...carteira, po: receipt.saldo_po } };
      }));
      setCart([]);
      setCheckoutMessage("Compra concluída e registrada no inventário do personagem.");

      try {
        const refreshedItems = await listarItensDaLoja(campaignId);
        setItems(refreshedItems.map(fromDatabaseShopItem));
      } catch {
        setItemsErrorState("Compra concluída. Não foi possível atualizar o estoque agora.");
      }
    } catch (error) {
      setCheckoutError(
        error instanceof Error ? error.message : "Não foi possível concluir a compra.",
      );
    } finally {
      setCheckoutLoading(false);
    }
  };

  const handleImageUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const input = event.currentTarget;
    const file = input.files?.[0];

    if (!file) return;

    if (file.type !== "image/png") {
      clearSelectedImage();
      setItemSaveError("A imagem da carta deve ser um arquivo PNG.");
      input.value = "";
      return;
    }

    if (file.size === 0) {
      clearSelectedImage();
      setItemSaveError("A imagem da carta não pode estar vazia.");
      input.value = "";
      return;
    }

    if (file.size > MAX_SHOP_IMAGE_SIZE_BYTES) {
      clearSelectedImage();
      setItemSaveError("A imagem da carta deve ter no máximo 3 MB.");
      input.value = "";
      return;
    }

    clearSelectedImage();
    setItemSaveError("");
    setSelectedImageFile(file);

    try {
      const reader = new FileReader();
      imageReaderRef.current = reader;
      reader.onload = () => {
        if (imageReaderRef.current !== reader) return;
        imageReaderRef.current = null;
        setSelectedImagePreview(typeof reader.result === "string" ? reader.result : null);
      };
      reader.onerror = () => {
        if (imageReaderRef.current !== reader) return;
        clearSelectedImage();
        input.value = "";
        setItemSaveError("Não foi possível ler a imagem selecionada. Tente novamente.");
      };
      reader.readAsDataURL(file);
    } catch {
      clearSelectedImage();
      input.value = "";
      setItemSaveError("Não foi possível ler a imagem selecionada. Tente novamente.");
    }
  };

  const handleItemSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setItemSaving(true);
    setItemSaveError("");

    const nextItem: ShopItem = {
      id: editingItemId ?? `item-${Date.now()}`,
      campaignId,
      nome: itemDraft.nome.trim(),
      categoria: itemDraft.categoria,
      subcategoria: itemDraft.subcategoria.trim(),
      raridade: itemDraft.raridade,
      descricao: itemDraft.descricao.trim(),
      efeitos: itemDraft.efeitos.split("\n").map((effect) => effect.trim()).filter(Boolean),
      atributo: itemDraft.atributo || undefined,
      bonus: itemDraft.atributo ? Number(itemDraft.bonus) : undefined,
      preco: Number(itemDraft.preco),
      moeda: "PO",
      estoque: Number(itemDraft.estoque),
      disponivel: editingItemId
        ? items.find((item) => item.id === editingItemId)?.disponivel ?? true
        : true,
      imagem: itemDraft.imagem,
    };

    const typeByCategory: Record<ShopItem["categoria"], string> = {
      Armas: "ARMA",
      Armaduras: "ARMADURA",
      Poções: "CONSUMIVEL",
      Acessórios: "ACESSORIO",
      Diversos: "DIVERSOS",
    };
    const effects = [...nextItem.efeitos];
    if (nextItem.atributo && nextItem.bonus) {
      effects.push(`+${nextItem.bonus} ${nextItem.atributo}`);
    }

    let uploadedImageUrl: string | null = null;

    try {
      let imagemUrl = itemDraft.imagem || null;

      if (selectedImageFile) {
        uploadedImageUrl = await enviarRetrato(selectedImageFile);
        imagemUrl = uploadedImageUrl;
        clearSelectedImage();
        setItemDraft((current) => ({ ...current, imagem: imagemUrl ?? "" }));
      } else if (imagemUrl?.startsWith("data:image/")) {
        throw new Error(
          "Selecione novamente a imagem desta carta para enviá-la ao armazenamento da loja.",
        );
      }

      const saved = await salvarItemDaLoja({
        campanhaId: campaignId,
        lojaItemId: editingItemId ?? undefined,
        nome: nextItem.nome,
        descricao: nextItem.descricao,
        tipo: typeByCategory[nextItem.categoria],
        raridade: nextItem.raridade.toUpperCase(),
        efeito: effects.join("\n"),
        imagemUrl,
        precoCompra: nextItem.preco,
        estoque: nextItem.estoque,
        ativo: nextItem.disponivel,
      });
      const savedItem = fromDatabaseShopItem(saved);

      setItems((current) => editingItemId
        ? current.map((item) => item.id === editingItemId ? savedItem : item)
        : [savedItem, ...current]);
      setItemDraft(initialItemDraft);
      clearSelectedImage();
      setEditingItemId(null);
      setShowItemForm(false);
    } catch (error) {
      const message = error instanceof Error
        ? error.message
        : "Não foi possível salvar a carta.";
      setItemSaveError(
        uploadedImageUrl
          ? `Imagem enviada, mas a carta não foi salva. ${message}`
          : message,
      );
    } finally {
      setItemSaving(false);
    }
  };

  const editItem = (item: ShopItem) => {
    setItemDraft({
      nome: item.nome,
      categoria: item.categoria,
      subcategoria: item.subcategoria,
      raridade: item.raridade,
      descricao: item.descricao,
      efeitos: item.efeitos.join("\n"),
      atributo: item.atributo ?? "",
      bonus: String(item.bonus ?? 0),
      preco: String(item.preco),
      estoque: String(item.estoque),
      imagem: item.imagem ?? "",
    });
    clearSelectedImage();
    setEditingItemId(item.id);
    setShowItemForm(true);
  };

  const closeItemForm = () => {
    setShowItemForm(false);
    setEditingItemId(null);
    clearSelectedImage();
    setItemDraft(initialItemDraft);
  };

  const toggleItemAvailability = async (itemId: string) => {
    const item = items.find((candidate) => candidate.id === itemId);
    if (!item) return;

    setItemSaveError("");
    try {
      const saved = await salvarItemDaLoja({
        campanhaId: campaignId,
        lojaItemId: item.id,
        nome: item.nome,
        descricao: item.descricao,
        tipo: {
          Armas: "ARMA",
          Armaduras: "ARMADURA",
          Poções: "CONSUMIVEL",
          Acessórios: "ACESSORIO",
          Diversos: "DIVERSOS",
        }[item.categoria] ?? "DIVERSOS",
        raridade: item.raridade.toUpperCase(),
        efeito: item.efeitos.join("\n"),
        imagemUrl: item.imagem ?? null,
        precoCompra: item.preco,
        estoque: item.estoque,
        ativo: !item.disponivel,
      });
      const savedItem = fromDatabaseShopItem(saved);
      setItems((current) => current.map((entry) => entry.id === item.id ? savedItem : entry));
    } catch (error) {
      setItemSaveError(
        error instanceof Error ? error.message : "Não foi possível alterar a disponibilidade.",
      );
    }
  };

  const handleReuseSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const selectedItems = reusableCatalogItems.filter((catalogItem) =>
      selectedReuseItemIdSet.has(catalogItem.itemId),
    );
    if (itemSaving || selectedItems.length === 0) return;

    setItemSaving(true);
    setItemSaveError("");
    try {
      const results = await Promise.allSettled(
        selectedItems.map((catalogItem) =>
          adicionarItemExistenteNaLoja(
            campaignId,
            catalogItem.itemId,
            Number(reusePrice),
            Number(reuseStock),
          ),
        ),
      );
      const failedItemIds = results.flatMap((result, index) =>
        result.status === "rejected" ? [selectedItems[index].itemId] : [],
      );
      const addedCount = results.length - failedItemIds.length;

      if (addedCount > 0) {
        try {
          const refreshed = await listarItensDaLoja(campaignId);
          setItems(refreshed.map(fromDatabaseShopItem));
        } catch (error) {
          setItemSaveError(
            `${addedCount} carta(s) adicionada(s), mas não foi possível atualizar a loja. ${
              error instanceof Error ? error.message : "Tente atualizar a página."
            }`,
          );
          return;
        }
      }

      setSelectedReuseItemIds(failedItemIds);
      if (failedItemIds.length > 0) {
        setItemSaveError(
          addedCount > 0
            ? `${addedCount} carta(s) adicionada(s); ${failedItemIds.length} não puderam ser adicionada(s). Revise a seleção e tente novamente.`
            : "Não foi possível adicionar as cartas selecionadas. Tente novamente.",
        );
        return;
      }

      setShowReuseForm(false);
      setSelectedReuseItemIds([]);
      setReusePrice("100");
      setReuseStock("1");
    } catch (error) {
      setItemSaveError(
        error instanceof Error ? error.message : "Não foi possível reutilizar as cartas selecionadas.",
      );
    } finally {
      setItemSaving(false);
    }
  };

  const handleRemoveFromShop = async (item: ShopItem) => {
    const confirmed = window.confirm(
      `Excluir definitivamente a oferta de “${item.nome}” desta loja? A carta continuará no catálogo e em outros inventários.`,
    );
    if (!confirmed) return;

    setItemSaving(true);
    setItemSaveError("");
    try {
      await removerItemDaLoja(campaignId, item.id);
      setItems((current) => current.filter((entry) => entry.id !== item.id));
      setItemSaveError(
        "Oferta excluída definitivamente desta loja. O item-base permanece no catálogo e nos inventários.",
      );
    } catch (error) {
      setItemSaveError(
        error instanceof Error ? error.message : "Não foi possível remover a carta desta loja.",
      );
    } finally {
      setItemSaving(false);
    }
  };

  if (!id) {
    return (
      <div className="shop-page">
        <header className="shop-header">
          <div className="shop-header-title">
            <span className="shop-kicker">
              Loja
            </span>

            <h1>
              Escolher campanha
            </h1>
          </div>
        </header>

        {campaignsLoading ? (
          <p>
            Carregando campanhas...
          </p>
        ) : campaignsError ? (
          <p role="alert">
            {campaignsError}
          </p>
        ) : availableCampaigns.length ? (
          <div className="shop-campaign-list">
            {availableCampaigns.map(
              (campaign) => (
                <Link
                  className="shop-campaign-option"
                  key={campaign.id}
                  to={`/campanha/${campaign.id}/loja`}
                >
                  <strong>
                    {campaign.nome}
                  </strong>

                  <span>
                    {campaign.sistema ||
                      "Sistema não informado"}
                  </span>

                  <span>
                    {campaign.ouro_inicial ??
                      0}{" "}
                    PO iniciais por
                    jogador
                  </span>
                </Link>
              ),
            )}
          </div>
        ) : (
          <div className="shop-empty">
            <h2>
              Nenhuma campanha disponível
            </h2>

            <p>
              Crie uma campanha ou
              entre em uma para
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
    location.pathname.endsWith(
      "/carrinho",
    );

  if (isCartPage) {
    return (
      <div className="shop-page shop-cart-page">
        <header className="shop-header">
          <div className="shop-header-title">
            <span className="shop-kicker">
              Loja da campanha
            </span>

            <h1>
              Carrinho
            </h1>
          </div>

          <div className="shop-wallet">
            <span>
              Moeda da campanha
            </span>

            <strong>
              {gold} PO
            </strong>
          </div>
        </header>

        <nav className="shop-breadcrumbs" aria-label="Navegação da campanha">
          <Link className="shop-return-link" to={`/campanha/${campaignId}`}>
            ← Campanha
          </Link>
          <Link className="shop-return-link" to={`/campanha/${campaignId}/mapa`}>
            Mapa
          </Link>
          {activeCharacter && (
            <Link className="shop-return-link" to={`/personagem/${activeCharacter.id}`}>
              Ficha
            </Link>
          )}
          <Link className="shop-return-link" to={`/campanha/${campaignId}/loja`}>
            Loja da campanha
          </Link>
          <span className="shop-breadcrumb-current" aria-current="page">Carrinho</span>
        </nav>

        {checkoutMessage && (
          <p
            className="shop-checkout-message"
            role="status"
          >
            {checkoutMessage}
          </p>
        )}
        {checkoutError && (
          <p className="shop-checkout-message" role="alert">
            {checkoutError}
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
                    aria-label={
                      item.nome
                    }
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
                            .slice(
                              0,
                              2,
                            )
                            .toUpperCase()}
                        </span>
                      )}
                    </div>

                    <div className="shop-cart-entry-info">
                      <span className="shop-kicker">
                        {item.raridade} •{" "}
                        {item.categoria}
                      </span>

                      <h2>
                        {item.nome}
                      </h2>

                      <span>
                        {item.preco} PO
                        cada
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

                      <span>
                        {quantity}
                      </span>

                      <button
                        type="button"
                        aria-label={`Aumentar ${item.nome}`}
                        disabled={
                          quantity >=
                          item.estoque
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
                      {item.preco *
                        quantity}{" "}
                      PO
                    </strong>

                    <button
                      type="button"
                      className="shop-remove-button"
                      onClick={() =>
                        removeFromCart(
                          item.id,
                        )
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
                <span>
                  Total do pedido
                </span>

                <strong>
                  {cartTotal} PO
                </strong>
              </div>

              <button
                className="btn-primary"
                type="button"
                onClick={checkout}
                disabled={
                  checkoutLoading
                }
              >
                {checkoutLoading
                  ? "Processando..."
                  : "Finalizar compra"}
              </button>
            </section>
          </>
        ) : (
          <div className="shop-empty">
            <h2>
              Sua sacola está vazia
            </h2>

            <p>
              Adicione itens do catálogo
              para montar seu pedido.
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
            <span>
              Bolsa
            </span>

            <strong>
              {gold} PO
            </strong>
          </div>

          <Link
            className="shop-cart-link"
            to={`/campanha/${campaignId}/loja/carrinho`}
          >
            Carrinho{" "}
            <span>
              {cartCount}
            </span>
          </Link>
        </div>
      </header>

      <nav className="shop-breadcrumbs" aria-label="Navegação da campanha">
        <Link className="shop-return-link" to={`/campanha/${campaignId}`}>
          ← Campanha
        </Link>
        <Link className="shop-return-link" to={`/campanha/${campaignId}/mapa`}>
          Mapa
        </Link>
        {activeCharacter && (
          <Link className="shop-return-link" to={`/personagem/${activeCharacter.id}`}>
            Ficha
          </Link>
        )}
        <span className="shop-breadcrumb-current" aria-current="page">Loja atual</span>
      </nav>

      <div className="shop-topbar">
        <label className="shop-search">
          <span>
            Livro de registros
          </span>

          <input
            aria-label="Procurar no catálogo"
            value={search}
            onChange={(event) =>
              setSearch(
                event.target.value,
              )
            }
            placeholder="Procurar no catálogo..."
          />
        </label>

        <label className="shop-select">
          <span>
            Ordenar
          </span>

          <select
            value={sortBy}
            onChange={(event) =>
              setSortBy(
                event.target.value,
              )
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
            {CATEGORIAS.map(
              (category) => (
                <button
                  key={category}
                  type="button"
                  className={
                    category ===
                    selectedCategory
                      ? "is-active"
                      : ""
                  }
                  onClick={() =>
                    setSelectedCategory(
                      category,
                    )
                  }
                >
                  {category}
                </button>
              ),
            )}
          </div>
        </div>

        <div className="shop-filter-group">
          <span className="shop-filter-label">
            Raridade
          </span>

          <div className="shop-filter-pills">
            {RARIDADES.map(
              (rarity) => (
                <button
                  key={rarity}
                  type="button"
                  className={
                    rarity ===
                    selectedRarity
                      ? "is-active"
                      : ""
                  }
                  onClick={() =>
                    setSelectedRarity(
                      rarity,
                    )
                  }
                >
                  {rarity}
                </button>
              ),
            )}
          </div>
        </div>
      </div>

      {isMaster && !itemsLoading && (
        <section className="shop-admin-panel">
          <div>
            <span className="shop-kicker">
              Administração
            </span>

            <h2>
              Administrar loja
            </h2>

            <p>
              Publique cartas, ajuste preços e estoque para esta campanha.
            </p>
          </div>
          <div className="shop-admin-actions">
            <button
              type="button"
              className="shop-admin-button"
              onClick={() => showItemForm ? closeItemForm() : setShowItemForm(true)}
            >
              {showItemForm ? "Cancelar" : "+ Adicionar carta"}
            </button>
            <button
              type="button"
              className="btn-secondary"
              onClick={() => {
                setItemSaveError("");
                setShowReuseForm((show) => !show);
              }}
            >
              {showReuseForm ? "Fechar catálogo" : "Reutilizar cartas"}
            </button>
          </div>
        </section>
      )}

      {isMaster && itemSaveError && !showItemForm && (
        <p className="shop-admin-feedback" role="status">{itemSaveError}</p>
      )}

      {isMaster && !itemsLoading && showItemForm && (
        <form className="shop-item-form" onSubmit={handleItemSubmit}>
          <h3>{editingItemId ? "Editar carta da loja" : "Nova carta da loja"}</h3>
          {itemSaveError && <p role="alert">{itemSaveError}</p>}
          <div className="shop-item-form-grid">
            <label>
              Nome da carta
              <input
                required
                value={itemDraft.nome}
                onChange={(event) => setItemDraft((current) => ({ ...current, nome: event.target.value }))}
              />
            </label>
            <label>
              Categoria
              <select
                value={itemDraft.categoria}
                onChange={(event) => setItemDraft((current) => ({ ...current, categoria: event.target.value }))}
              >
                {CATEGORIAS.slice(1).map((category) => <option key={category}>{category}</option>)}
              </select>
            </label>
            <label>
              Subcategoria
              <input
                value={itemDraft.subcategoria}
                onChange={(event) => setItemDraft((current) => ({ ...current, subcategoria: event.target.value }))}
              />
            </label>
            <label>
              Raridade
              <select
                value={itemDraft.raridade}
                onChange={(event) => setItemDraft((current) => ({ ...current, raridade: event.target.value as ShopItem["raridade"] }))}
              >
                {RARIDADES.slice(1).map((rarity) => <option key={rarity}>{rarity}</option>)}
              </select>
            </label>
            <label>
              Atributo concedido
              <select
                value={itemDraft.atributo}
                required={Number(itemDraft.bonus) !== 0}
                onChange={(event) => setItemDraft((current) => ({ ...current, atributo: event.target.value }))}
              >
                <option value="">Nenhum</option>
                {ATRIBUTOS.map((attribute) => <option key={attribute}>{attribute}</option>)}
              </select>
            </label>
            <label>
              Bônus do atributo
              <input
                type="number"
                step="1"
                value={itemDraft.bonus}
                onChange={(event) => setItemDraft((current) => ({ ...current, bonus: event.target.value }))}
              />
            </label>
            <label>
              Preço em PO
              <input
                required
                type="number"
                min="0"
                value={itemDraft.preco}
                onChange={(event) => setItemDraft((current) => ({ ...current, preco: event.target.value }))}
              />
            </label>
            <label>
              Estoque
              <input
                required
                type="number"
                min="0"
                value={itemDraft.estoque}
                onChange={(event) => setItemDraft((current) => ({ ...current, estoque: event.target.value }))}
              />
            </label>
            <label className="shop-item-form-wide">
              Imagem da carta (PNG, até 3 MB)
              <input
                required={!editingItemId}
                type="file"
                accept="image/png"
                aria-describedby="shop-image-upload-help"
                onChange={handleImageUpload}
              />
              <span id="shop-image-upload-help">Envio de uma imagem PNG por carta, com até 3 MB.</span>
            </label>
            {(selectedImagePreview || itemDraft.imagem) && (
              <img
                className="shop-item-image-preview"
                src={selectedImagePreview || itemDraft.imagem}
                alt="Prévia da carta"
              />
            )}
            <label className="shop-item-form-wide">
              Descrição
              <textarea
                required
                rows={3}
                value={itemDraft.descricao}
                onChange={(event) => setItemDraft((current) => ({ ...current, descricao: event.target.value }))}
              />
            </label>
            <label className="shop-item-form-wide">
              Efeitos (um por linha)
              <textarea
                rows={3}
                value={itemDraft.efeitos}
                onChange={(event) => setItemDraft((current) => ({ ...current, efeitos: event.target.value }))}
              />
            </label>
          </div>
          <div className="shop-item-form-actions">
            <button className="shop-admin-button" type="submit" disabled={itemSaving}>
              {itemSaving
                ? selectedImageFile ? "Enviando imagem..." : "Salvando..."
                : editingItemId ? "Salvar alterações" : "Publicar carta"}
            </button>
            <button className="btn-ghost" type="button" onClick={closeItemForm}>
              Cancelar
            </button>
          </div>
        </form>
      )}

      {isMaster && !itemsLoading && showReuseForm && (
        <form className="shop-item-form" onSubmit={handleReuseSubmit}>
          <h3>Reutilizar cartas do catálogo</h3>
          {itemSaveError && <p role="alert">{itemSaveError}</p>}
          {reusableCatalogItems.length > 0 ? (
            <div className="shop-item-form-grid">
              <fieldset className="shop-reuse-selection shop-item-form-wide">
                <legend>Cartas que serão adicionadas</legend>
                <div className="shop-reuse-selection-toolbar">
                  <span role="status">
                    {selectedReusableItemCount} de {reusableCatalogItems.length} selecionadas
                  </span>
                  <button
                    className="btn-ghost small"
                    type="button"
                    disabled={itemSaving}
                    onClick={() => setSelectedReuseItemIds(
                      allReusableItemsSelected
                        ? []
                        : reusableCatalogItems.map((item) => item.itemId),
                    )}
                    aria-pressed={allReusableItemsSelected}
                  >
                    {allReusableItemsSelected ? "Desmarcar todas" : "Selecionar todas"}
                  </button>
                </div>
                <div className="shop-reuse-selection-list">
                  {reusableCatalogItems.map((item) => (
                    <label className="shop-reuse-checkbox-row" key={item.itemId}>
                      <input
                        type="checkbox"
                        disabled={itemSaving}
                        checked={selectedReuseItemIdSet.has(item.itemId)}
                        onChange={(event) => setSelectedReuseItemIds((current) =>
                          event.target.checked
                            ? [...current, item.itemId]
                            : current.filter((itemId) => itemId !== item.itemId),
                        )}
                      />
                      <span>{item.nome}</span>
                    </label>
                  ))}
                </div>
              </fieldset>
              <label>
                Preço em PO (para todas)
                <input
                  type="number"
                  min={0}
                  required
                  disabled={itemSaving}
                  value={reusePrice}
                  onChange={(event) => setReusePrice(event.target.value)}
                />
              </label>
              <label>
                Estoque (para todas)
                <input
                  type="number"
                  min={0}
                  required
                  disabled={itemSaving}
                  value={reuseStock}
                  onChange={(event) => setReuseStock(event.target.value)}
                />
              </label>
            </div>
          ) : (
            <p className="shop-empty">Todas as cartas do catálogo já estão nesta loja.</p>
          )}
          <div className="shop-item-form-actions">
            <button
              className="shop-admin-button"
              type="submit"
              disabled={itemSaving || selectedReusableItemCount === 0}
            >
              {itemSaving
                ? "Adicionando..."
                : `Adicionar ${selectedReusableItemCount} ${selectedReusableItemCount === 1 ? "carta" : "cartas"} à campanha`}
            </button>
            <button
              className="btn-ghost"
              type="button"
              disabled={itemSaving}
              onClick={() => setShowReuseForm(false)}
            >
              Cancelar
            </button>
          </div>
        </form>
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
                .map(
                  (part) =>
                    part[0],
                )
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
              <span>
                Classe
              </span>

              <strong>
                {activeCharacter?.classe ??
                  "—"}
              </strong>
            </div>

            <div className="shop-persona-stat shop-persona-level">
              <span>
                Nível
              </span>

              <strong>
                {activeCharacter?.nivel ??
                  "—"}
              </strong>
            </div>
          </div>
          {selectableCharacters.length > 1 && (
            <label className="shop-character-select">
              <span>Personagem da compra</span>
              <select
                value={activeCharacter?.id ?? ""}
                onChange={(event) => setActiveCharacterId(event.target.value)}
              >
                {selectableCharacters.map((character) => (
                  <option key={character.id} value={character.id}>
                    {character.nome}
                  </option>
                ))}
              </select>
            </label>
          )}
        </div>

        <div className="shop-cart">
          <span className="shop-kicker">
            Sacola do mercador
          </span>

          <h3>
            Seu carrinho
          </h3>

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
            <span>
              Total
            </span>

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
          {filteredItems.length === 0 ? (
            <div className="shop-empty">
              <h3>
                Nenhum item
                encontrado
              </h3>

              <p>
                Esta loja ainda não
                possui itens
                disponíveis para
                venda.
              </p>
            </div>
          ) : (
            filteredItems.map(
              (item) => (
                <article
                  key={item.id}
                  className="shop-card"
                  aria-label={
                    item.nome
                  }
                >
                  <div className="shop-card-image">
                    {item.imagem ? (
                      <img
                        src={
                          item.imagem
                        }
                        alt={
                          item.nome
                        }
                      />
                    ) : (
                      <div className="shop-card-placeholder">
                        {item.nome
                          .slice(
                            0,
                            2,
                          )
                          .toUpperCase()}
                      </div>
                    )}
                  </div>

                  <div className="shop-card-body">
                    <div className="shop-card-header">
                      <h3>
                        {item.nome}
                      </h3>

                      <span
                        className={`rarity rarity-${item.raridade.toLowerCase()}`}
                      >
                        {
                          item.raridade
                        }
                      </span>
                    </div>

                    <p className="shop-card-meta">
                      {item.subcategoria
                        ? `${item.categoria} · ${item.subcategoria}`
                        : item.categoria}
                    </p>

                    {item.descricao && (
                      <p className="shop-card-description">
                        {item.descricao}
                      </p>
                    )}

                    {getAdditionalCardEffect(item) && (
                      <p className="shop-card-effect">
                        {getAdditionalCardEffect(item)}
                      </p>
                    )}

                    {item.atributo && item.bonus !== undefined && (
                      <div className="shop-card-bonus">
                        <span>Bônus</span>
                        <strong>{item.bonus > 0 ? "+" : ""}{item.bonus} {item.atributo}</strong>
                      </div>
                    )}

                    <div className="shop-price-row">
                      <strong>
                        {item.preco} PO
                      </strong>

                      <span>
                        {item.estoque}{" "}
                        em estoque
                      </span>
                    </div>

                    <div className="shop-card-actions">
                      <button
                        type="button"
                        className="btn-secondary"
                        onClick={() =>
                          setSelectedItem(
                            item,
                          )
                        }
                      >
                        Examinar
                      </button>

                      <button
                        type="button"
                        className="btn-primary"
                        onClick={() =>
                          addToCart(
                            item,
                          )
                        }
                        disabled={
                          !item.disponivel ||
                          item.estoque <=
                            (cart.find(
                              (entry) =>
                                entry.itemId ===
                                item.id,
                            )
                              ?.quantity ??
                              0)
                        }
                      >
                        {item.estoque >
                        0
                          ? "Adicionar"
                          : "Sem estoque"}
                      </button>
                    </div>

                    {isMaster && (
                      <div className="shop-master-actions">
                        <button type="button" className="btn-secondary" onClick={() => editItem(item)}>
                          Editar
                        </button>
                        <button type="button" className="btn-ghost small" onClick={() => toggleItemAvailability(item.id)}>
                          {item.disponivel ? "Desativar" : "Ativar"}
                        </button>
                        <button
                          type="button"
                          className="btn-ghost small"
                          disabled={itemSaving}
                          onClick={() => void handleRemoveFromShop(item)}
                           title="Exclui definitivamente esta oferta; mantém o item-base no catálogo e nos inventários"
                         >
                           Excluir oferta
                        </button>
                      </div>
                    )}
                  </div>
                </article>
              ),
            )
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
                  {
                    selectedItem.nome
                  }
                </h2>
              </div>

              <button
                type="button"
                className="shop-close"
                onClick={() =>
                  setSelectedItem(
                    null,
                  )
                }
              >
                Fechar
              </button>
            </div>

            <div className="shop-modal-body">
              <div className="shop-modal-art">
                {selectedItem.imagem ? (
                  <img
                    src={
                      selectedItem.imagem
                    }
                    alt={
                      selectedItem.nome
                    }
                  />
                ) : (
                  <div className="shop-card-placeholder large">
                    {selectedItem.nome
                      .slice(
                        0,
                        2,
                      )
                      .toUpperCase()}
                  </div>
                )}
              </div>

              <div className="shop-modal-content">
                <p className="shop-card-meta">
                  {
                    selectedItem.categoria
                  }{" "}
                  •{" "}
                  {
                    selectedItem.subcategoria
                  }{" "}
                  •{" "}
                  {
                    selectedItem.raridade
                  }
                </p>

                {selectedItem.atributo && selectedItem.bonus !== undefined && (
                  <div className="shop-modal-bonus">
                    <span>Bônus no personagem</span>
                    <strong>{selectedItem.bonus > 0 ? "+" : ""}{selectedItem.bonus} {selectedItem.atributo}</strong>
                  </div>
                )}

                <p className="shop-modal-description">
                  {
                    selectedItem.descricao
                  }
                </p>

                {selectedItem.efeitos
                  .length > 0 && (
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
                    Preço:{" "}
                    {selectedItem.preco}{" "}
                    PO
                  </span>

                  <span>
                    Estoque:{" "}
                    {
                      selectedItem.estoque
                    }
                  </span>
                </div>

                <button
                  type="button"
                  className="btn-primary"
                  onClick={() => {
                    addToCart(
                      selectedItem,
                    );
                    setSelectedItem(
                      null,
                    );
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